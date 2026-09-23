"""
Unit and integration tests for production state persistence across restarts and workers.
Tests MongoDB Atlas write-through, startup hydration, memory caching, and fixture separation.
"""

import os
import sys
import time
from unittest.mock import MagicMock, patch

import pytest

# Ensure backend directory is in python search path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from data_store import DataStore, store
from services.mongo_service import mongo_service


@pytest.fixture
def mock_mongo():
    """Provides a mocked connected MongoService to test persistence hooks reliably."""
    original_connected = mongo_service._is_connected
    original_db = mongo_service._db

    mock_db = MagicMock()
    mongo_service._is_connected = True
    mongo_service._db = mock_db

    yield mock_db

    mongo_service._is_connected = original_connected
    mongo_service._db = original_db


class TestProductionStatePersistence:
    """Tests write-through persistence and startup hydration for operational state."""

    def test_webhook_events_persistence(self, mock_mongo):
        """Verifies webhook events write-through to MongoDB and deduplicate on retrieval."""
        test_store = DataStore()
        payload = {"delivery_id": "test-del-12345", "repository": {"name": "SentinelOps"}}
        
        event = test_store.record_webhook_event("push", payload, status="processed", summary="Push to main")
        assert event["event"] == "push"
        assert event["deliveryId"] == "test-del-12345"
        assert test_store.webhook_events[0]["deliveryId"] == "test-del-12345"

        # Verify mongo_service.save_webhook_event was called via db mock
        mock_mongo.webhook_events.update_one.assert_called()

        # Mock MongoDB get_webhook_events return
        mock_mongo.webhook_events.find.return_value.sort.return_value.limit.return_value = [
            {
                "id": "wh-db-001",
                "deliveryId": "test-del-12345",  # Same delivery ID, should deduplicate
                "event": "push",
                "status": "processed",
                "timestamp": "2026-09-22T10:00:00Z",
            },
            {
                "id": "wh-db-002",
                "deliveryId": "test-del-67890",  # Unique delivery ID
                "event": "pull_request",
                "status": "processed",
                "timestamp": "2026-09-22T09:00:00Z",
            }
        ]

        history = test_store.get_webhook_history(limit=10)
        del_ids = [h.get("deliveryId") for h in history]
        assert "test-del-12345" in del_ids
        assert "test-del-67890" in del_ids
        # Ensure no duplicates
        assert del_ids.count("test-del-12345") == 1

    def test_agent_status_persistence_and_hydration(self, mock_mongo):
        """Verifies agent status changes persist to MongoDB and hydrate on restart."""
        test_store = DataStore()
        
        # Update agent status
        res = test_store.update_agent_status("agent-001", "paused")
        assert res is not None
        assert res["status"] == "paused"

        # Verify mongo_service.save_agent_status was called
        mock_mongo.agent_status.update_one.assert_called()

        # Simulate fresh startup hydration with persisted status
        mock_mongo.agent_status.find.return_value = [
            {"agent_id": "agent-001", "status": "paused", "last_seen": "10s ago"}
        ]
        mock_mongo.agents.find.return_value.sort.return_value = []
        mock_mongo.settings.find_one.return_value = None
        mock_mongo.deployments.find.return_value.sort.return_value.limit.return_value = []
        mock_mongo.rollbacks.find.return_value.sort.return_value.limit.return_value = []
        mock_mongo.incident_metadata.find.return_value = []
        mock_mongo.local_pipelines.find.return_value.sort.return_value.limit.return_value = []
        mock_mongo.webhook_events.find.return_value.sort.return_value.limit.return_value = []
        mock_mongo.logs.find.return_value.sort.return_value.limit.return_value = []

        restarted_store = DataStore()
        agent_001 = next(a for a in restarted_store.ai_agents if a["id"] == "agent-001")
        assert agent_001["status"] == "paused"
        assert agent_001["lastSeen"] == "10s ago"

    def test_custom_agent_persistence_and_hydration(self, mock_mongo):
        """Verifies dynamically added AI agents persist and hydrate on startup."""
        test_store = DataStore()
        custom = test_store.add_ai_agent({
            "name": "Custom-Scanner-01",
            "role": "Security Compliance",
            "capability": "Custom compliance audit",
        })
        assert custom["name"] == "Custom-Scanner-01"
        assert any(a["id"] == custom["id"] for a in test_store.ai_agents)
        mock_mongo.agents.update_one.assert_called()

        # Simulate startup hydration loading custom agent
        mock_mongo.agent_status.find.return_value = []
        mock_mongo.agents.find.return_value.sort.return_value = [
            {
                "id": "agent-999",
                "name": "Persisted-Agent-999",
                "role": "Deep Testing",
                "status": "active",
                "capability": "Extended testing",
            }
        ]
        mock_mongo.settings.find_one.return_value = None
        mock_mongo.deployments.find.return_value.sort.return_value.limit.return_value = []
        mock_mongo.rollbacks.find.return_value.sort.return_value.limit.return_value = []
        mock_mongo.incident_metadata.find.return_value = []
        mock_mongo.local_pipelines.find.return_value.sort.return_value.limit.return_value = []
        mock_mongo.webhook_events.find.return_value.sort.return_value.limit.return_value = []
        mock_mongo.logs.find.return_value.sort.return_value.limit.return_value = []

        restarted_store = DataStore()
        assert any(a["id"] == "agent-999" and a["name"] == "Persisted-Agent-999" for a in restarted_store.ai_agents)

    def test_incident_metadata_persistence_and_hydration(self, mock_mongo):
        """Verifies incident metadata overlays write-through to MongoDB and hydrate."""
        test_store = DataStore()
        meta = {
            "attempts": [{"attempt": 1, "status": "failed"}, {"attempt": 2, "status": "resolved"}],
            "attemptCount": 2,
            "timeline": [{"step": "triage", "time": "now"}],
            "mttrMetrics": {"totalRecoverySeconds": 48},
        }

        test_store.set_incident_metadata("INC-TEST-PERSIST", meta)
        assert test_store._incident_metadata.get("INC-TEST-PERSIST") == meta
        mock_mongo.incident_metadata.update_one.assert_called()

        # Simulate startup hydration
        mock_mongo.incident_metadata.find.return_value = [
            {
                "incident_id": "INC-TEST-PERSIST",
                "attempts": meta["attempts"],
                "attemptCount": 2,
                "timeline": meta["timeline"],
                "mttrMetrics": meta["mttrMetrics"],
            }
        ]
        mock_mongo.agent_status.find.return_value = []
        mock_mongo.agents.find.return_value.sort.return_value = []
        mock_mongo.settings.find_one.return_value = None
        mock_mongo.deployments.find.return_value.sort.return_value.limit.return_value = []
        mock_mongo.rollbacks.find.return_value.sort.return_value.limit.return_value = []
        mock_mongo.local_pipelines.find.return_value.sort.return_value.limit.return_value = []
        mock_mongo.webhook_events.find.return_value.sort.return_value.limit.return_value = []
        mock_mongo.logs.find.return_value.sort.return_value.limit.return_value = []

        restarted_store = DataStore()
        assert "INC-TEST-PERSIST" in restarted_store._incident_metadata
        assert restarted_store._incident_metadata["INC-TEST-PERSIST"]["attemptCount"] == 2

    def test_local_pipeline_persistence_and_hydration(self, mock_mongo):
        """Verifies locally triggered pipelines persist to MongoDB and hydrate."""
        test_store = DataStore()
        pipe = test_store.trigger_pipeline(name="Autonomous Persistence Check")
        assert pipe["name"] == "Autonomous Persistence Check"
        mock_mongo.local_pipelines.update_one.assert_called()

        # Simulate startup hydration
        mock_mongo.local_pipelines.find.return_value.sort.return_value.limit.return_value = [
            {
                "id": "pipe-restored-01",
                "name": "Restored Pipeline",
                "repo": "SentinelOps",
                "branch": "main",
                "status": "success",
                "stages": [{"name": "Checkout", "status": "success"}],
                "created_at": "2026-09-22T12:00:00Z",
            }
        ]
        mock_mongo.agent_status.find.return_value = []
        mock_mongo.agents.find.return_value.sort.return_value = []
        mock_mongo.settings.find_one.return_value = None
        mock_mongo.deployments.find.return_value.sort.return_value.limit.return_value = []
        mock_mongo.rollbacks.find.return_value.sort.return_value.limit.return_value = []
        mock_mongo.incident_metadata.find.return_value = []
        mock_mongo.webhook_events.find.return_value.sort.return_value.limit.return_value = []
        mock_mongo.logs.find.return_value.sort.return_value.limit.return_value = []

        restarted_store = DataStore()
        pipes = restarted_store.get_pipelines()
        assert any(p["id"] == "pipe-restored-01" for p in pipes)

    def test_logs_merge_and_sorting(self, mock_mongo):
        """Verifies get_logs merges MongoDB logs with memory buffer and sorts chronologically."""
        test_store = DataStore()
        test_store.logs = [
            {
                "id": "l-mem-001",
                "timestamp": "12:00:05.100",
                "created_at": "2026-09-22T12:00:05.100Z",
                "level": "INFO",
                "service": "api",
                "message": "Memory log recent",
                "traceId": "trace-mem-1",
            }
        ]

        mock_mongo.logs.find.return_value.sort.return_value.limit.return_value = [
            {
                "id": "l-db-001",
                "timestamp": "12:00:10.000",
                "created_at": "2026-09-22T12:00:10.000Z",
                "level": "INFO",
                "service": "api",
                "message": "DB log more recent",
                "traceId": "trace-db-1",
            },
            {
                "id": "l-mem-001",  # Duplicate of memory log
                "timestamp": "12:00:05.100",
                "created_at": "2026-09-22T12:00:05.100Z",
                "level": "INFO",
                "service": "api",
                "message": "Memory log duplicate",
                "traceId": "trace-mem-1",
            }
        ]

        logs = test_store.get_logs(limit=10)
        assert len(logs) == 2
        # Verify newest log first
        assert logs[0]["id"] == "l-db-001"
        assert logs[1]["id"] == "l-mem-001"

    def test_demo_anomaly_tag(self):
        """Verifies simulate_anomaly tags the generated incident with source: demo."""
        test_store = DataStore()
        inc = test_store.simulate_anomaly()
        assert inc.get("source") == "demo"
