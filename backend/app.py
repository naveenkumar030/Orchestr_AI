import os
import time
import json
import mimetypes
from flask import Flask, jsonify, request, send_from_directory, Response, stream_with_context
from flask_cors import CORS
from data_store import store
from routes import register_routes

# Ensure proper MIME types on Windows platforms
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("application/json", ".json")

# Path to the compiled React UI production bundle
FRONTEND_DIST_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "cicd-app", "dist")
)

app = Flask(__name__)
# Enable CORS for frontend Vite development server and all origins
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Register Blueprint route modules
# routes/health.py    → GET  /api/health, GET  /api/overview
# routes/webhooks.py  → POST /api/webhooks/github
# routes/github.py    → GET  /api/github/status
#                        POST /api/github/test-webhook
#                        POST /api/github/dispatch
register_routes(app)


# ── Incidents ─────────────────────────────────────────────────────────────────
@app.route("/api/incidents", methods=["GET"])
def list_incidents():
    status = request.args.get("status")
    search = request.args.get("search")
    return jsonify(store.get_incidents(status=status, search=search)), 200


@app.route("/api/incidents/<incident_id>", methods=["GET"])
def get_incident(incident_id):
    inc = store.get_incident(incident_id)
    if not inc:
        return jsonify({"error": f"Incident '{incident_id}' not found"}), 404
    return jsonify(inc), 200


@app.route("/api/incidents/<incident_id>/status", methods=["POST", "PATCH"])
def update_incident_status(incident_id):
    data = request.get_json(force=True, silent=True) or {}
    new_status = data.get("status")
    if not new_status:
        return jsonify({"error": "Missing 'status' in payload"}), 400

    updated = store.update_incident_status(incident_id, new_status)
    if not updated:
        return jsonify({"error": f"Incident '{incident_id}' not found"}), 404
    return jsonify(updated), 200


@app.route("/api/incidents/<incident_id>/explain", methods=["POST"])
def explain_incident(incident_id):
    explanation = store.explain_incident(incident_id)
    if not explanation:
        return jsonify({"error": f"Incident '{incident_id}' not found"}), 404
    return jsonify(explanation), 200


@app.route("/api/incidents/simulate", methods=["POST"])
def simulate_anomaly():
    new_incident = store.simulate_anomaly()
    return jsonify(new_incident), 201


# ── Pipelines ─────────────────────────────────────────────────────────────────
@app.route("/api/pipelines", methods=["GET"])
def list_pipelines():
    status = request.args.get("status")
    return jsonify(store.get_pipelines(status=status)), 200


@app.route("/api/pipelines/<pipeline_id>", methods=["GET"])
def get_pipeline(pipeline_id):
    pipe = store.get_pipeline(pipeline_id)
    if not pipe:
        return jsonify({"error": f"Pipeline '{pipeline_id}' not found"}), 404
    return jsonify(pipe), 200


@app.route("/api/pipelines/trigger", methods=["POST"])
def trigger_pipeline():
    data = request.get_json(force=True, silent=True) or {}
    repo = data.get("repo", "payment-service")
    branch = data.get("branch", "main")
    name = data.get("name", "Autonomous CI/CD Workflow")
    created = store.trigger_pipeline(repo=repo, branch=branch, name=name)
    return jsonify(created), 201


@app.route("/api/pipelines/<pipeline_id>/retry", methods=["POST"])
def retry_pipeline(pipeline_id):
    retried = store.retry_pipeline(pipeline_id)
    if not retried:
        return jsonify({"error": f"Pipeline '{pipeline_id}' not found"}), 404
    return jsonify(retried), 200


# ── AI Agents ─────────────────────────────────────────────────────────────────
@app.route("/api/ai-agents", methods=["GET"])
def list_ai_agents():
    return jsonify(store.get_ai_agents()), 200


@app.route("/api/ai-agents", methods=["POST"])
def deploy_ai_agent():
    data = request.get_json(force=True, silent=True) or {}
    new_agent = store.add_ai_agent(data)
    return jsonify(new_agent), 201


@app.route("/api/ai-agents/<agent_id>/status", methods=["PATCH", "POST"])
def update_agent_status(agent_id):
    data = request.get_json(force=True, silent=True) or {}
    status = data.get("status")
    if not status:
        return jsonify({"error": "Missing 'status' in payload"}), 400
    updated = store.update_agent_status(agent_id, status)
    if not updated:
        return jsonify({"error": f"Agent '{agent_id}' not found"}), 404
    return jsonify(updated), 200


