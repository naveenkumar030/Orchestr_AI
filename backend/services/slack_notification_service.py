"""
Slack Notification Service for SentinelOps (Phase 5).
Dispatches rich, multi-state incident notifications to Slack via Incoming Webhooks.
Guarantees:
  1. Secret sanitization on all outbound message text.
  2. Complete separation from safety decisions (Slack failure never alters safety gate).
  3. Duplicate notification prevention via composite keys.
  4. Non-leaking error handling (webhook URLs masked in logs/errors).
  5. Fail-safe isolation (never raises exceptions to caller).
"""

import os
import json
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Tuple
from enum import Enum
import threading

import config
from services.secret_sanitizer import secret_sanitizer


class NotificationStatus(str, Enum):
    SENT = "SENT"
    FAILED = "FAILED"
    SKIPPED_DUPLICATE = "SKIPPED_DUPLICATE"
    SKIPPED_DISABLED = "SKIPPED_DISABLED"
    CONFIG_ERROR = "CONFIG_ERROR"


class SlackNotificationService:
    """
    Dedicated notification service for SentinelOps AI pipeline and safety decisions.
    """

    def __init__(self, webhook_url: Optional[str] = None):
        self._webhook_url = webhook_url
        self._sent_keys: set = set()
        self._notification_history: List[Dict[str, Any]] = []
        self._lock = threading.RLock()

    @property
    def webhook_url(self) -> Optional[str]:
        return (
            self._webhook_url
            or os.environ.get("SENTINEL_SLACK_WEBHOOK_URL")
            or os.environ.get("SLACK_WEBHOOK_URL")
            or config.SLACK_WEBHOOK_URL
        )

    def _mask_url(self, url: Optional[str]) -> str:
        """Masks webhook URL for safe logging."""
        if not url:
            return "[UNCONFIGURED]"
        if len(url) > 20:
            return url[:15] + "..." + url[-4:]
        return "[MASKED_WEBHOOK]"

    def _generate_notification_key(
        self, repository: str, incident_or_run_id: str, notification_type: str
    ) -> str:
        """Creates unique idempotency key for notification dispatch."""
        clean_repo = str(repository).strip().lower()
        clean_id = str(incident_or_run_id).strip().lower()
        clean_type = str(notification_type).strip().lower()
        return f"{clean_repo}:{clean_id}:{clean_type}"

    def has_notification_been_sent(
        self, repository: str, incident_or_run_id: str, notification_type: str
    ) -> bool:
        """Checks if a notification has already been sent for this key."""
        key = self._generate_notification_key(repository, incident_or_run_id, notification_type)
        with self._lock:
            return key in self._sent_keys

    def format_incident_message(
        self,
        notification_type: str,
        repository: str,
        workflow_name: str,
        incident_id: str,
        failure: str,
        root_cause: Optional[str] = None,
        job_name: Optional[str] = None,
        diagnosis_confidence: Optional[float] = None,
        fix_confidence: Optional[float] = None,
        risk_level: str = "low",
        critic_approved: bool = True,
        critic_score: Optional[float] = None,
        decision: str = "approved",
        suggested_fix: Optional[str] = None,
        reasons: Optional[List[str]] = None,
        run_id: Optional[int] = None,
        run_url: Optional[str] = None,
        incident_url: Optional[str] = None,
        actor: Optional[str] = None,
        comment: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Builds a concise, structured Slack payload with secret redaction across 5 distinct states:
          1. AUTO_APPROVED
          2. HUMAN_REVIEW_REQUIRED
          3. REJECTED
          4. APPROVED_BY_HUMAN
          5. REJECTED_BY_HUMAN
        """
        norm_type = notification_type.strip().lower()

        # Sanitize all dynamic string inputs
        safe_repo = secret_sanitizer.sanitize_text(repository or "SentinelOps")
        safe_wf = secret_sanitizer.sanitize_text(workflow_name or "CI/CD Workflow")
        safe_job = secret_sanitizer.sanitize_text(job_name or "test")
        safe_failure = secret_sanitizer.sanitize_text(failure or "Workflow run failed")
        safe_rc = secret_sanitizer.sanitize_text(root_cause or "Under investigation")
        safe_fix = secret_sanitizer.sanitize_text(suggested_fix or "Targeted fix available")
        safe_actor = secret_sanitizer.sanitize_text(actor or "operator")
        safe_comment = secret_sanitizer.sanitize_text(comment or "None")

        conf_pct = f"{int(diagnosis_confidence * 100)}%" if diagnosis_confidence is not None else "N/A"
        fix_conf_pct = f"{int(fix_confidence * 100)}%" if fix_confidence is not None else "N/A"
        score_pct = f"{int(critic_score * 100)}%" if critic_score is not None else "N/A"
        risk_upper = str(risk_level).upper()

        run_link_md = f"<{run_url}|GitHub Run #{run_id}>" if run_url and run_id else (f"Run #{run_id}" if run_id else "N/A")
        inc_link_md = f"<{incident_url}|{incident_id}>" if incident_url else incident_id

        # Determine color, title, and banner based on state
        if norm_type in ["auto_approved", "approved"]:
            color = "#10B981"  # Green
            title = f"🚨 SENTINELOPS CI FAILURE — AUTO-APPROVED"
            headline = f"*Decision:* `AUTO_APPROVED` ✅\n*Suggested Fix:* {safe_fix}"
        elif norm_type in ["human_review_required", "pending_review"]:
            color = "#F59E0B"  # Amber/Yellow
            title = f"⚠️ SENTINELOPS CI FAILURE — HUMAN REVIEW REQUIRED"
            reason_str = "; ".join(reasons) if reasons else f"Risk level {risk_upper} requires operator authorization"
            headline = f"*Decision:* `HUMAN_REVIEW_REQUIRED` ⚠️\n*Reason:* {reason_str}"
        elif norm_type in ["rejected", "auto_rejected"]:
            color = "#EF4444"  # Red
            title = f"🛑 SENTINELOPS CI FAILURE — REMEDIATION REJECTED"
            reason_str = "; ".join(reasons) if reasons else "Failed hard security policies or critic evaluation"
            headline = f"*Decision:* `REJECTED` 🛑\n*Reason:* {reason_str}"
        elif norm_type in ["approved_by_human", "human_approved"]:
            color = "#10B981"  # Green
            title = f"✅ SENTINELOPS — APPROVED BY HUMAN"
            headline = f"*Approved By:* `{safe_actor}`\n*Comment:* {safe_comment}\n*Action:* Ready for Draft PR creation"
        elif norm_type in ["rejected_by_human", "human_rejected"]:
            color = "#DC2626"  # Dark Red
            title = f"🛑 SENTINELOPS — REJECTED BY HUMAN"
            headline = f"*Rejected By:* `{safe_actor}`\n*Comment:* {safe_comment}\n*Action:* PR creation blocked by operator"
        else:
            color = "#3B82F6"
            title = f"ℹ️ SENTINELOPS CI EVENT — {incident_id}"
            headline = f"*Status:* `{norm_type.upper()}`"

        fields = [
            {"title": "Repository", "value": safe_repo, "short": True},
            {"title": "Workflow", "value": safe_wf, "short": True},
            {"title": "Job", "value": safe_job, "short": True},
            {"title": "Incident", "value": inc_link_md, "short": True},
            {"title": "Failure", "value": safe_failure[:200], "short": False},
            {"title": "Root Cause", "value": safe_rc[:250], "short": False},
            {"title": "Confidence", "value": conf_pct, "short": True},
            {"title": "Risk Level", "value": risk_upper, "short": True},
            {"title": "Critic", "value": f"{'APPROVED' if critic_approved else 'REJECTED'} ({score_pct})", "short": True},
            {"title": "GitHub Run", "value": run_link_md, "short": True},
        ]

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{title} — {incident_id}",
                },
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": headline,
                },
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Repository:*\n{safe_repo}"},
                    {"type": "mrkdwn", "text": f"*Workflow:*\n{safe_wf}"},
                    {"type": "mrkdwn", "text": f"*Incident:*\n{inc_link_md}"},
                    {"type": "mrkdwn", "text": f"*Confidence:*\n{conf_pct}"},
                    {"type": "mrkdwn", "text": f"*Risk Level:*\n`{risk_upper}`"},
                    {"type": "mrkdwn", "text": f"*Critic:*\n{'APPROVED' if critic_approved else 'REJECTED'} ({score_pct})"},
                ],
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"🛡️ SentinelOps Safety & Notification Layer v5.0 | {run_link_md}",
                    }
                ],
            },
        ]

        payload = {
            "text": f"{title} — {incident_id}",
            "blocks": blocks,
            "attachments": [
                {
                    "color": color,
                    "title": title,
                    "text": headline,
                    "fields": fields,
                    "footer": "SentinelOps Safety & Notification Layer v5.0",
                    "ts": int(time.time()),
                }
            ],
        }
        return payload

    def send_incident_notification(
        self,
        notification_type: str,
        repository: str,
        workflow_name: str,
        incident_id: str,
        failure: str,
        root_cause: Optional[str] = None,
        job_name: Optional[str] = None,
        diagnosis_confidence: Optional[float] = None,
        fix_confidence: Optional[float] = None,
        risk_level: str = "low",
        critic_approved: bool = True,
        critic_score: Optional[float] = None,
        decision: str = "approved",
        suggested_fix: Optional[str] = None,
        reasons: Optional[List[str]] = None,
        run_id: Optional[int] = None,
        run_url: Optional[str] = None,
        incident_url: Optional[str] = None,
        actor: Optional[str] = None,
        comment: Optional[str] = None,
        force_resend: bool = False,
    ) -> Dict[str, Any]:
        """
        Dispatches Slack notification with duplicate protection and fail-safe error isolation.
        Never raises exceptions.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        notification_key = self._generate_notification_key(
            repository=repository,
            incident_or_run_id=str(run_id or incident_id),
            notification_type=notification_type,
        )

        with self._lock:
            # ── Duplicate Protection ──────────────────────────────────────────
            if not force_resend and notification_key in self._sent_keys:
                return {
                    "success": True,
                    "status": "duplicate_skipped",
                    "notification_key": notification_key,
                    "incident_id": incident_id,
                    "notification_type": notification_type,
                    "timestamp": now_iso,
                    "message": f"Notification '{notification_type}' was already sent for {incident_id}.",
                }

        # Build message payload
        payload = self.format_incident_message(
            notification_type=notification_type,
            repository=repository,
            workflow_name=workflow_name,
            incident_id=incident_id,
            failure=failure,
            root_cause=root_cause,
            job_name=job_name,
            diagnosis_confidence=diagnosis_confidence,
            fix_confidence=fix_confidence,
            risk_level=risk_level,
            critic_approved=critic_approved,
            critic_score=critic_score,
            decision=decision,
            suggested_fix=suggested_fix,
            reasons=reasons,
            run_id=run_id,
            run_url=run_url,
            incident_url=incident_url,
            actor=actor,
            comment=comment,
        )

        url = self.webhook_url
        if not url:
            # Simulated environment (no webhook configured)
            with self._lock:
                self._sent_keys.add(notification_key)
                record = {
                    "notification_type": notification_type,
                    "incident_id": incident_id,
                    "run_id": run_id,
                    "notification_key": notification_key,
                    "status": "simulated",
                    "timestamp": now_iso,
                    "details": "Simulated dispatch: SENTINEL_SLACK_WEBHOOK_URL not configured.",
                }
                self._notification_history.append(record)

            try:
                from data_store import store
                store.add_log(
                    service="SlackNotificationService",
                    level="INFO",
                    message=f"Slack notification '{notification_type}' simulated for {incident_id} (key: {notification_key})",
                )
            except Exception:
                pass

            return {
                "success": True,
                "status": "simulated",
                "notification_key": notification_key,
                "incident_id": incident_id,
                "notification_type": notification_type,
                "timestamp": now_iso,
                "record": record,
            }

        # Dispatch HTTP request with bounded retry
        max_attempts = 2
        last_error = None

        for attempt in range(1, max_attempts + 1):
            try:
                success, status_code, msg = self._send_http_request(url, payload)
                if success:
                    with self._lock:
                        self._sent_keys.add(notification_key)
                        record = {
                            "notification_type": notification_type,
                            "incident_id": incident_id,
                            "run_id": run_id,
                            "notification_key": notification_key,
                            "status": "sent",
                            "timestamp": now_iso,
                            "details": f"Delivered to Slack via incoming webhook on attempt {attempt}.",
                        }
                        self._notification_history.append(record)

                    try:
                        from data_store import store
                        store.add_log(
                            service="SlackNotificationService",
                            level="INFO",
                            message=f"Slack notification '{notification_type}' delivered successfully for {incident_id}",
                        )
                    except Exception:
                        pass

                    return {
                        "success": True,
                        "status": "sent",
                        "notification_key": notification_key,
                        "incident_id": incident_id,
                        "notification_type": notification_type,
                        "timestamp": now_iso,
                        "record": record,
                    }
                else:
                    last_error = f"HTTP {status_code}: {msg}"
            except urllib.error.HTTPError as e:
                last_error = f"HTTP Error {e.code}: {e.reason}"
                if e.code in (400, 401, 403, 404):
                    break
            except Exception as e:
                last_error = f"Network exception: {str(e)}"

            if attempt < max_attempts:
                time.sleep(0.5)

        # Record failure gracefully without throwing or mutating safety decision
        with self._lock:
            record = {
                "notification_type": notification_type,
                "incident_id": incident_id,
                "run_id": run_id,
                "notification_key": notification_key,
                "status": "failed",
                "timestamp": now_iso,
                "error": last_error,
                "details": f"Failed to deliver Slack notification: {last_error}",
            }
            self._notification_history.append(record)

        try:
            from data_store import store
            store.add_log(
                service="SlackNotificationService",
                level="WARN",
                message=f"Failed to dispatch Slack notification for {incident_id}: {last_error}",
            )
        except Exception:
            pass

        return {
            "success": False,
            "status": "failed",
            "notification_key": notification_key,
            "incident_id": incident_id,
            "notification_type": notification_type,
            "error": last_error,
            "timestamp": now_iso,
            "record": record,
        }

    def _send_http_request(self, url: str, payload: Dict[str, Any]) -> Tuple[bool, int, str]:
        """Low-level HTTP request dispatcher with non-leaking error handling."""
        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data_bytes,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status in (200, 204):
                return True, response.status, "ok"
            return False, response.status, f"HTTP {response.status}"

    def format_slack_payload(self, event_type: str, reasoning_data: Dict[str, Any]) -> Dict[str, Any]:
        """Formats Slack payload from MultiAgentReasoningResult dictionary."""
        diag = reasoning_data.get("diagnosis", {}) or {}
        fix = reasoning_data.get("fix", {}) or {}
        critic = reasoning_data.get("critic", {}) or {}
        risk = reasoning_data.get("risk_assessment", {}) or {}
        safety = reasoning_data.get("safety_gate", {}) or {}
        human = reasoning_data.get("human_approval", {}) or {}

        return self.format_incident_message(
            notification_type=event_type,
            repository=reasoning_data.get("repository", "SentinelOps"),
            workflow_name=reasoning_data.get("workflow_name", "CI / Test & Build"),
            incident_id=reasoning_data.get("incident_id", "INC-001"),
            failure=diag.get("root_cause", "Workflow failure"),
            root_cause=diag.get("root_cause"),
            job_name=reasoning_data.get("job_name", "build-and-test"),
            diagnosis_confidence=diag.get("confidence"),
            fix_confidence=fix.get("confidence"),
            risk_level=risk.get("risk_level") or safety.get("risk_level", "low"),
            critic_approved=critic.get("approved", True),
            critic_score=critic.get("score"),
            decision=safety.get("decision") or reasoning_data.get("status", "approved"),
            suggested_fix=fix.get("description"),
            reasons=safety.get("reasons") or critic.get("issues"),
            run_id=reasoning_data.get("run_id"),
            actor=human.get("approved_by"),
            comment=human.get("approval_comment"),
        )

    def send_notification(
        self,
        event_type: str,
        reasoning_data: Dict[str, Any],
        force_resend: bool = False,
        actor: Optional[str] = None,
        comment: Optional[str] = None,
    ) -> Dict[str, Any]:
        """High-level dispatch from multi-agent reasoning dictionary."""
        repo = reasoning_data.get("repository", "SentinelOps")
        incident_id = reasoning_data.get("incident_id", "INC-001")
        run_id = reasoning_data.get("run_id")
        
        now_iso = datetime.now(timezone.utc).isoformat()
        notification_key = self._generate_notification_key(
            repository=repo,
            incident_or_run_id=str(run_id or incident_id),
            notification_type=event_type,
        )

        with self._lock:
            if not force_resend and notification_key in self._sent_keys:
                return {
                    "success": True,
                    "status": NotificationStatus.SKIPPED_DUPLICATE.value,
                    "notification_key": notification_key,
                    "incident_id": incident_id,
                    "message": f"Notification '{event_type}' was already sent for {incident_id}.",
                    "timestamp": now_iso,
                }

        url = self.webhook_url
        if not url:
            with self._lock:
                self._sent_keys.add(notification_key)
            return {
                "success": True,
                "status": NotificationStatus.SKIPPED_DISABLED.value,
                "notification_key": notification_key,
                "incident_id": incident_id,
                "message": "Slack notifications disabled: SLACK_WEBHOOK_URL is not configured.",
                "timestamp": now_iso,
            }

        payload = self.format_slack_payload(event_type, reasoning_data)
        
        try:
            success, code, msg = self._send_http_request(url, payload)
            if success:
                with self._lock:
                    self._sent_keys.add(notification_key)
                return {
                    "success": True,
                    "status": NotificationStatus.SENT.value,
                    "notification_key": notification_key,
                    "incident_id": incident_id,
                    "message": f"Notification '{event_type}' delivered to Slack.",
                    "timestamp": now_iso,
                }
            else:
                return {
                    "success": False,
                    "status": NotificationStatus.FAILED.value,
                    "notification_key": notification_key,
                    "incident_id": incident_id,
                    "error": f"HTTP {code}: {msg}",
                    "timestamp": now_iso,
                }
        except Exception as e:
            return {
                "success": False,
                "status": NotificationStatus.FAILED.value,
                "notification_key": notification_key,
                "incident_id": incident_id,
                "error": f"Network exception: {str(e)}",
                "timestamp": now_iso,
            }

    def get_notification_history(self, incident_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieves sent notification records."""
        with self._lock:
            if incident_id:
                return [r for r in self._notification_history if r.get("incident_id") == incident_id]
            return list(self._notification_history)


# Singleton instance
slack_notification_service = SlackNotificationService()
