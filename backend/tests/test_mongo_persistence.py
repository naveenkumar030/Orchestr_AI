"""
Test Suite: MongoDB Atlas Cloud Persistence & Resilience
==========================================================
Verifies that SentinelOps connects to MongoDB Atlas, executes document
operations for incidents, workflows, multi-agent reasoning, settings,
logs, deployments, rollbacks, and approvals, and handles offline fallback gracefully.
"""

import os
import sys
import time

import pytest

# Ensure backend directory is in python search path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import app
from data_store import store
from services.incident_service import incident_service
from services.mongo_service import MongoService, mongo_service


@pytest.fixture(scope="module")
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


class TestMongoAtlasPersistence:
    """Validates MongoDB Atlas integration with SentinelOps."""

    def test_mongo_connection_and_ping(self):
        """1. Validates direct connectivity and ping to MongoDB Atlas."""
        ping_res = mongo_service.ping()
        assert ping_res.get("ok") == 1, f"MongoDB ping failed: {ping_res}"
        assert ping_res.get("status") == "connected"
        assert ping_res.get("database") == "sentinelops"
        assert ping_res.get("latency_ms", 999) < 2000, "Ping latency exceeds acceptable threshold"

    def test_mongo_stats(self):
        """2. Validates statistics and collection telemetry."""
        stats = mongo_service.get_stats()
        assert stats.get("connected") is True
        assert "collections" in stats
        cols = stats["collections"]
        assert "incidents" in cols
        assert "workflows" in cols
        assert "agent_reasoning" in cols
        assert "audit_logs" in cols
        assert "logs" in cols
        assert "settings" in cols
        assert "deployments" in cols
        assert "rollbacks" in cols

    def test_incident_persistence_and_retrieval(self):
        """3. Validates storing and fetching incidents in MongoDB Atlas."""
        test_id = f"INC-TEST-{int(time.time())}"
        test_doc = {
            "id": test_id,
            "repo": "naveenkumar030/payment-gateway",
            "pipeline": "Stripe v14 Integration Suite",
            "failure": "Pytest AssertionError",
            "rootCause": "TokenValidator race condition in Redis session cache",
            "confidence": 97,
            "confidenceColor": "primary",
            "status": "Investigating",
            "time": "just now",
            "runId": 99401,
            "branch": "feat/payment-retry",
            "commit": "a1b2c3d",
            "prNumber": 789,
            "remediationBranch": f"sentinelops/fix-{test_id}",
            "diff": "--- a/auth.py\n+++ b/auth.py\n@@ -1,1 +1,2 @@\n+return True",
        }

        # Persist through incident_service
        saved = incident_service.persist_incident(test_doc)
        assert saved is not None
        assert saved.get("id") == test_id

        # Verify retrieval via incident_service
        fetched = incident_service.get_incident_by_id(test_id)
        assert fetched is not None
        assert fetched.get("id") == test_id
        assert fetched.get("rootCause") == test_doc["rootCause"]

        # Verify direct retrieval from MongoDB Atlas
        mongo_doc = mongo_service.get_incident(test_id)
        assert mongo_doc is not None
        assert mongo_doc.get("id") == test_id

        # Clean up test document
        incident_service.delete_incident(test_id)
        assert mongo_service.get_incident(test_id) is None

    def test_incident_status_update(self):
        """4. Validates updating incident status in MongoDB Atlas."""
        test_id = f"INC-STAT-{int(time.time())}"
        incident_service.persist_incident({
            "id": test_id,
            "repo": "SentinelOps",
            "failure": "Build failure",
            "status": "Investigating",
        })

        updated = incident_service.update_incident_status(test_id, "Remediated")
        assert updated is not None

        # Confirm from MongoDB
        mongo_doc = mongo_service.get_incident(test_id)
        assert mongo_doc is not None
        assert mongo_doc.get("status") == "Remediated"

        # Cleanup
        incident_service.delete_incident(test_id)

    def test_workflow_persistence(self):
        """5. Validates storing and fetching workflow runs in MongoDB Atlas."""
        test_run_id = int(time.time()) % 1000000 + 500000
        wf_data = {
            "run_id": test_run_id,
            "repository": "naveenkumar030/SentinelOps",
            "workflow_name": "Production Deploy Suite",
            "branch": "main",
            "commit_sha": "c0ffee1",
            "status": "completed",
            "conclusion": "success",
            "event_type": "push",
        }

        saved = incident_service.persist_workflow_run(wf_data)
        assert saved is not None
        assert saved.get("run_id") == test_run_id

    def test_agent_reasoning_persistence(self):
        """6. Validates saving multi-agent reasoning trace into MongoDB Atlas."""
        test_id = f"INC-REASON-{int(time.time())}"
        reasoning = {
            "incident_id": test_id,
            "triage_summary": "Identified null pointer exception in authentication token parser",
            "agents_involved": ["Sentinel-Core", "Healer-Alpha", "TestForge"],
            "proposed_patch": "unified diff patch",
            "confidence_score": 95,
        }

        store.save_agent_reasoning(test_id, reasoning)
        fetched = store.get_agent_reasoning(test_id)
        assert fetched is not None
        assert fetched.get("confidence_score") == 95
        assert fetched.get("triage_summary") == reasoning["triage_summary"]

    def test_settings_persistence(self):
        """7. Validates persisting and retrieving operational settings in MongoDB Atlas."""
        new_settings = {"confidenceThreshold": 92, "ciSuccessRequired": True, "autoMergeActive": True}
        store.update_settings(new_settings)

        retrieved = mongo_service.get_settings()
        assert retrieved is not None
        assert retrieved.get("confidenceThreshold") == 92
        assert retrieved.get("autoMergeActive") is True

    def test_logs_persistence(self):
        """8. Validates storing and querying structured logs in MongoDB Atlas."""
        trace = f"trace-test-{int(time.time())}"
        msg = f"Diagnostic test log message {time.time()}"
        entry = store.add_log(service="test-service", level="INFO", message=msg, trace_id=trace)
        assert entry is not None

        # Query back from mongo_service
        logs = mongo_service.get_logs(service="test-service", limit=10)
        assert any(l.get("traceId") == trace for l in logs)

    def test_deployment_and_rollback_persistence(self):
        """9. Validates deployment and rollback records in MongoDB Atlas."""
        dep_id = f"dep-test-{int(time.time())}"
        dep = {
            "deployment_id": dep_id,
            "incident_id": "INC-TEST-DEP",
            "repository": "payment-service",
            "status": "SUCCESS",
            "environment": "production",
        }
        store.save_deployment(dep)
        fetched_dep = store.get_deployment(dep_id)
        assert fetched_dep is not None
        assert fetched_dep.get("deployment_id") == dep_id

        rb_id = f"rb-test-{int(time.time())}"
        rb = {
            "rollback_id": rb_id,
            "incident_id": "INC-TEST-DEP",
            "status": "SUCCESS",
            "reason": "Automated test rollback",
        }
        store.save_rollback(rb)
        rbs = store.get_rollbacks()
        assert any(r.get("rollback_id") == rb_id for r in rbs)

    def test_approval_and_action_persistence(self):
        """10. Validates human approvals and safe action records in MongoDB Atlas."""
        inc_id = f"INC-APPR-{int(time.time())}"
        approval_record = {
            "incident_id": inc_id,
            "approval_status": "pending_review",
            "automated_decision": "human_review_required",
            "risk_level": "medium",
        }
        mongo_service.save_approval(inc_id, approval_record)
        fetched = mongo_service.get_approval(inc_id)
        assert fetched is not None
        assert fetched.get("approval_status") == "pending_review"

        action_data = {
            "action": "CREATE_DRAFT_PR",
            "status": "success",
            "incident_id": inc_id,
            "pr_number": 199,
        }
        mongo_service.save_action_record(inc_id, action_data)
        fetched_action = mongo_service.get_action_record(inc_id)
        assert fetched_action is not None
        assert fetched_action.get("pr_number") == 199

    def test_database_status_and_ping_endpoints(self, client):
        """11. Validates /api/database/status and /api/database/ping endpoints."""
        status_resp = client.get("/api/database/status")
        assert status_resp.status_code == 200
        data = status_resp.get_json()
        assert data.get("provider") == "MongoDB Atlas"
        assert data.get("connected") is True
        assert data.get("database") == "sentinelops"
        assert "collections" in data

        ping_resp = client.post("/api/database/ping")
        assert ping_resp.status_code == 200
        ping_data = ping_resp.get_json()
        assert ping_data.get("ok") == 1
        assert ping_data.get("status") == "connected"

    def test_database_sync_endpoint(self, client):
        """12. Validates /api/database/sync endpoint."""
        sync_resp = client.post("/api/database/sync")
        assert sync_resp.status_code == 200
        sync_data = sync_resp.get_json()
        assert sync_data.get("success") is True
        assert "synced" in sync_data

    def test_health_endpoint_reports_mongodb(self, client):
        """13. Validates /api/health endpoint returns MongoDB Atlas connectivity status."""
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.get_json()

        assert data.get("status") == "healthy"
        assert data.get("database") == "mongodb_atlas"
        assert data.get("mongo_connected") is True
        assert data.get("mongo_db") == "sentinelops"
        assert "mongo_latency_ms" in data

    def test_fallback_resilience_on_invalid_uri(self):
        """14. Validates fallback resilience when MongoDB is disconnected."""
        # Instantiate a mock offline MongoService with invalid URI
        offline_mongo = MongoService(uri="mongodb://invalid-host:27017/?serverSelectionTimeoutMS=500")
        assert offline_mongo.is_connected() is False

        # Attempting operations on offline instance must not raise exceptions
        res = offline_mongo.get_incident("INC-NONEXISTENT")
        assert res is None
        stats = offline_mongo.get_stats()
        assert stats["connected"] is False