# ── Pull Requests ─────────────────────────────────────────────────────────────
@app.route("/api/pull-requests", methods=["GET"])
def list_pull_requests():
    return jsonify(store.get_pull_requests()), 200


@app.route("/api/pull-requests/<pr_id>/review", methods=["POST"])
def review_pull_request(pr_id):
    pr = store.review_pull_request(pr_id)
    if not pr:
        return jsonify({"error": f"Pull Request '{pr_id}' not found"}), 404
    return jsonify(pr), 200


@app.route("/api/pull-requests/<pr_id>/merge", methods=["POST"])
def merge_pull_request(pr_id):
    pr = store.merge_pull_request(pr_id)
    if not pr:
        return jsonify({"error": f"Pull Request '{pr_id}' not found"}), 404
    return jsonify(pr), 200


# ── Logs & Observability ──────────────────────────────────────────────────────
@app.route("/api/logs", methods=["GET"])
def list_logs():
    service = request.args.get("service")
    level = request.args.get("level")
    query = request.args.get("query")
    return jsonify(store.get_logs(service=service, level=level, query=query)), 200


@app.route("/api/logs", methods=["POST"])
def create_log():
    data = request.get_json(force=True, silent=True) or {}
    service = data.get("service", "custom-service")
    level = data.get("level", "INFO")
    message = data.get("message", "Log event recorded")
    trace_id = data.get("traceId")
    new_entry = store.add_log(service=service, level=level, message=message, trace_id=trace_id)
    return jsonify(new_entry), 201


@app.route("/api/logs/stream", methods=["GET"])
def stream_logs():
    """Server-Sent Events (SSE) endpoint streaming real-time logs to UI."""
    def generate():
        last_seen_id = None
        yield f"event: ping\ndata: {json.dumps({'status': 'connected'})}\n\n"
        while True:
            current_logs = store.get_logs(limit=25)
            if current_logs:
                if last_seen_id is None:
                    last_seen_id = current_logs[0]["id"]
                elif current_logs[0]["id"] != last_seen_id:
                    new_entries = []
                    for l in current_logs:
                        if l["id"] == last_seen_id:
                            break
                        new_entries.append(l)
                    last_seen_id = current_logs[0]["id"]
                    for entry in reversed(new_entries):
                        yield f"event: log\ndata: {json.dumps(entry)}\n\n"
            time.sleep(1.0)

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


# ── Settings ──────────────────────────────────────────────────────────────────
@app.route("/api/settings", methods=["GET"])
def get_settings():
    return jsonify(store.get_settings()), 200


@app.route("/api/settings", methods=["POST", "PUT"])
def save_settings():
    data = request.get_json(force=True, silent=True) or {}
    updated = store.update_settings(data)
    return jsonify(updated), 200


# ── Analytics ─────────────────────────────────────────────────────────────────
@app.route("/api/analytics", methods=["GET"])
def get_analytics():
    time_range = request.args.get("range", "30d")
    return jsonify(store.get_analytics(time_range=time_range)), 200


# ── Frontend Web UI & Single-Page Application (SPA) Routing ───────────────────
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    """
    Serves the compiled React UI production bundle.
    - Files in cicd-app/dist (assets, favicon, icons) are served directly.
    - Non-API routes fall back to index.html to support client-side routing.
    - Unmatched /api/* routes return standard 404 JSON.
    """
    if path.startswith("api"):
        return jsonify({"error": f"API endpoint '/{path}' not found"}), 404

    target_file = os.path.join(FRONTEND_DIST_DIR, path)
    if path != "" and os.path.isfile(target_file):
        return send_from_directory(FRONTEND_DIST_DIR, path)

    index_file = os.path.join(FRONTEND_DIST_DIR, "index.html")
    if os.path.isfile(index_file):
        return send_from_directory(FRONTEND_DIST_DIR, "index.html")

    return jsonify({
        "error": "Frontend UI build not found",
        "message": f"Expected index.html at {index_file}",
        "hint": "Run 'npm run build' inside the 'cicd-app' directory to compile the UI."
    }), 404


if __name__ == "__main__":
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 5000))
    print("=" * 68)
    print("  SentinelOps Autonomous DevOps -- Unified Server (API + Frontend)")
    print(f"  Web UI: http://127.0.0.1:{port}")
    print(f"  API:    http://127.0.0.1:{port}/api/health")
    print("=" * 68)
    app.run(host=host, port=port, debug=True)
