"""
MongoDB Atlas Persistence Service for SentinelOps.
Provides cloud document persistence for incidents, workflows, remediation records,
multi-agent reasoning traces, and audit logs with automatic resilience.
"""

import logging
import os
import time
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("sentinelops.mongo")

try:
    import pymongo
    from pymongo.errors import (
        ConnectionFailure,
        DuplicateKeyError,
        PyMongoError,
        ServerSelectionTimeoutError,
    )
    PYMONGO_AVAILABLE = True
except ImportError:
    PYMONGO_AVAILABLE = False
    pymongo = None
    PyMongoError = Exception  # type: ignore
    ServerSelectionTimeoutError = Exception  # type: ignore
    ConnectionFailure = Exception  # type: ignore
    DuplicateKeyError = Exception  # type: ignore


class MongoService:
    """
    Manages MongoDB Atlas connection and document collections for SentinelOps.
    """

    def __init__(self, uri: str | None = None, db_name: str | None = None):
        self._explicit_uri = uri is not None
        self._uri = uri or os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URI")
        self._db_name = db_name or os.environ.get("MONGODB_DB") or "sentinelops"
        self._client = None
        self._db = None
        self._is_connected = False
        self._last_ping_time = 0.0
        self._last_ping_latency = 0.0

        # Attempt initial connect if URI is present
        if self._uri and PYMONGO_AVAILABLE:
            self._connect()

    def _handle_mongo_error(self, op_name: str, ex: Exception, context: str = "") -> None:
        """Categorize and log MongoDB exceptions with appropriate severity and recovery."""
        ctx_str = f" ({context})" if context else ""
        if PYMONGO_AVAILABLE and isinstance(ex, (ServerSelectionTimeoutError, ConnectionFailure)):
            self._is_connected = False
            logger.warning(f"MongoDB transient connection/timeout failure during {op_name}{ctx_str}: {ex}")
        elif PYMONGO_AVAILABLE and isinstance(ex, DuplicateKeyError):
            logger.info(f"MongoDB duplicate key notice during {op_name}{ctx_str}: {ex}")
        elif PYMONGO_AVAILABLE and isinstance(ex, PyMongoError):
            logger.warning(f"MongoDB database operation error during {op_name}{ctx_str}: {ex}")
        else:
            logger.error(f"Unexpected non-mongo error during {op_name}{ctx_str}: {ex}", exc_info=True)

    def _connect(self) -> bool:
        """Initializes MongoClient with safe timeout configurations and robust DNS."""
        if not PYMONGO_AVAILABLE or not self._uri:
            self._is_connected = False
            return False

        # Configure public DNS fallback for reliable SRV resolution across ISPs/VPNs
        try:
            import dns.resolver
            resolver = dns.resolver.Resolver()
            resolver.nameservers = ["8.8.8.8", "1.1.1.1", "8.8.4.4"]
            resolver.lifetime = 6.0
            dns.resolver.default_resolver = resolver
        except Exception as e:
            logger.debug("Custom DNS resolver configuration skipped: %s", e)

        for attempt in range(2):
            try:
                self._client = pymongo.MongoClient(
                    self._uri,
                    serverSelectionTimeoutMS=8000,
                    connectTimeoutMS=8000,
                    socketTimeoutMS=12000,
                    maxPoolSize=20,
                    minPoolSize=1,
                    retryWrites=True,
                    w="majority",
                )
                self._db = self._client[self._db_name]
                # Quick ping probe
                start = time.time()
                self._client.admin.command("ping")
                self._last_ping_latency = round((time.time() - start) * 1000, 2)
                self._last_ping_time = time.time()
                self._is_connected = True
                self._ensure_indexes()
                logger.info(f"Connected to MongoDB Atlas: {self._db_name} ({self._last_ping_latency}ms)")
                return True
            except (ServerSelectionTimeoutError, ConnectionFailure) as ex:
                if attempt == 0 and not self._explicit_uri:
                    time.sleep(0.5)
                    continue
                logger.warning(f"MongoDB connection timeout/failure: {ex}")
                self._is_connected = False
                return False
            except PyMongoError as ex:
                logger.warning(f"MongoDB driver error during connection: {ex}")
                self._is_connected = False
                return False
            except Exception as ex:
                logger.error(f"Unexpected error during MongoDB connection setup: {ex}", exc_info=True)
                self._is_connected = False
                return False
        return False

    def _ensure_indexes(self):
        """Creates indexes for fast queries on incident IDs and timestamps."""
        if not self._is_connected or self._db is None:
            return
        try:
            self._db.incidents.create_index("id", unique=True)
            self._db.incidents.create_index([("created_at", pymongo.DESCENDING)])
            self._db.workflows.create_index("run_id", unique=True)
            self._db.agent_reasoning.create_index("incident_id", unique=True)
            self._db.audit_logs.create_index([("timestamp", pymongo.DESCENDING)])
            self._db.logs.create_index([("timestamp", pymongo.DESCENDING)])
            self._db.logs.create_index([("created_at", pymongo.DESCENDING)])
            self._db.deployments.create_index("deployment_id", unique=True)
            self._db.rollbacks.create_index("rollback_id", unique=True)
            self._db.approvals.create_index("incident_id", unique=True)
            self._db.github_actions.create_index("incident_id", unique=True)
            # New collections for full state persistence across restarts and workers
            self._db.webhook_events.create_index("id", unique=True)
            self._db.webhook_events.create_index([("timestamp", pymongo.DESCENDING)])
            self._db.agent_status.create_index("agent_id", unique=True)
            self._db.agents.create_index("id", unique=True)
            self._db.incident_metadata.create_index("incident_id", unique=True)
            self._db.local_pipelines.create_index("id", unique=True)
            self._db.local_pipelines.create_index([("created_at", pymongo.DESCENDING)])
            self._db.analytics_snapshots.create_index([("timeRange", pymongo.ASCENDING), ("timestamp", pymongo.DESCENDING)])
            self._db.microservice_telemetry.create_index("name", unique=True)
            self._db.pull_requests.create_index("id", unique=True)
        except PyMongoError as ex:
            logger.warning(f"MongoDB index creation notice: {ex}")
        except Exception as ex:
            logger.error(f"Unexpected error during index creation: {ex}", exc_info=True)

    def is_connected(self) -> bool:
        """Returns whether MongoDB is actively connected and reachable."""
        if not self._is_connected or self._client is None:
            # Re-read environment only if URI was not explicitly passed
            if not self._explicit_uri:
                cur_uri = os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URI")
                if cur_uri and cur_uri != self._uri:
                    self._uri = cur_uri
                    return self._connect()
            return False

        # Periodic health check every 60s
        if time.time() - self._last_ping_time > 60:
            try:
                start = time.time()
                self._client.admin.command("ping")
                self._last_ping_latency = round((time.time() - start) * 1000, 2)
                self._last_ping_time = time.time()
                self._is_connected = True
            except (ServerSelectionTimeoutError, ConnectionFailure):
                self._is_connected = False
            except Exception as ex:
                self._handle_mongo_error("is_connected_ping", ex)
                self._is_connected = False
        return self._is_connected

    def ping(self) -> dict[str, Any]:
        """Runs a direct admin ping command and returns status + latency."""
        if not self._uri:
            return {"ok": 0, "status": "unconfigured", "error": "MONGODB_URI not set"}
        if not PYMONGO_AVAILABLE:
            return {"ok": 0, "status": "unavailable", "error": "pymongo package not installed"}

        try:
            if self._client is None:
                self._connect()
            start = time.time()
            res = self._client.admin.command("ping")
            latency = round((time.time() - start) * 1000, 2)
            self._last_ping_latency = latency
            self._last_ping_time = time.time()
            self._is_connected = True
            return {
                "ok": int(res.get("ok", 1)),
                "status": "connected",
                "database": self._db_name,
                "latency_ms": latency,
            }
        except (ServerSelectionTimeoutError, ConnectionFailure) as ex:
            self._is_connected = False
            return {"ok": 0, "status": "disconnected", "error": str(ex)}
        except Exception as ex:
            self._handle_mongo_error("ping", ex)
            self._is_connected = False
            return {"ok": 0, "status": "error", "error": str(ex)}

    @staticmethod
    def _clean_doc(doc: dict[str, Any] | None) -> dict[str, Any] | None:
        """Removes or formats MongoDB _id for JSON serialization."""
        if not doc:
            return None
        doc = dict(doc)
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
        return doc

    # ── Incidents Collection ──────────────────────────────────────────────────

    def upsert_incident(self, incident_data: dict[str, Any]) -> dict[str, Any]:
        """Stores or updates an incident document in the incidents collection."""
        if not self.is_connected() or self._db is None:
            return incident_data

        inc_id = incident_data.get("id")
        if not inc_id:
            return incident_data

        doc = dict(incident_data)
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        if "created_at" not in doc:
            doc["created_at"] = datetime.now(timezone.utc).isoformat()

        try:
            self._db.incidents.update_one(
                {"id": inc_id},
                {"$set": doc},
                upsert=True,
            )
            return self.get_incident(inc_id) or doc
        except Exception as ex:
            self._handle_mongo_error("upsert_incident", ex, str(inc_id))
            return incident_data

    def get_incident(self, incident_id: str) -> dict[str, Any] | None:
        """Fetches a single incident by ID (case-insensitive search)."""
        if not self.is_connected() or self._db is None:
            return None

        try:
            # First attempt exact match
            doc = self._db.incidents.find_one({"id": incident_id})
            if not doc:
                # Case-insensitive regex fallback
                doc = self._db.incidents.find_one({"id": {"$regex": f"^{incident_id}$", "$options": "i"}})
            return self._clean_doc(doc)
        except Exception as ex:
            self._handle_mongo_error("get_incident", ex, str(incident_id))
            return None

    def get_all_incidents(
        self,
        status: str | None = None,
        search: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """Retrieves incidents with optional status filtering and keyword search."""
        if not self.is_connected() or self._db is None:
            return []

        query: dict[str, Any] = {}
        if status and status.lower() != "all":
            query["status"] = {"$regex": f"^{status}$", "$options": "i"}

        if search:
            search_regex = {"$regex": search, "$options": "i"}
            query["$or"] = [
                {"id": search_regex},
                {"repo": search_regex},
                {"failure": search_regex},
                {"rootCause": search_regex},
            ]

        try:
            cursor = self._db.incidents.find(query).sort("created_at", pymongo.DESCENDING).limit(limit)
            return [self._clean_doc(d) for d in cursor]
        except Exception as ex:
            self._handle_mongo_error("get_all_incidents", ex)
            return []

    def update_incident_status(self, incident_id: str, new_status: str) -> dict[str, Any] | None:
        """Updates the status of an existing incident."""
        if not self.is_connected() or self._db is None:
            return None

        try:
            res = self._db.incidents.find_one_and_update(
                {"id": {"$regex": f"^{incident_id}$", "$options": "i"}},
                {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}},
                return_document=pymongo.ReturnDocument.AFTER,
            )
            return self._clean_doc(res)
        except Exception as ex:
            self._handle_mongo_error("update_incident_status", ex, f"{incident_id} -> {new_status}")
            return None

    def delete_incident(self, incident_id: str) -> bool:
        """Deletes an incident by ID."""
        if not self.is_connected() or self._db is None:
            return False

        try:
            res = self._db.incidents.delete_one({"id": {"$regex": f"^{incident_id}$", "$options": "i"}})
            return res.deleted_count > 0
        except Exception as ex:
            self._handle_mongo_error("delete_incident", ex, str(incident_id))
            return False

    # ── Workflows Collection ──────────────────────────────────────────────────

    def upsert_workflow(self, run_data: dict[str, Any]) -> dict[str, Any] | None:
        """Stores or updates a workflow run document in the workflows collection."""
        if not self.is_connected() or self._db is None:
            return None

        run_id = run_data.get("run_id")
        if not run_id:
            return None

        doc = dict(run_data)
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()

        try:
            self._db.workflows.update_one(
                {"run_id": run_id},
                {"$set": doc},
                upsert=True,
            )
            saved = self._db.workflows.find_one({"run_id": run_id})
            return self._clean_doc(saved)
        except Exception as ex:
            self._handle_mongo_error("upsert_workflow", ex, str(run_id))
            return None

    # ── Multi-Agent Reasoning Collection ──────────────────────────────────────

    def save_agent_reasoning(self, incident_id: str, reasoning_data: dict[str, Any]) -> dict[str, Any]:
        """Stores a multi-agent reasoning trace in the agent_reasoning collection."""
        if not self.is_connected() or self._db is None:
            return reasoning_data

        doc = {
            "incident_id": str(incident_id).strip(),
            "reasoning": reasoning_data,
            "saved_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            self._db.agent_reasoning.update_one(
                {"incident_id": str(incident_id).strip()},
                {"$set": doc},
                upsert=True,
            )
            return reasoning_data
        except Exception as ex:
            self._handle_mongo_error("save_agent_reasoning", ex, str(incident_id))
            return reasoning_data

    def get_agent_reasoning(self, incident_id: str) -> dict[str, Any] | None:
        """Retrieves multi-agent reasoning trace for an incident."""
        if not self.is_connected() or self._db is None:
            return None

        try:
            doc = self._db.agent_reasoning.find_one({"incident_id": str(incident_id).strip()})
            if doc and "reasoning" in doc:
                return doc["reasoning"]
            return None
        except Exception as ex:
            self._handle_mongo_error("get_agent_reasoning", ex, str(incident_id))
            return None

    # ── Audit Logs Collection ─────────────────────────────────────────────────

    def log_audit_event(self, event_data: dict[str, Any]) -> bool:
        """Inserts an immutable audit event for compliance tracking."""
        if not self.is_connected() or self._db is None:
            return False

        doc = dict(event_data)
        if "timestamp" not in doc:
            doc["timestamp"] = datetime.now(timezone.utc).isoformat()

        try:
            self._db.audit_logs.insert_one(doc)
            return True
        except Exception as ex:
            self._handle_mongo_error("log_audit_event", ex)
            return False

    # ── Operational Settings Collection ───────────────────────────────────────

    def save_settings(self, settings_data: dict[str, Any]) -> dict[str, Any]:
        """Persists global operational settings in the settings collection."""
        if not self.is_connected() or self._db is None:
            return settings_data

        doc = dict(settings_data)
        doc["_id"] = "global_settings"
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()

        try:
            self._db.settings.replace_one(
                {"_id": "global_settings"},
                doc,
                upsert=True,
            )
            return settings_data
        except Exception as ex:
            self._handle_mongo_error("save_settings", ex)
            return settings_data

    def get_settings(self) -> dict[str, Any] | None:
        """Retrieves global operational settings from MongoDB."""
        if not self.is_connected() or self._db is None:
            return None

        try:
            doc = self._db.settings.find_one({"_id": "global_settings"})
            if doc:
                res = self._clean_doc(doc)
                if res and "_id" in res:
                    del res["_id"]
                return res
            return None
        except Exception as ex:
            self._handle_mongo_error("get_settings", ex)
            return None

    # ── Logs & Observability Collection ───────────────────────────────────────

    def save_log(self, log_entry: dict[str, Any]) -> bool:
        """Stores a structured log event in the logs collection."""
        if not self.is_connected() or self._db is None:
            return False

        doc = dict(log_entry)
        if "created_at" not in doc:
            doc["created_at"] = datetime.now(timezone.utc).isoformat()

        try:
            self._db.logs.insert_one(doc)
            return True
        except Exception as ex:
            self._handle_mongo_error("save_log", ex)
            return False

    def get_logs(
        self,
        service: str | None = None,
        level: str | None = None,
        query: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """Queries structured logs from MongoDB with filtering."""
        if not self.is_connected() or self._db is None:
            return []

        q: dict[str, Any] = {}
        if service and service.lower() != "all":
            q["service"] = {"$regex": f"^{service}$", "$options": "i"}
        if level and level.upper() != "ALL":
            q["level"] = {"$regex": f"^{level}$", "$options": "i"}
        if query:
            q["$or"] = [
                {"message": {"$regex": query, "$options": "i"}},
                {"service": {"$regex": query, "$options": "i"}},
            ]

        try:
            cursor = self._db.logs.find(q).sort("created_at", pymongo.DESCENDING).limit(limit)
            return [self._clean_doc(d) for d in cursor]
        except Exception as ex:
            self._handle_mongo_error("get_logs", ex)
            return []

    # ── Deployments Collection ────────────────────────────────────────────────

    def save_deployment(self, dep_data: dict[str, Any]) -> dict[str, Any]:
        """Persists or updates a deployment record in MongoDB."""
        if not self.is_connected() or self._db is None:
            return dep_data

        dep_id = dep_data.get("deployment_id")
        if not dep_id:
            return dep_data

        doc = dict(dep_data)
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()

        try:
            self._db.deployments.update_one(
                {"deployment_id": dep_id},
                {"$set": doc},
                upsert=True,
            )
            return dep_data
        except Exception as ex:
            self._handle_mongo_error("save_deployment", ex, str(dep_id))
            return dep_data

    def get_deployments(self, limit: int = 50) -> list[dict[str, Any]]:
        """Retrieves tracked deployments from MongoDB."""
        if not self.is_connected() or self._db is None:
            return []

        try:
            cursor = self._db.deployments.find().sort("updated_at", pymongo.DESCENDING).limit(limit)
            return [self._clean_doc(d) for d in cursor]
        except Exception as ex:
            self._handle_mongo_error("get_deployments", ex)
            return []

    def get_deployment(self, deployment_id: str) -> dict[str, Any] | None:
        """Fetches a specific deployment record by deployment ID."""
        if not self.is_connected() or self._db is None:
            return None

        try:
            doc = self._db.deployments.find_one({"deployment_id": deployment_id})
            return self._clean_doc(doc)
        except Exception as ex:
            self._handle_mongo_error("get_deployment", ex, str(deployment_id))
            return None

    # ── Rollbacks Collection ──────────────────────────────────────────────────

    def save_rollback(self, rb_data: dict[str, Any]) -> dict[str, Any]:
        """Persists or updates a rollback record in MongoDB."""
        if not self.is_connected() or self._db is None:
            return rb_data

        rb_id = rb_data.get("rollback_id")
        if not rb_id:
            return rb_data

        doc = dict(rb_data)
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()

        try:
            self._db.rollbacks.update_one(
                {"rollback_id": rb_id},
                {"$set": doc},
                upsert=True,
            )
            return rb_data
        except Exception as ex:
            self._handle_mongo_error("save_rollback", ex, str(rb_id))
            return rb_data

    def get_rollbacks(self, limit: int = 50) -> list[dict[str, Any]]:
        """Retrieves tracked rollback events from MongoDB."""
        if not self.is_connected() or self._db is None:
            return []

        try:
            cursor = self._db.rollbacks.find().sort("updated_at", pymongo.DESCENDING).limit(limit)
            return [self._clean_doc(d) for d in cursor]
        except Exception as ex:
            self._handle_mongo_error("get_rollbacks", ex)
            return []

    # ── Human Approvals Collection ────────────────────────────────────────────

    def save_approval(self, incident_id: str, record: dict[str, Any]) -> dict[str, Any]:
        """Persists human approval state and decision records in MongoDB."""
        if not self.is_connected() or self._db is None:
            return record

        clean_id = str(incident_id).strip()
        doc = dict(record)
        doc["incident_id"] = clean_id
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()

        try:
            self._db.approvals.update_one(
                {"incident_id": clean_id},
                {"$set": doc},
                upsert=True,
            )
            return record
        except Exception as ex:
            self._handle_mongo_error("save_approval", ex, str(incident_id))
            return record

    def get_approval(self, incident_id: str) -> dict[str, Any] | None:
        """Retrieves human approval state from MongoDB."""
        if not self.is_connected() or self._db is None:
            return None

        clean_id = str(incident_id).strip()
        try:
            doc = self._db.approvals.find_one({"incident_id": clean_id})
            return self._clean_doc(doc)
        except Exception as ex:
            self._handle_mongo_error("get_approval", ex, str(incident_id))
            return None

    # ── Safe Action Records (Draft PRs) Collection ────────────────────────────

    def save_action_record(self, incident_id: str, action_data: dict[str, Any]) -> dict[str, Any]:
        """Persists GitHub Draft PR safe action records in MongoDB."""
        if not self.is_connected() or self._db is None:
            return action_data

        clean_id = str(incident_id).strip()
        doc = dict(action_data)
        doc["incident_id"] = clean_id
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()

        try:
            self._db.github_actions.update_one(
                {"incident_id": clean_id},
                {"$set": doc},
                upsert=True,
            )
            return action_data
        except Exception as ex:
            self._handle_mongo_error("save_action_record", ex, str(incident_id))
            return action_data

    def get_action_record(self, incident_id: str) -> dict[str, Any] | None:
        """Retrieves GitHub Draft PR safe action record from MongoDB."""
        if not self.is_connected() or self._db is None:
            return None

        clean_id = str(incident_id).strip()
        try:
            doc = self._db.github_actions.find_one({"incident_id": clean_id})
            return self._clean_doc(doc)
        except Exception as ex:
            self._handle_mongo_error("get_action_record", ex, str(incident_id))
            return None

    # ── Webhook Events Collection ─────────────────────────────────────────────

    def save_webhook_event(self, event_data: dict[str, Any]) -> dict[str, Any]:
        """Persists a webhook event in the webhook_events collection."""
        if not self.is_connected() or self._db is None:
            return event_data

        doc = dict(event_data)
        event_id = doc.get("id")
        if not event_id:
            event_id = f"wh-{int(time.time() * 1000)}"
            doc["id"] = event_id
        if "created_at" not in doc:
            doc["created_at"] = datetime.now(timezone.utc).isoformat()
        if "timestamp" not in doc:
            doc["timestamp"] = doc["created_at"]

        try:
            self._db.webhook_events.update_one(
                {"id": event_id},
                {"$set": doc},
                upsert=True,
            )
            return event_data
        except Exception as ex:
            self._handle_mongo_error("save_webhook_event", ex, str(event_id))
            return event_data

    def get_webhook_events(self, limit: int = 50) -> list[dict[str, Any]]:
        """Retrieves recent webhook events from MongoDB."""
        if not self.is_connected() or self._db is None:
            return []

        try:
            cursor = self._db.webhook_events.find().sort("timestamp", pymongo.DESCENDING).limit(limit)
            return [self._clean_doc(d) for d in cursor]
        except Exception as ex:
            self._handle_mongo_error("get_webhook_events", ex)
            return []

    # ── AI Agent Status & Fleet Collection ───────────────────────────────────

    def save_agent_status(self, agent_id: str, status: str, last_seen: str = "just now") -> bool:
        """Persists agent status update in MongoDB."""
        if not self.is_connected() or self._db is None:
            return False

        clean_id = str(agent_id).strip()
        doc = {
            "agent_id": clean_id,
            "status": status,
            "last_seen": last_seen,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            self._db.agent_status.update_one(
                {"agent_id": clean_id},
                {"$set": doc},
                upsert=True,
            )
            return True
        except Exception as ex:
            self._handle_mongo_error("save_agent_status", ex, str(agent_id))
            return False

    def get_agent_statuses(self) -> dict[str, dict[str, Any]]:
        """Retrieves all agent status overrides from MongoDB."""
        if not self.is_connected() or self._db is None:
            return {}

        try:
            cursor = self._db.agent_status.find()
            statuses: dict[str, dict[str, Any]] = {}
            for doc in cursor:
                clean = self._clean_doc(doc)
                if clean and "agent_id" in clean:
                    statuses[clean["agent_id"]] = clean
            return statuses
        except Exception as ex:
            self._handle_mongo_error("get_agent_statuses", ex)
            return {}

    def save_agent(self, agent_data: dict[str, Any]) -> dict[str, Any]:
        """Persists a custom registered AI agent in MongoDB."""
        if not self.is_connected() or self._db is None:
            return agent_data

        agent_id = agent_data.get("id")
        if not agent_id:
            return agent_data

        doc = dict(agent_data)
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()

        try:
            self._db.agents.update_one(
                {"id": agent_id},
                {"$set": doc},
                upsert=True,
            )
            return agent_data
        except Exception as ex:
            self._handle_mongo_error("save_agent", ex, str(agent_id))
            return agent_data

    def get_agents(self) -> list[dict[str, Any]]:
        """Retrieves custom registered AI agents from MongoDB."""
        if not self.is_connected() or self._db is None:
            return []

        try:
            cursor = self._db.agents.find().sort("id", pymongo.ASCENDING)
            return [self._clean_doc(d) for d in cursor]
        except Exception as ex:
            self._handle_mongo_error("get_agents", ex)
            return []

    # Alias for API compatibility
    get_custom_agents = get_agents

    # ── Incident Metadata Overlay Collection ──────────────────────────────────

    def save_incident_metadata(self, incident_id: str, metadata: dict[str, Any]) -> dict[str, Any]:
        """Persists incident metadata overlay (attempts, timeline, health, rollback) in MongoDB."""
        if not self.is_connected() or self._db is None:
            return metadata

        clean_id = str(incident_id).strip()
        doc = dict(metadata)
        doc["incident_id"] = clean_id
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()

        try:
            self._db.incident_metadata.update_one(
                {"incident_id": clean_id},
                {"$set": doc},
                upsert=True,
            )
            return metadata
        except Exception as ex:
            self._handle_mongo_error("save_incident_metadata", ex, str(clean_id))
            return metadata

    def get_all_incident_metadata(self) -> dict[str, dict[str, Any]]:
        """Retrieves all incident metadata overlays mapped by incident_id."""
        if not self.is_connected() or self._db is None:
            return {}

        try:
            cursor = self._db.incident_metadata.find()
            result: dict[str, dict[str, Any]] = {}
            for doc in cursor:
                clean = self._clean_doc(doc)
                if clean and "incident_id" in clean:
                    inc_id = clean["incident_id"]
                    # Do not leak MongoDB internal or lookup keys into the overlay
                    overlay = {k: v for k, v in clean.items() if k not in ["_id", "incident_id"]}
                    result[inc_id] = overlay
            return result
        except Exception as ex:
            self._handle_mongo_error("get_all_incident_metadata", ex)
            return {}

    def get_incident_metadata(self, incident_id: str) -> dict[str, Any] | None:
        """Retrieves incident metadata overlay for a specific incident."""
        if not self.is_connected() or self._db is None:
            return None

        clean_id = str(incident_id).strip()
        try:
            doc = self._db.incident_metadata.find_one({"incident_id": clean_id})
            clean = self._clean_doc(doc)
            if clean:
                return {k: v for k, v in clean.items() if k not in ["_id", "incident_id"]}
            return None
        except Exception as ex:
            self._handle_mongo_error("get_incident_metadata", ex, str(clean_id))
            return None

    # ── Locally Triggered Pipelines Collection ────────────────────────────────

    def save_local_pipeline(self, pipeline_data: dict[str, Any]) -> dict[str, Any]:
        """Persists a locally triggered pipeline in MongoDB."""
        if not self.is_connected() or self._db is None:
            return pipeline_data

        pipe_id = pipeline_data.get("id")
        if not pipe_id:
            return pipeline_data

        doc = dict(pipeline_data)
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        if "created_at" not in doc:
            doc["created_at"] = datetime.now(timezone.utc).isoformat()

        try:
            self._db.local_pipelines.update_one(
                {"id": pipe_id},
                {"$set": doc},
                upsert=True,
            )
            return pipeline_data
        except Exception as ex:
            self._handle_mongo_error("save_local_pipeline", ex, str(pipe_id))
            return pipeline_data

    def get_local_pipelines(self, limit: int = 50) -> list[dict[str, Any]]:
        """Retrieves locally triggered pipelines from MongoDB."""
        if not self.is_connected() or self._db is None:
            return []

        try:
            cursor = self._db.local_pipelines.find().sort("created_at", pymongo.DESCENDING).limit(limit)
            return [self._clean_doc(d) for d in cursor]
        except Exception as ex:
            self._handle_mongo_error("get_local_pipelines", ex)
            return []

    def update_pipeline_status(
        self,
        pipeline_id: str,
        status: str,
        stages: list[dict[str, Any]] | None = None,
        duration: str | None = None,
        ai_fixed: bool | None = None,
    ) -> bool:
        """Updates status, stages, duration and aiFixed flag for a local pipeline."""
        if not self.is_connected() or self._db is None:
            return False

        update_fields: dict[str, Any] = {
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if stages is not None:
            update_fields["stages"] = stages
        if duration is not None:
            update_fields["duration"] = duration
        if ai_fixed is not None:
            update_fields["aiFixed"] = ai_fixed

        try:
            res = self._db.local_pipelines.update_one(
                {"id": pipeline_id},
                {"$set": update_fields},
            )
            return res.modified_count > 0 or res.matched_count > 0
        except Exception as ex:
            self._handle_mongo_error("update_pipeline_status", ex, str(pipeline_id))
            return False

    # ── Analytics Snapshots & Time-Series ─────────────────────────────────────

    def save_analytics_snapshot(self, time_range: str, snapshot_data: dict[str, Any]) -> dict[str, Any]:
        """Persists a computed analytics snapshot in the analytics_snapshots collection."""
        if not self.is_connected() or self._db is None:
            return snapshot_data

        doc = dict(snapshot_data)
        doc["timeRange"] = time_range
        doc["timestamp"] = datetime.now(timezone.utc).isoformat()

        try:
            self._db.analytics_snapshots.insert_one(doc)
            return self._clean_doc(doc) or doc
        except Exception as ex:
            self._handle_mongo_error("save_analytics_snapshot", ex, time_range)
            return snapshot_data

    def get_latest_analytics_snapshot(self, time_range: str = "30d") -> dict[str, Any] | None:
        """Retrieves the most recent analytics snapshot for a given time range."""
        if not self.is_connected() or self._db is None:
            return None

        try:
            doc = self._db.analytics_snapshots.find_one(
                {"timeRange": time_range},
                sort=[("timestamp", pymongo.DESCENDING)],
            )
            return self._clean_doc(doc)
        except Exception as ex:
            self._handle_mongo_error("get_latest_analytics_snapshot", ex, time_range)
            return None

    def get_analytics_snapshots_history(self, time_range: str | None = None, limit: int = 30) -> list[dict[str, Any]]:
        """Retrieves historical analytics snapshots for trend tracking."""
        if not self.is_connected() or self._db is None:
            return []

        query = {"timeRange": time_range} if time_range else {}
        try:
            cursor = self._db.analytics_snapshots.find(query).sort("timestamp", pymongo.DESCENDING).limit(limit)
            return [self._clean_doc(d) for d in cursor]
        except Exception as ex:
            self._handle_mongo_error("get_analytics_snapshots_history", ex)
            return []

    # ── Microservice Telemetry Collection ─────────────────────────────────────

    def save_microservice_telemetry(self, telemetry_list: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Upserts a list of microservice telemetry records in MongoDB."""
        if not self.is_connected() or self._db is None:
            return telemetry_list

        updated_records = []
        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            for item in telemetry_list:
                name = item.get("name")
                if not name:
                    continue
                doc = dict(item)
                doc["updated_at"] = now_iso
                self._db.microservice_telemetry.update_one(
                    {"name": name},
                    {"$set": doc},
                    upsert=True,
                )
                updated_records.append(doc)
            return updated_records
        except Exception as ex:
            self._handle_mongo_error("save_microservice_telemetry", ex)
            return telemetry_list

    def get_microservice_telemetry(self) -> list[dict[str, Any]]:
        """Retrieves all tracked microservice telemetry records from MongoDB."""
        if not self.is_connected() or self._db is None:
            return []

        try:
            cursor = self._db.microservice_telemetry.find().sort("name", pymongo.ASCENDING)
            return [self._clean_doc(d) for d in cursor]
        except Exception as ex:
            self._handle_mongo_error("get_microservice_telemetry", ex)
            return []

    # ── Pull Requests Collection ──────────────────────────────────────────────

    def save_pull_request(self, pr_data: dict[str, Any]) -> dict[str, Any]:
        """Persists or updates a pull request record in MongoDB."""
        if not self.is_connected() or self._db is None:
            return pr_data

        pr_id = pr_data.get("id") or f"pr-{pr_data.get('number')}"
        doc = dict(pr_data)
        doc["id"] = pr_id
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        if "created_at" not in doc:
            doc["created_at"] = datetime.now(timezone.utc).isoformat()

        try:
            self._db.pull_requests.update_one(
                {"id": pr_id},
                {"$set": doc},
                upsert=True,
            )
            return pr_data
        except Exception as ex:
            self._handle_mongo_error("save_pull_request", ex, str(pr_id))
            return pr_data

    def get_all_pull_requests(self, limit: int = 50) -> list[dict[str, Any]]:
        """Retrieves tracked pull requests from MongoDB."""
        if not self.is_connected() or self._db is None:
            return []

        try:
            cursor = self._db.pull_requests.find().sort("created_at", pymongo.DESCENDING).limit(limit)
            return [self._clean_doc(d) for d in cursor]
        except Exception as ex:
            self._handle_mongo_error("get_all_pull_requests", ex)
            return []

    def update_pull_request_status(
        self,
        pr_id: str,
        status: str,
        score: int | None = None,
        comment: str | None = None,
    ) -> bool:
        """Updates PR status, AI score, and comment in MongoDB."""
        if not self.is_connected() or self._db is None:
            return False

        update_fields: dict[str, Any] = {
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if score is not None:
            update_fields["aiReviewScore"] = score
        if comment is not None:
            update_fields["aiComment"] = comment

        try:
            res = self._db.pull_requests.update_one(
                {"$or": [{"id": pr_id}, {"id": f"pr-{pr_id}"}, {"number": int(pr_id) if str(pr_id).isdigit() else -1}]},
                {"$set": update_fields},
            )
            return res.modified_count > 0 or res.matched_count > 0
        except Exception as ex:
            self._handle_mongo_error("update_pull_request_status", ex, str(pr_id))
            return False

    # ── Telemetry & Statistics ────────────────────────────────────────────────

    def get_stats(self) -> dict[str, Any]:
        """Returns collection counts and database diagnostic statistics."""
        if not self.is_connected() or self._db is None:
            return {
                "connected": False,
                "database": self._db_name,
                "error": "Not connected to MongoDB Atlas",
            }

        try:
            return {
                "connected": True,
                "database": self._db_name,
                "latency_ms": self._last_ping_latency,
                "collections": {
                    "incidents": self._db.incidents.count_documents({}),
                    "workflows": self._db.workflows.count_documents({}),
                    "agent_reasoning": self._db.agent_reasoning.count_documents({}),
                    "audit_logs": self._db.audit_logs.count_documents({}),
                    "logs": self._db.logs.count_documents({}),
                    "settings": self._db.settings.count_documents({}),
                    "deployments": self._db.deployments.count_documents({}),
                    "rollbacks": self._db.rollbacks.count_documents({}),
                    "approvals": self._db.approvals.count_documents({}),
                    "github_actions": self._db.github_actions.count_documents({}),
                    "webhook_events": self._db.webhook_events.count_documents({}),
                    "agent_status": self._db.agent_status.count_documents({}),
                    "incident_metadata": self._db.incident_metadata.count_documents({}),
                    "local_pipelines": self._db.local_pipelines.count_documents({}),
                    "analytics_snapshots": self._db.analytics_snapshots.count_documents({}),
                    "microservice_telemetry": self._db.microservice_telemetry.count_documents({}),
                    "pull_requests": self._db.pull_requests.count_documents({}),
                },
            }
        except Exception as ex:
            self._handle_mongo_error("get_stats", ex)
            return {
                "connected": False,
                "database": self._db_name,
                "error": str(ex),
            }


# Singleton MongoDB service instance
mongo_service = MongoService()
