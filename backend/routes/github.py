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
    """Returns current status of GitHub integration, secret config, relay status, ngrok status, and event history."""
    from services.webhook_relay import webhook_relay_service
    from services.ngrok_service import ngrok_service
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
        "relay": webhook_relay_service.get_status(),
        "ngrok": ngrok_service.get_status(),
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

    elif event_type in ["workflow_run", "workflow_run_failure"]:
        default_conclusion = "failure" if event_type == "workflow_run_failure" else "success"
        test_payload = payload or {
            "action": "completed",
            "workflow_run": {
                "id": 892401,
                "name": "Deploy SentinelOps to Production",
                "head_branch": "main",
                "head_sha": "a1b2c3d4",
                "status": "completed",
                "conclusion": default_conclusion,
                "actor": {"login": "sentinel-operator"},
            },
            "repository": {"name": "payment-service", "full_name": "naveenkumar030/payment-service"},
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


@github_bp.route("/api/github/remediate", methods=["POST"])
def github_trigger_remediation():
    """
    Directly triggers the full autonomous self-healing loop:
    Fetch logs via GitHub REST API -> Healer-Alpha Root-Cause Analysis -> Branch + PR creation.
    """
    data = request.get_json(force=True, silent=True) or {}
    run_id = data.get("run_id", 892401)
    repo = data.get("repo", "payment-service")
    branch = data.get("branch", "main")
    commit_sha = data.get("commit_sha", "a1b2c3d4")
    wf_name = data.get("workflow_name", "CI/CD Pipeline")

    from services.remediation_service import remediation_service
    run_data = {
        "repository": repo,
        "workflow_name": wf_name,
        "run_id": run_id,
        "branch": branch,
        "commit_sha": commit_sha,
        "conclusion": "failure",
        "action": "completed",
    }
    result = remediation_service.remediate_workflow_failure(run_data, trigger_source="api_trigger")
    return jsonify({
        "status": "success",
        "message": f"Autonomous remediation completed by Healer-Alpha for Run #{run_id}",
        "data": result,
    }), 200


@github_bp.route("/api/github/relay/status", methods=["GET"])
def github_relay_status():
    """Returns current status and telemetry of the Smee.io Webhook Relay."""
    from services.webhook_relay import webhook_relay_service
    return jsonify(webhook_relay_service.get_status()), 200


@github_bp.route("/api/github/relay/start", methods=["POST"])
def github_relay_start():
    """Starts the Smee.io Webhook Relay in background."""
    from services.webhook_relay import webhook_relay_service
    data = request.get_json(force=True, silent=True) or {}
    channel_id = data.get("channel_id")
    if channel_id:
        webhook_relay_service.channel_id = channel_id
    webhook_relay_service.start()
    return jsonify({
        "status": "started",
        "message": f"Smee.io Webhook Relay started for {webhook_relay_service.smee_url}",
        "relay": webhook_relay_service.get_status(),
    }), 200


@github_bp.route("/api/github/relay/stop", methods=["POST"])
def github_relay_stop():
    """Stops the Smee.io Webhook Relay."""
    from services.webhook_relay import webhook_relay_service
    webhook_relay_service.stop()
    return jsonify({
        "status": "stopped",
        "message": "Smee.io Webhook Relay stopped",
        "relay": webhook_relay_service.get_status(),
    }), 200


@github_bp.route("/api/github/ngrok/status", methods=["GET"])
def github_ngrok_status():
    """Returns current status and public URL of the ngrok tunnel."""
    from services.ngrok_service import ngrok_service
    return jsonify(ngrok_service.get_status()), 200


@github_bp.route("/api/github/ngrok/start", methods=["POST"])
def github_ngrok_start():
    """Starts the ngrok tunnel on port 5000."""
    from services.ngrok_service import ngrok_service
    data = request.get_json(force=True, silent=True) or {}
    port = data.get("port", 5000)
    authtoken = data.get("authtoken")
    status = ngrok_service.start(port=port, authtoken=authtoken)
    return jsonify({
        "status": "started" if status.get("running") else "failed",
        "message": f"ngrok tunnel active at {status.get('publicUrl')}" if status.get("running") else status.get("error"),
        "ngrok": status,
    }), 200


@github_bp.route("/api/github/ngrok/stop", methods=["POST"])
def github_ngrok_stop():
    """Stops the active ngrok tunnel."""
    from services.ngrok_service import ngrok_service
    status = ngrok_service.stop()
    return jsonify({
        "status": "stopped",
        "message": "ngrok tunnel stopped",
        "ngrok": status,
    }), 200



