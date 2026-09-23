"""
Human Approval Service for SentinelOps.
Manages deterministic human approval lifecycle, state transitions,
audit trails, and idempotency guarantees for risky AI remediation actions.
"""

import logging
import threading
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("sentinelops.human_approval")


class HumanApprovalService:
    """
    Manages human review and approval workflows for AI-generated remediation patches.
    Supported states:
      - 'auto_approved'
      - 'auto_rejected'
      - 'pending_review'
      - 'approved_by_human'
      - 'rejected_by_human'
      - 'expired'
    """

    def __init__(self):
        self._lock = threading.RLock()
        # In-memory store for approval records and audit log
        self._approvals: dict[str, dict[str, Any]] = {}
        self._audit_logs: list[dict[str, Any]] = []

    def initialize_record(
        self,
        incident_id: str,
        safety_gate_result: dict[str, Any],
        run_id: int | None = None,
        repo: str | None = None,
        workflow_name: str | None = None,
    ) -> dict[str, Any]:
        """Creates or updates the initial safety approval record for an incident."""
        with self._lock:
            status = safety_gate_result.get("approval_status", "pending_review")
            now = datetime.now(timezone.utc).isoformat()

            record = {
                "incident_id": incident_id,
                "run_id": run_id,
                "repository": repo or "SentinelOps",
                "workflow_name": workflow_name or "CI/CD Workflow",
                "approval_status": status,
                "automated_decision": safety_gate_result.get("decision", "human_review_required"),
                "risk_level": safety_gate_result.get("risk_level", "medium"),
                "diagnosis_confidence": safety_gate_result.get("diagnosis_confidence", 0.0),
                "fix_confidence": safety_gate_result.get("fix_confidence", 0.0),
                "critic_score": safety_gate_result.get("critic_score", 0.0),
                "critic_approved": safety_gate_result.get("critic_approved", False),
                "security_findings": safety_gate_result.get("security_findings", []),
                "reasons": safety_gate_result.get("reasons", []),
                "approved_by": None,
                "approval_comment": None,
                "decided_at": None,
                "created_at": now,
                "updated_at": now,
                "audit_trail": [
                    {
                        "action": "SAFETY_GATE_EVALUATED",
                        "status": status,
                        "decision": safety_gate_result.get("decision"),
                        "timestamp": now,
                        "details": f"Automated decision: {safety_gate_result.get('decision')} (Risk: {safety_gate_result.get('risk_level')})",
                    }
                ],
            }

            self._approvals[incident_id] = record
            try:
                from services.mongo_service import mongo_service
                if mongo_service.is_connected():
                    mongo_service.save_approval(incident_id, record)
            except Exception as e:
                logger.warning("Failed to save approval for incident %s to MongoDB: %s", incident_id, e)
            return record

    def get_approval_state(self, incident_id: str) -> dict[str, Any] | None:
        """Retrieves the current approval record and audit history for an incident."""
        with self._lock:
            # Check in-memory store
            if incident_id in self._approvals:
                return self._approvals[incident_id]

            # Try MongoDB Atlas
            try:
                from services.mongo_service import mongo_service
                if mongo_service.is_connected():
                    m_rec = mongo_service.get_approval(incident_id)
                    if m_rec:
                        self._approvals[incident_id] = m_rec
                        return m_rec
            except Exception as e:
                logger.warning("Failed to get approval for incident %s from MongoDB: %s", incident_id, e)

            # Try to build fallback from incident store if available
            try:
                from data_store import store
                inc = store.get_incident(incident_id)
                if inc and inc.get("agent_reasoning"):
                    reasoning = inc["agent_reasoning"]
                    safety = reasoning.get("safety_gate") or {}
                    return {
                        "incident_id": incident_id,
                        "approval_status": safety.get("approval_status", "pending_review"),
                        "automated_decision": safety.get("decision", "human_review_required"),
                        "risk_level": safety.get("risk_level", "medium"),
                        "diagnosis_confidence": safety.get("diagnosis_confidence", 0.94),
                        "fix_confidence": safety.get("fix_confidence", 0.90),
                        "critic_score": safety.get("critic_score", 0.88),
                        "critic_approved": safety.get("critic_approved", True),
                        "security_findings": safety.get("security_findings", []),
                        "reasons": safety.get("reasons", []),
                        "approved_by": None,
                        "approval_comment": None,
                        "decided_at": None,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "audit_trail": [],
                    }
            except Exception as e:
                logger.warning("Failed to build approval fallback from incident store for %s: %s", incident_id, e)

            return None

    def submit_decision(
        self,
        incident_id: str,
        decision: str,
        comment: str | None = None,
        approver: str | None = None,
    ) -> dict[str, Any]:
        """
        Processes human decision on a pending incident fix.
        decision: 'approve' | 'reject'
        Enforces idempotency and valid state transitions.
        """
        with self._lock:
            record = self.get_approval_state(incident_id)
            if not record:
                # Initialize empty record if missing
                record = {
                    "incident_id": incident_id,
                    "approval_status": "pending_review",
                    "automated_decision": "human_review_required",
                    "risk_level": "medium",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "audit_trail": [],
                }
                self._approvals[incident_id] = record

            current_status = record.get("approval_status", "pending_review")

            # ── Idempotency Check: Cannot approve or reject twice ─────────────
            if current_status in ["approved_by_human", "rejected_by_human"]:
                return {
                    "success": False,
                    "error": f"Action blocked: Decision has already been finalized as '{current_status}'.",
                    "incident_id": incident_id,
                    "approval_status": current_status,
                    "record": record,
                }

            # ── Rejection Lock: Cannot approve an auto-rejected / blocked fix ─
            if current_status == "auto_rejected" and decision == "approve":
                return {
                    "success": False,
                    "error": "Action blocked: Cannot approve an auto-rejected fix that failed hard security policies without re-triggering multi-agent reasoning.",
                    "incident_id": incident_id,
                    "approval_status": current_status,
                    "record": record,
                }

            # Normalize decision
            decision_norm = decision.strip().lower()
            now = datetime.now(timezone.utc).isoformat()
            actor = approver or "lead-devops"
            user_comment = comment or ("Approved by operator" if decision_norm == "approve" else "Rejected by operator")

            if decision_norm in ["approve", "approved", "accept"]:
                new_status = "approved_by_human"
            elif decision_norm in ["reject", "rejected", "deny"]:
                new_status = "rejected_by_human"
            else:
                return {
                    "success": False,
                    "error": f"Invalid decision value '{decision}'. Must be 'approve' or 'reject'.",
                    "incident_id": incident_id,
                }

            # Apply state update
            record["approval_status"] = new_status
            record["approved_by"] = actor
            record["approval_comment"] = user_comment
            record["decided_at"] = now
            record["updated_at"] = now

            audit_entry = {
                "action": "HUMAN_DECISION_RECORDED",
                "status": new_status,
                "actor": actor,
                "comment": user_comment,
                "previous_status": current_status,
                "timestamp": now,
            }
            record.setdefault("audit_trail", []).append(audit_entry)
            self._approvals[incident_id] = record
            self._audit_logs.append(audit_entry)

            # Persist to MongoDB Atlas
            try:
                from services.mongo_service import mongo_service
                if mongo_service.is_connected():
                    mongo_service.save_approval(incident_id, record)
            except Exception as e:
                logger.warning("Failed to persist updated approval for incident %s to MongoDB: %s", incident_id, e)

            # Sync to data_store and database if incident exists
            try:
                from data_store import store
                inc = store.get_incident(incident_id)
                if inc:
                    if inc.get("agent_reasoning"):
                        inc["agent_reasoning"]["approval_status"] = new_status
                        inc["agent_reasoning"]["human_approval"] = {
                            "status": new_status,
                            "approved_by": actor,
                            "comment": user_comment,
                            "decided_at": now,
                        }
                    store.save_agent_reasoning(incident_id, inc.get("agent_reasoning", {}))
            except Exception as e:
                logger.warning("Failed to sync approval state to incident store for %s: %s", incident_id, e)

            return {
                "success": True,
                "incident_id": incident_id,
                "approval_status": new_status,
                "approved_by": actor,
                "comment": user_comment,
                "timestamp": now,
                "record": record,
            }


# Singleton instance
human_approval_service = HumanApprovalService()
