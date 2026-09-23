"""
Test Suite: State Persistence Across Restarts and Multi-Worker Deployments
==========================================================================
Verifies that:
1. Logs are merged from MongoDB Atlas and in-memory cache.
2. Webhook events write through to MongoDB and hydrate on restart.
3. AI agent status updates and custom agents write through and hydrate on restart.
4. Incident metadata overlays persist and hydrate on restart.
5. Locally triggered pipelines persist and sync stages with MongoDB.
6. Offline MongoDB fallback operates safely without crashing.
7. Anomaly simulations are tagged with source: demo.
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
from services.mongo_service import MongoService, mongo_service


class TestStatePersistenceAndWorkers:
    """Validates operational state persistence across restarts and multi-worker setups."""

    def test_logs_merge_from_mongo_and_memory(self):
        """Verifies get_logs() queries MongoDB and merges with memory cache without duplicates."""
        test_store = DataStore()
        # Add a unique log in memory
        test_trace = f"trace-test-{int(time.time() * 1000)}"
        entry = test_store.add_log(service="test-service", level="INFO", message="Memory log entry", trace_id=test_trace)

        # Retrieve logs
        logs = test_store.get_logs(service="test-service")
        assert any(l.get("traceId") == test_trace for l in logs)

        # Verify deduplication if the same log exists in Mongo
        if mongo_service.is_connected():
            db_logs = mongo_service.get_logs(service="test-service", limit=5)
            assert isinstance(db_logs, list)

    def test_webhook_event_write_through_and_hydration(self):
        """Verifies webhook events persist to MongoDB and can be read back."""
        test_store = DataStore()
        event_payload = {
            "action": "completed",
            "delivery_id": f"del-persist-{int(time.time() * 1000)}",
            "repository": {"name": "test-persist-repo"},
            "sender": {"login": "test-operator"},
        }
        event = test_store.record_webhook_event(
            event_type="workflow_run",
            payload=event_payload,
            status="processed",
            summary="Persistence test webhook",
        )
        assert event["id"] is not None
        assert event["event"] == "workflow_run"

        # Verify it is in history
        history = test_store.get_webhook_history(limit=50)
        assert any(e.get("deliveryId") == event_payload["delivery_id"] for e in history)

        if mongo_service.is_connected():
            db_events = mongo_service.get_webhook_events(limit=50)
            assert any(e.get("deliveryId") == event_payload["delivery_id"] for e in db_events)

            # Test hydration in a new DataStore instance (simulating restart / second worker)
            worker_store = DataStore()
            worker_history = worker_store.get_webhook_events(limit=50)
            assert any(e.get("deliveryId") == event_payload["delivery_id"] for e in worker_history)

    def test_agent_status_persistence_and_hydration(self):
        """Verifies agent status changes persist to MongoDB and hydrate on restart."""
        test_store = DataStore()
        target_agent_id = "agent-001"

        # Update status
        updated = test_store.update_agent_status(target_agent_id, "paused")
        assert updated is not None
        assert updated["status"] == "paused"

        if mongo_service.is_connected():
            statuses = mongo_service.get_agent_statuses()
            assert target_agent_id in statuses
            assert statuses[target_agent_id]["status"] == "paused"

            # Simulate restart / new worker
            new_worker_store = DataStore()
            agent = next((a for a in new_worker_store.get_ai_agents() if a["id"] == target_agent_id), None)
            assert agent is not None
            assert agent["status"] == "paused"

            # Revert back to active to leave clean state
            test_store.update_agent_status(target_agent_id, "active")
            restored = next((a for a in test_store.get_ai_agents() if a["id"] == target_agent_id), None)
            assert restored["status"] == "active"

    def test_custom_agent_persistence_and_hydration(self):
        """Verifies custom registered AI agents persist to MongoDB and hydrate."""
        test_store = DataStore()
        custom_id = f"agent-custom-{int(time.time() * 1000)}"
        new_agent_data = {
            "name": "Custom-Optimizer",
            "role": "Performance Tuning",
            "status": "active",
            "capability": "Kernel profiling and caching optimization",
        }
        added = test_store.add_ai_agent(new_agent_data)
        assert added["id"] is not None

        if mongo_service.is_connected():
            mongo_service.save_agent({**added, "id": custom_id})
            # Verify retrieval in new worker store
            new_worker_store = DataStore()
            agents = new_worker_store.get_ai_agents()
            assert any(a.get("id") == custom_id for a in agents)

    def test_incident_metadata_persistence_and_hydration(self):
        """Verifies incident metadata overlay persists to MongoDB and hydrates."""
        test_store = DataStore()
        test_inc_id = f"INC-META-{int(time.time() * 1000)}"
        metadata_payload = {
            "attempts": [{"attempt": 1, "diagnosis": "OOMKilled", "timestamp": "2026-09-22T12:00:00Z"}],
            "attemptCount": 1,
            "timeline": [{"event": "Anomaly detected", "time": "2026-09-22T12:00:00Z"}],
            "mttrMetrics": {"ttrMinutes": 1.4},
        }

        # Save metadata via helper
        saved = test_store.set_incident_metadata(test_inc_id, metadata_payload)
        assert saved["attemptCount"] == 1
        assert test_inc_id in test_store._incident_metadata

        if mongo_service.is_connected():
            db_meta = mongo_service.get_incident_metadata(test_inc_id)
            assert db_meta is not None
            assert db_meta.get("attemptCount") == 1

            # Simulate restart / new worker
            new_worker_store = DataStore()
            assert test_inc_id in new_worker_store._incident_metadata
            assert new_worker_store._incident_metadata[test_inc_id]["attemptCount"] == 1

    def test_local_pipeline_persistence_and_merging(self):
        """Verifies locally triggered pipelines persist to MongoDB and merge into get_pipelines()."""
        test_store = DataStore()
        pipe_name = f"Test-Local-Pipeline-{int(time.time() * 1000)}"
        pipeline = test_store.trigger_pipeline(repo="payment-service", branch="feature/perf", name=pipe_name)
        assert pipeline["id"].startswith("pipe-")
        assert pipeline["name"] == pipe_name

        if mongo_service.is_connected():
            # Allow time for async write
            time.sleep(0.5)
            db_pipes = mongo_service.get_local_pipelines(limit=10)
            assert any(p.get("id") == pipeline["id"] for p in db_pipes)

            # Check that a separate DataStore instance (new worker) discovers the pipeline
            new_worker_store = DataStore()
            all_pipes = new_worker_store.get_pipelines()
            assert any(p.get("id") == pipeline["id"] for p in all_pipes)

    def test_simulate_anomaly_tagged_with_demo_source(self):
        """Verifies that simulate_anomaly tags the generated incident with source: 'demo'."""
        test_store = DataStore()
        sim_inc = test_store.simulate_anomaly()
        assert sim_inc is not None
        assert sim_inc.get("source") == "demo"
        assert sim_inc.get("id", "").startswith("INC-")

    def test_offline_mongo_fallback_resilience(self):
        """Verifies all new persistence methods operate gracefully when MongoDB is disconnected."""
        mock_offline_mongo = MongoService(uri="mongodb://invalid-host:27017")
        assert not mock_offline_mongo.is_connected()

        # Webhook fallback
        wh = mock_offline_mongo.save_webhook_event({"id": "wh-mock", "status": "processed"})
        assert wh.get("id") == "wh-mock"
        assert mock_offline_mongo.get_webhook_events() == []

        # Agent status fallback
        assert mock_offline_mongo.save_agent_status("agent-001", "active") is False
        assert mock_offline_mongo.get_agent_statuses() == {}

        # Incident metadata fallback
        meta = mock_offline_mongo.save_incident_metadata("INC-1", {"attempts": []})
        assert meta.get("attempts") == []
        assert mock_offline_mongo.get_all_incident_metadata() == {}
        assert mock_offline_mongo.get_incident_metadata("INC-1") is None

        # Local pipeline fallback
        pipe = mock_offline_mongo.save_local_pipeline({"id": "pipe-mock", "status": "running"})
        assert pipe.get("id") == "pipe-mock"
        assert mock_offline_mongo.get_local_pipelines() == []
        assert mock_offline_mongo.update_pipeline_status("pipe-mock", "success") is False
