import os
import time
import json
import random
import threading
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import logging
import config

class AgentMixin:
    def save_agent_reasoning(self, incident_id: str, record: dict[str, Any]) -> dict[str, Any]:
        """Saves a multi-agent reasoning execution record in memory and database."""
        if not hasattr(self, "_agent_reasoning_records"):
            self._agent_reasoning_records = {}
        norm_id = str(incident_id).strip()
        self._agent_reasoning_records[norm_id] = record

        # Sync to memory incident object if present
        for inc in self.incidents:
            if str(inc.get("id", "")).lower() == norm_id.lower():
                inc["agent_reasoning"] = record

        # Persist to database (SQLite & MongoDB)
        try:
            from services.incident_service import incident_service
            incident_service.persist_incident({"id": norm_id, "agent_reasoning": record})
        except Exception as e:
            import logging
            logging.getLogger(__name__).error('Exception in data_store', exc_info=True)

        try:
            from services.mongo_service import mongo_service
            if mongo_service.is_connected():
                mongo_service.save_agent_reasoning(norm_id, record)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error('Exception in data_store', exc_info=True)
        return record

    def get_agent_reasoning(self, incident_id: str) -> dict[str, Any] | None:
        """Retrieves a multi-agent reasoning execution record by incident ID."""
        if not hasattr(self, "_agent_reasoning_records"):
            self._agent_reasoning_records = {}
        norm_id = str(incident_id).strip()
        if norm_id in self._agent_reasoning_records:
            return self._agent_reasoning_records[norm_id]

        for k, v in self._agent_reasoning_records.items():
            if k.lower() == norm_id.lower():
                return v

        # Check in MongoDB Atlas first
        try:
            from services.mongo_service import mongo_service
            if mongo_service.is_connected():
                m_ar = mongo_service.get_agent_reasoning(norm_id)
                if m_ar:
                    return m_ar
        except Exception as e:
            import logging
            logging.getLogger(__name__).error('Exception in data_store', exc_info=True)

        # Check in incident from DB
        inc = self.get_incident(incident_id)
        if inc and inc.get("agent_reasoning"):
            ar = inc.get("agent_reasoning")
            if isinstance(ar, str):
                try:
                    return json.loads(ar)
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).error('Exception in data_store', exc_info=True)
            elif isinstance(ar, dict):
                return ar
        return None

    def get_ai_agents(self):
        return self.ai_agents

    def add_ai_agent(self, data):
        agent_id = f"agent-{len(self.ai_agents) + 1:03d}"
        new_agent = {
            "id": agent_id,
            "name": data.get("name") or f"Agent-{len(self.ai_agents) + 1}",
            "role": data.get("role") or "Autonomous Remediation",
            "status": data.get("status") or "active",
            "capability": data.get("capability") or "Workflow failure analysis and patch synthesis",
            "tasksCompleted": int(data.get("tasksCompleted", 0)),
            "currentTask": data.get("currentTask") or "Listening for CI/CD events",
            "successRate": float(data.get("successRate", 99.0)),
            "lastSeen": "just now",
            "tags": data.get("tags") or ["autonomous", "ci-cd"],
            "hostRunner": data.get("hostRunner") or "sentinel-worker",
            "modelBackend": data.get("modelBackend") or "Gemini 1.5 Pro",
        }
        self.ai_agents.append(new_agent)
        try:
            from services.mongo_service import mongo_service
            if mongo_service.is_connected():
                mongo_service.save_agent(new_agent)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error('Exception persisting agent to Mongo', exc_info=True)
        return new_agent

    def update_agent_status(self, agent_id, new_status):
        for agent in self.ai_agents:
            if agent["id"].lower() == agent_id.lower() or agent["name"].lower() == agent_id.lower():
                agent["status"] = new_status
                agent["lastSeen"] = "just now"
                self.add_log(service="agent-orchestrator", level="INFO", message=f"Agent '{agent['name']}' status updated to '{new_status}'")
                try:
                    from services.mongo_service import mongo_service
                    if mongo_service.is_connected():
                        mongo_service.save_agent_status(agent["id"], new_status, agent["lastSeen"])
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).error('Exception persisting agent status to Mongo', exc_info=True)
                return agent
        return None

