"""
GitHub Webhook Blueprint for SentinelOps.

Route: POST /api/webhooks/github

Pipeline:
  Webhook → verify signature → identify event → dispatch to store
"""

import os
from flask import Blueprint, jsonify, request
from security.webhook import verify_github_signature
from data_store import store
from services.resilience.event_deduplication import event_deduplicator

webhooks_bp = Blueprint("webhooks", __name__)


@webhooks_bp.route("/api/webhooks/github", methods=["POST"])
def github_webhook():
    """
    GitHub Webhook receiver.
    - Validates HMAC SHA-256 signature via X-Hub-Signature-256 header.
    - Responds to 'ping' events with {"status": "pong"}.
    - Ingests 'workflow_run' events and detects completed failures with deduplication.
    - Returns a structured incident event for failed workflow runs.
    """
    is_valid, msg = verify_github_signature(
        payload_bytes=request.get_data(),
        signature_header=request.headers.get("X-Hub-Signature-256"),
        secret=os.environ.get("GITHUB_WEBHOOK_SECRET"),
    )
    if not is_valid:
        return jsonify({"error": msg, "status": "unauthorized"}), 401

    event = request.headers.get("X-GitHub-Event", "ping")
    payload = request.get_json(force=True, silent=True) or {}

    # ── Ping ──────────────────────────────────────────────────────────────────
    if event == "ping":
        return jsonify({
            "status": "pong",
            "message": "SentinelOps GitHub webhook verified successfully",
            "zen": payload.get("zen", "Keep it logically awesome."),
        }), 200

    # ── workflow_run ──────────────────────────────────────────────────────────
    if event == "workflow_run":
        run_data = payload.get("workflow_run", {})
        run_id = str(run_data.get("id") or payload.get("id") or "")
        repo_name = (payload.get("repository", {}) or {}).get("full_name") or "SentinelOps"
        action = str(payload.get("action", ""))

        if run_id:
            dedup_key = event_deduplicator.build_webhook_key(repo_name, run_id, event_type="workflow_run", action=action)
            if event_deduplicator.is_duplicate(dedup_key):
                return jsonify({
                    "status": "ignored",
                    "reason": "duplicate_event",
                    "dedup_key": dedup_key,
                    "message": f"Duplicate webhook ignored for run {run_id}",
                }), 200
            event_deduplicator.mark_processed(dedup_key)

        result = store.handle_github_workflow_run(payload)
        resp = {"status": "processed", "event": "workflow_run", "result": result}
        if result and result.get("incident"):
            resp["incident"] = result["incident"]
        return jsonify(resp), 200

    # ── push ──────────────────────────────────────────────────────────────────
    if event == "push":
        result = store.handle_github_push(payload)
        return jsonify({"status": "processed", "event": "push", "result": result}), 200

    # ── pull_request ──────────────────────────────────────────────────────────
    if event == "pull_request":
        result = store.handle_github_pull_request(payload)
        return jsonify({"status": "processed", "event": "pull_request", "result": result}), 200

    # ── unhandled ─────────────────────────────────────────────────────────────
    store.record_webhook_event(event, payload, status="ignored", summary=f"Event '{event}' received")
    return jsonify({"status": "ignored", "event": event, "message": f"Event '{event}' acknowledged"}), 200
