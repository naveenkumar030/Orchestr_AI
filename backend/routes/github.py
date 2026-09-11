"""
GitHub Integration Management Blueprint for SentinelOps.

Routes:
  GET  /api/github/status
  POST /api/github/test-webhook
  POST /api/github/dispatch
"""

import os
from flask import Blueprint, jsonify, request
from data_store import store

github_bp = Blueprint("github", __name__)


@github_bp.route("/api/github/status", methods=["GET"])
def github_status():
    """Returns current status of GitHub integration, secret config, and event history."""
    has_secret = bool(os.environ.get("GITHUB_WEBHOOK_SECRET"))
    has_token = bool(os.environ.get("GITHUB_TOKEN"))
    repo = os.environ.get("GITHUB_REPO", "naveenkumar030/SentinelOps")
    return jsonify({
        "status": "active",
        "repository": repo,
        "webhookEndpoint": "/api/webhooks/github",
        "secretConfigured": has_secret,
        "tokenConfigured": has_token,
        "mode": "production-verified" if has_secret else "development-permissive",
        "recentEvents": store.get_webhook_history(limit=15),
        "totalEventsReceived": len(store.webhook_events),
    }), 200


@github_bp.route("/api/github/test-webhook", methods=["POST"])
def github_test_webhook():
    """Simulates an incoming GitHub webhook event for local testing and UI demos."""
    data = request.get_json(force=True, silent=True) or {}
    event_type = data.get("event", "ping")
    payload = data.get("payload")

    if event_type == "ping":
        test_payload = payload or {"zen": "SentinelOps autonomous DevOps active."}
        store.record_webhook_event("ping", test_payload, status="processed", summary="Ping test verified")
        return jsonify({
            "status": "pong", "event": "ping",
            "message": "Simulated ping verified",
            "zen": test_payload.get("zen"),
        }), 200

    elif event_type == "workflow_run":
        test_payload = payload or {
            "action": "completed",
            "workflow_run": {
                "name": "Deploy SentinelOps to Production",
                "head_branch": "main",
                "head_sha": "a1b2c3d4",
                "status": "completed",
                "conclusion": "success",
                "actor": {"login": "sentinel-operator"},
            },
            "repository": {"name": "payment-service"},
            "sender": {"login": "sentinel-operator"},
        }
        res = store.handle_github_workflow_run(test_payload)
        return jsonify({"status": "processed", "event": "workflow_run", "result": res}), 200

    elif event_type == "push":
        test_payload = payload or {
            "ref": "refs/heads/main",
            "pusher": {"name": "devops-engineer"},
            "head_commit": {"id": "e4f5a6b7c8", "message": "feat(api): optimize response latency"},
            "repository": {"name": "SentinelOps"},
            "commits": [{"id": "e4f5a6b7c8"}],
        }
        res = store.handle_github_push(test_payload)
        return jsonify({"status": "processed", "event": "push", "result": res}), 200

    elif event_type == "pull_request":
        test_payload = payload or {
            "action": "opened",
            "number": 142,
            "pull_request": {
                "number": 142,
                "title": "fix(auth): address token expiration race condition",
                "head": {"ref": "fix/jwt-race"},
                "base": {"ref": "main"},
                "user": {"login": "security-dev"},
                "changed_files": 2,
                "additions": 34,
                "deletions": 12,
            },
            "repository": {"name": "auth-service"},
            "sender": {"login": "security-dev"},
        }
        res = store.handle_github_pull_request(test_payload)
        return jsonify({"status": "processed", "event": "pull_request", "result": res}), 200

    return jsonify({"error": f"Unknown simulation event '{event_type}'"}), 400


@github_bp.route("/api/github/dispatch", methods=["POST"])
def github_dispatch():
    """Dispatches a workflow to GitHub Actions via GitHub REST API or simulation."""
    data = request.get_json(force=True, silent=True) or {}
    branch = data.get("branch", "main")
    workflow = data.get("workflow", "deploy.yml")
    inputs = data.get("inputs", {})
    result = store.dispatch_github_workflow(branch=branch, workflow=workflow, inputs=inputs)
    return jsonify(result), 200
