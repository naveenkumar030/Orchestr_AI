import json
import os
import urllib.error
import urllib.request
from typing import Any

import config


class SlackService:
    """
    Isolated service for dispatching notifications to Slack via Incoming Webhook.
    Fails gracefully if Slack is unconfigured, disabled, or unreachable.
    """

    def __init__(self, webhook_url: str | None = None):
        self._webhook_url = webhook_url

    @property
    def webhook_url(self) -> str | None:
        return self._webhook_url or os.environ.get("SLACK_WEBHOOK_URL") or config.SLACK_WEBHOOK_URL

    def _is_notifications_enabled(self) -> bool:
        """Checks whether notifications are enabled in data store settings."""
        try:
            from data_store import store
            return store.get_settings().get("notificationsEnabled", True)
        except Exception:
            return True

    def _send_message(self, payload: dict[str, Any]) -> bool:
        """
        Sends an HTTP POST message payload to the Slack Incoming Webhook URL.
        Never raises exceptions; returns True if delivered or skipped, False on failure.
        """
        if not self._is_notifications_enabled():
            try:
                from data_store import store
                store.add_log(
                    service="SlackService",
                    level="INFO",
                    message="Slack notification skipped (notifications disabled in settings)",
                )
            except Exception:
                pass
            return True

        url = self.webhook_url
        if not url:
            try:
                from data_store import store
                store.add_log(
                    service="SlackService",
                    level="INFO",
                    message="Slack notification simulated (SLACK_WEBHOOK_URL not configured)",
                )
            except Exception:
                pass
            return True

        try:
            data_bytes = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data_bytes,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                status_code = response.status
                if status_code in (200, 204):
                    try:
                        from data_store import store
                        store.add_log(
                            service="SlackService",
                            level="INFO",
                            message="Slack notification delivered successfully",
                        )
                    except Exception:
                        pass
                    return True
                return False
        except Exception as e:
            try:
                from data_store import store
                store.add_log(
                    service="SlackService",
                    level="ERROR",
                    message=f"Failed to send Slack notification: {e}",
                )
            except Exception:
                pass
            return False

    def send_incident_alert(self, incident: dict[str, Any]) -> bool:
        """
        Sends a structured alert when an incident occurs or SentinelGuard blocks remediation.
        Includes repository, workflow/pipeline, branch, incident ID, confidence, risk level, and status.
        """
        inc_id = incident.get("id", "INC-UNKNOWN")
        repo = incident.get("repo", "SentinelOps")
        pipeline = incident.get("pipeline") or incident.get("workflow", "CI/CD Pipeline")
        branch = incident.get("branch", "main")
        status = incident.get("status", "Investigating")
        risk_level = incident.get("risk_level") or incident.get("riskLevel", "UNKNOWN")
        confidence = incident.get("confidence")
        failure_msg = incident.get("failure") or incident.get("summary") or "CI/CD failure detected."

        is_blocked = status == "Blocked" or risk_level == "BLOCKED"
        color = "#C34A4A" if is_blocked else "#E5A93D"
        title_prefix = "🚨 [SECURITY BLOCKED]" if is_blocked else "⚠️ [INCIDENT ALERT]"

        fields = [
            {"title": "Repository", "value": repo, "short": True},
            {"title": "Pipeline / Workflow", "value": pipeline, "short": True},
            {"title": "Branch", "value": branch, "short": True},
            {"title": "Status", "value": status, "short": True},
            {"title": "Risk Level", "value": risk_level, "short": True},
        ]
        if confidence is not None:
            fields.append({"title": "Confidence Score", "value": f"{confidence}%", "short": True})

        block_reasons = incident.get("block_reasons")
        if block_reasons and isinstance(block_reasons, list):
            fields.append({"title": "Block Reasons", "value": "\n".join(f"• {r}" for r in block_reasons), "short": False})

        payload = {
            "attachments": [
                {
                    "color": color,
                    "title": f"{title_prefix} {inc_id} on {repo}@{branch}",
                    "text": failure_msg,
                    "fields": fields,
                    "footer": "SentinelOps Autonomous DevOps Observability",
                }
            ]
        }
        return self._send_message(payload)

    def send_pr_notification(self, pr_data: dict[str, Any]) -> bool:
        """
        Sends a structured notification when a remediation Pull Request is created.
        Includes repository, PR number, title, HTML URL, branch, confidence, risk level, draft status, and author.
        """
        pr_number = pr_data.get("number") or pr_data.get("prNumber", 0)
        title = pr_data.get("title", f"Remediation PR #{pr_number}")
        repo = pr_data.get("repo", "SentinelOps")
        branch = pr_data.get("branch") or pr_data.get("remediationBranch", "main")
        html_url = pr_data.get("htmlUrl") or pr_data.get("html_url") or pr_data.get("prUrl", "")
        confidence = pr_data.get("aiReviewScore") or pr_data.get("confidence", 0)
        risk_level = pr_data.get("risk_level") or pr_data.get("riskLevel", "LOW")
        is_draft = pr_data.get("draft") or pr_data.get("isDraft", False)
        status = pr_data.get("statusLabel") or pr_data.get("status", "Auto-Remediated")
        agent = pr_data.get("agent", "Healer-Alpha")

        title_prefix = "📝 [DRAFT PULL REQUEST]" if is_draft else "🚀 [AUTO-REMEDIATED PR]"
        color = "#B87A36" if is_draft else "#36A64F"

        fields = [
            {"title": "Repository", "value": repo, "short": True},
            {"title": "Target Branch", "value": branch, "short": True},
            {"title": "Status", "value": status, "short": True},
            {"title": "PR Type", "value": "Draft (Requires Human Review)" if is_draft else "Normal (Approved)", "short": True},
            {"title": "AI Confidence", "value": f"{confidence}%", "short": True},
            {"title": "Risk Level", "value": risk_level, "short": True},
            {"title": "Remediated By", "value": agent, "short": True},
        ]

        payload = {
            "attachments": [
                {
                    "color": color,
                    "title": f"{title_prefix} #{pr_number}: {title}",
                    "title_link": html_url,
                    "text": f"SentinelOps {agent} synthesized a code fix and opened PR #{pr_number}.",
                    "fields": fields,
                    "footer": "SentinelOps Autonomous DevOps Engine",
                }
            ]
        }
        return self._send_message(payload)

    # ── Phase 2 Lifecycle Notifications ───────────────────────────────────────

    def send_validation_started(self, incident_id: str, repo: str, branch: str, pr_number: int | None = None) -> bool:
        """Sends a notification when CI validation polling begins."""
        payload = {
            "attachments": [
                {
                    "color": "#3B82F6",
                    "title": f"⚙️ [CI VALIDATION STARTED] {incident_id}",
                    "text": f"Testing remediation patch on `{repo}@{branch}` (PR #{pr_number or 'N/A'}).",
                    "fields": [
                        {"title": "Incident", "value": incident_id, "short": True},
                        {"title": "Branch", "value": branch, "short": True},
                    ],
                    "footer": "SentinelOps Validation Service",
                }
            ]
        }
        return self._send_message(payload)

    def send_retry_notification(self, incident_id: str, repo: str, attempt: int, max_attempts: int, reason: str) -> bool:
        """Sends a notification when an autonomous retry is triggered."""
        payload = {
            "attachments": [
                {
                    "color": "#E5A93D",
                    "title": f"🔁 [AUTONOMOUS RETRY #{attempt}/{max_attempts}] {incident_id}",
                    "text": "CI validation failed. Healer-Alpha is re-diagnosing and synthesizing a revised patch.",
                    "fields": [
                        {"title": "Repository", "value": repo, "short": True},
                        {"title": "Attempt", "value": f"{attempt} of {max_attempts}", "short": True},
                        {"title": "Previous Failure", "value": reason[:200], "short": False},
                    ],
                    "footer": "SentinelOps Self-Healing Loop",
                }
            ]
        }
        return self._send_message(payload)

    def send_merge_decision(self, incident_id: str, pr_number: int, repo: str, decision_data: dict[str, Any]) -> bool:
        """Sends a notification for MergeGuard decision (Approved or Human Review)."""
        allowed = decision_data.get("allowed", False)
        color = "#10B981" if allowed else "#F59E0B"
        title = "🛡️ [MERGEGUARD APPROVED]" if allowed else "⚠️ [HUMAN REVIEW REQUIRED]"
        reason = decision_data.get("reason", "")

        fields = [
            {"title": "Incident", "value": incident_id, "short": True},
            {"title": "Pull Request", "value": f"#{pr_number}", "short": True},
            {"title": "Decision", "value": "Autonomous Merge Authorized" if allowed else "Human Review Gate", "short": True},
            {"title": "Reason", "value": reason, "short": True},
        ]
        payload = {
            "attachments": [
                {
                    "color": color,
                    "title": f"{title} {incident_id} (PR #{pr_number})",
                    "fields": fields,
                    "footer": "SentinelOps MergeGuard Safety Policy v2.4",
                }
            ]
        }
        return self._send_message(payload)

    def send_resolution_notification(self, incident_id: str, pr_number: int, repo: str, mttr_seconds: int | None = None) -> bool:
        """Sends a notification when an incident is fully resolved and merged."""
        mttr_str = f"{mttr_seconds}s" if mttr_seconds else "< 1m"
        payload = {
            "attachments": [
                {
                    "color": "#10B981",
                    "title": f"🎉 [INCIDENT RESOLVED] {incident_id}",
                    "text": f"Remediation PR #{pr_number} successfully merged into `main`. Pipeline healthy.",
                    "fields": [
                        {"title": "Repository", "value": repo, "short": True},
                        {"title": "PR Number", "value": f"#{pr_number}", "short": True},
                        {"title": "Total MTTR", "value": mttr_str, "short": True},
                        {"title": "Resolution Type", "value": "Autonomous Zero-Human Repair", "short": True},
                    ],
                    "footer": "SentinelOps Autonomous DevOps Observability",
                }
            ]
        }
        return self._send_message(payload)

    def send_escalation_alert(self, incident: dict[str, Any], attempt_count: int, reason: str) -> bool:
        """Sends a high-priority alert when max remediation retries are exhausted."""
        inc_id = incident.get("id", "INC-UNKNOWN")
        repo = incident.get("repo", "SentinelOps")
        payload = {
            "attachments": [
                {
                    "color": "#EF4444",
                    "title": f"🚨 [ESCALATION: MAX RETRIES EXCEEDED] {inc_id}",
                    "text": f"SentinelOps exhausted all {attempt_count} autonomous remediation attempts. Human intervention required.",
                    "fields": [
                        {"title": "Repository", "value": repo, "short": True},
                        {"title": "Total Attempts", "value": str(attempt_count), "short": True},
                        {"title": "Last Reason", "value": reason[:300], "short": False},
                    ],
                    "footer": "SentinelOps Escalation Engine",
                }
            ]
        }
        return self._send_message(payload)

    # ── Phase 3 Deployment, Health Check & Rollback Notifications ──────────────

    def send_deployment_started(
        self,
        incident_id: str,
        repo: str,
        commit_sha: str,
        environment: str = "production",
        deployment_url: str | None = None,
    ) -> bool:
        """Sends notification when autonomous deployment starts."""
        payload = {
            "attachments": [
                {
                    "color": "#3B82F6",
                    "title": f"📦 [DEPLOYMENT STARTED] {incident_id}",
                    "text": f"Deploying verified remediation patch `{commit_sha[:7]}` to `{environment}`.",
                    "fields": [
                        {"title": "Incident", "value": incident_id, "short": True},
                        {"title": "Environment", "value": environment, "short": True},
                        {"title": "Commit", "value": commit_sha[:7], "short": True},
                        {"title": "Target URL", "value": deployment_url or "Configured Target", "short": True},
                    ],
                    "footer": "SentinelOps Deployment Service",
                }
            ]
        }
        return self._send_message(payload)

    def send_deployment_successful(
        self,
        incident_id: str,
        repo: str,
        commit_sha: str,
        environment: str = "production",
        duration_seconds: int = 15,
    ) -> bool:
        """Sends notification when deployment completes successfully."""
        payload = {
            "attachments": [
                {
                    "color": "#10B981",
                    "title": f"🚀 [DEPLOYMENT SUCCESSFUL] {incident_id}",
                    "text": f"Commit `{commit_sha[:7]}` successfully deployed to `{environment}` in {duration_seconds}s. Awaiting health verification.",
                    "fields": [
                        {"title": "Incident", "value": incident_id, "short": True},
                        {"title": "Environment", "value": environment, "short": True},
                        {"title": "Duration", "value": f"{duration_seconds}s", "short": True},
                        {"title": "Status", "value": "SUCCESS (Pending Health Check)", "short": True},
                    ],
                    "footer": "SentinelOps Deployment Service",
                }
            ]
        }
        return self._send_message(payload)

    def send_health_verification_started(self, incident_id: str, target_url: str, threshold: int = 2) -> bool:
        """Sends notification when post-deployment health verification starts."""
        payload = {
            "attachments": [
                {
                    "color": "#8B5CF6",
                    "title": f"❤️ [HEALTH VERIFICATION STARTED] {incident_id}",
                    "text": f"Executing {threshold} consecutive HTTP probes on `{target_url}`.",
                    "fields": [
                        {"title": "Incident", "value": incident_id, "short": True},
                        {"title": "Target", "value": target_url, "short": True},
                        {"title": "Threshold", "value": f"{threshold} Consecutive 200 OK", "short": True},
                    ],
                    "footer": "SentinelOps Health Check Service",
                }
            ]
        }
        return self._send_message(payload)

    def send_health_verification_failed(
        self,
        incident_id: str,
        target_url: str,
        http_status: int,
        reason: str,
    ) -> bool:
        """Sends notification when post-deployment health check fails."""
        payload = {
            "attachments": [
                {
                    "color": "#EF4444",
                    "title": f"❌ [HEALTH VERIFICATION FAILED] {incident_id}",
                    "text": f"Application health degraded on `{target_url}` ({reason}). Initiating automatic rollback.",
                    "fields": [
                        {"title": "Incident", "value": incident_id, "short": True},
                        {"title": "HTTP Status", "value": str(http_status), "short": True},
                        {"title": "Failure Reason", "value": reason, "short": False},
                    ],
                    "footer": "SentinelOps Health Check Service",
                }
            ]
        }
        return self._send_message(payload)

    def send_rollback_started(
        self,
        incident_id: str,
        repo: str,
        current_commit: str,
        fallback_commit: str,
        reason: str,
    ) -> bool:
        """Sends notification when automated rollback begins."""
        payload = {
            "attachments": [
                {
                    "color": "#F59E0B",
                    "title": f"↩️ [ROLLBACK INITIATED] {incident_id}",
                    "text": f"Reverting `{current_commit[:7]}` -> `{fallback_commit[:7]}` on {repo}.",
                    "fields": [
                        {"title": "Incident", "value": incident_id, "short": True},
                        {"title": "Reason", "value": reason, "short": True},
                        {"title": "Restoring Commit", "value": fallback_commit[:7], "short": True},
                    ],
                    "footer": "SentinelOps Rollback Engine",
                }
            ]
        }
        return self._send_message(payload)

    def send_rollback_successful(
        self,
        incident_id: str,
        repo: str,
        restored_commit: str,
        duration_seconds: int = 12,
    ) -> bool:
        """Sends notification when rollback succeeds and service health is verified."""
        payload = {
            "attachments": [
                {
                    "color": "#10B981",
                    "title": f"✅ [ROLLBACK COMPLETED & HEALTHY] {incident_id}",
                    "text": f"Successfully rolled back to `{restored_commit[:7]}`. Post-rollback health verified healthy in {duration_seconds}s.",
                    "fields": [
                        {"title": "Incident", "value": incident_id, "short": True},
                        {"title": "Restored State", "value": f"Commit {restored_commit[:7]} (HEALTHY)", "short": True},
                        {"title": "Outcome", "value": "Incident Mitigated via Rollback", "short": True},
                    ],
                    "footer": "SentinelOps Rollback Engine",
                }
            ]
        }
        return self._send_message(payload)

    def send_rollback_failed_escalation(
        self,
        incident_id: str,
        repo: str,
        error_message: str,
    ) -> bool:
        """Sends critical alert when rollback fails to restore health."""
        payload = {
            "attachments": [
                {
                    "color": "#DC2626",
                    "title": f"🚨 [CRITICAL: ROLLBACK FAILED & ESCALATED] {incident_id}",
                    "text": f"Automated rollback failed for {repo}. Urgent SRE intervention required.",
                    "fields": [
                        {"title": "Incident", "value": incident_id, "short": True},
                        {"title": "Error", "value": error_message[:300], "short": False},
                        {"title": "Urgency", "value": "P1 / SEV-1 Outage Alert", "short": True},
                    ],
                    "footer": "SentinelOps Emergency Dispatch",
                }
            ]
        }
        return self._send_message(payload)


# Singleton instance
slack_service = SlackService()



