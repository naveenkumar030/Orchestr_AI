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


@github_bp.route("/api/github/orchestrate", methods=["POST"])
def github_trigger_orchestration():
    """
    Phase 2 Closed-Loop Autonomous Self-Healing Orchestration:
    Detect -> Diagnose -> Fix -> SentinelGuard -> PR -> CI Validation -> ValidatorAgent -> MergeGuard -> Auto-Merge / Retry / Escalate.
    """
    data = request.get_json(force=True, silent=True) or {}
    run_id = data.get("run_id", 892401)
    repo = data.get("repo", "payment-service")
    branch = data.get("branch", "main")
    commit_sha = data.get("commit_sha", "a1b2c3d4")
    wf_name = data.get("workflow_name", "CI/CD Pipeline")

    from services.remediation_orchestrator import remediation_orchestrator
    run_data = {
        "repository": repo,
        "workflow_name": wf_name,
        "run_id": run_id,
        "branch": branch,
        "commit_sha": commit_sha,
        "conclusion": "failure",
        "action": "completed",
    }
    result = remediation_orchestrator.handle_remediation(
        run_data,
        trigger_source="orchestrate_api",
        override_ci_status=data.get("override_ci_status"),
        override_ci_logs=data.get("override_ci_logs"),
        override_confidence=data.get("override_confidence"),
        override_risk=data.get("override_risk"),
        override_merge_success=data.get("override_merge_success"),
        override_deployment_status=data.get("override_deployment_status"),
        override_health_status=data.get("override_health_status"),
        override_rollback_success=data.get("override_rollback_success"),
        override_rollback_health_status=data.get("override_rollback_health_status"),
    )
    return jsonify({
        "status": "success",
        "message": f"Autonomous orchestration finished for Run #{run_id} (Outcome: {result.get('status')})",
        "data": result,
    }), 200


@github_bp.route("/api/github/validate-branch", methods=["POST"])
def github_validate_branch():
    """Validates CI status for a branch."""
    data = request.get_json(force=True, silent=True) or {}
    repo = data.get("repo", "payment-service")
    branch = data.get("branch", "sentinelops/fix-892401")
    commit_sha = data.get("commit_sha")
    from services.validation_service import validation_service
    res = validation_service.validate_branch(repo, branch, commit_sha)
    return jsonify(res), 200


@github_bp.route("/api/github/merge-guard/check", methods=["POST"])
def github_merge_guard_check():
    """Evaluates MergeGuard 7-point policy against provided parameters."""
    data = request.get_json(force=True, silent=True) or {}
    confidence = data.get("confidence", 95)
    risk_level = data.get("risk_level", "LOW")
    sentinel_status = data.get("sentinel_status", "PASS")
    ci_status = data.get("ci_status", "SUCCESS")
    attempt_number = data.get("attempt_number", 1)
    restricted_paths = data.get("restricted_paths", False)
    secret_scan = data.get("secret_scan", "PASS")

    from services.merge_guard import merge_guard
    res = merge_guard.can_auto_merge(
        confidence=confidence,
        risk_level=risk_level,
        sentinel_status=sentinel_status,
        ci_status=ci_status,
        attempt_number=attempt_number,
        restricted_paths=restricted_paths,
        secret_scan=secret_scan,
    )
    return jsonify(res), 200


@github_bp.route("/api/github/deployment-guard/check", methods=["POST"])
def github_deployment_guard_check():
    """Evaluates DeploymentGuard 5-point safety policy against provided parameters."""
    data = request.get_json(force=True, silent=True) or {}
    ci_status = data.get("ci_status", "SUCCESS")
    merge_guard_status = data.get("merge_guard_status", "APPROVED")
    pr_merged = data.get("pr_merged", True)
    deployment_status = data.get("deployment_status", "SUCCESS")
    health_check_status = data.get("health_check_status", "HEALTHY")

    from services.deployment_guard import deployment_guard
    res = deployment_guard.can_declare_resolved(
        ci_status=ci_status,
        merge_guard_status=merge_guard_status,
        pr_merged=pr_merged,
        deployment_status=deployment_status,
        health_check_status=health_check_status,
    )
    return jsonify(res), 200


@github_bp.route("/api/github/health-check", methods=["POST"])
def github_health_check():
    """Performs probe verification on a service endpoint using HealthCheckService."""
    data = request.get_json(force=True, silent=True) or {}
    url = data.get("url")
    incident_id = data.get("incident_id")
    timeout = data.get("timeout_seconds")
    interval = data.get("interval_seconds")
    threshold = data.get("success_threshold")

    from services.health_check_service import health_check_service
    res = health_check_service.verify_service_health(
        url=url,
        incident_id=incident_id,
        timeout_seconds=timeout,
        interval_seconds=interval,
        success_threshold=threshold,
    )
    return jsonify(res), 200



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


@github_bp.route("/api/github/connect", methods=["POST"])
def github_connect():
    """Connects a new GitHub repository for CI/CD telemetry and autonomous monitoring."""
    data = request.get_json(force=True, silent=True) or {}
    repo = data.get("repository") or data.get("repo")
    token = data.get("token")
    branch = data.get("branch", "main")

    if not repo:
        return jsonify({"success": False, "error": "Missing 'repository' in payload"}), 400

    result = store.connect_repository(repo=repo, token=token, branch=branch)
    return jsonify(result), 200


@github_bp.route("/api/github/verify", methods=["POST"])
def github_verify():
    """Verifies access and existence of a repository via GitHub REST API."""
    import urllib.request
    import json
    data = request.get_json(force=True, silent=True) or {}
    repo = data.get("repository") or data.get("repo") or store.repo
    token = data.get("token") or os.environ.get("GITHUB_TOKEN")

    repo_clean = repo.strip()
    if "github.com/" in repo_clean:
        repo_clean = repo_clean.split("github.com/")[-1]
    repo_clean = repo_clean.strip("/")

    url = f"https://api.github.com/repos/{repo_clean}"
    headers = {
        "User-Agent": "SentinelOps-DevOps-Agent",
        "Accept": "application/vnd.github+json",
    }
    if token and token.strip():
        headers["Authorization"] = f"Bearer {token.strip()}"

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return jsonify({
                "success": True,
                "reachable": True,
                "repository": repo_clean,
                "defaultBranch": body.get("default_branch", "main"),
                "stars": body.get("stargazers_count", 0),
                "openIssues": body.get("open_issues_count", 0),
                "isPrivate": body.get("private", False),
                "description": body.get("description") or "GitHub repository linked to SentinelOps",
                "message": f"Repository '{repo_clean}' verified live on GitHub.",
            }), 200
    except Exception as e:
        return jsonify({
            "success": True,
            "reachable": False,
            "repository": repo_clean,
            "defaultBranch": "main",
            "message": f"Connected repository '{repo_clean}' (Operating in autonomous local mode).",
        }), 200




