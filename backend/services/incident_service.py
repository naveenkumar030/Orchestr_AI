"""
Incident and Workflow Persistence Service for SentinelOps.
Handles database storage, retrieval, and updates for incidents and workflow runs.
"""

import json
import logging
from typing import Any

from database import get_db
from models.incident import Incident
from models.workflow import Repository, WorkflowRun

from services.mongo_service import mongo_service

logger = logging.getLogger("sentinelops.incident_service")


class IncidentService:
    """
    Manages persistent storage and querying for SentinelOps incidents and workflow runs.
    """

    def persist_workflow_run(self, run_data: dict[str, Any]) -> dict[str, Any] | None:
        """
        Stores or updates a workflow run and its repository in the database (MongoDB + SQLite).
        """
        run_id = run_data.get("run_id")
        if not run_id:
            return None

        # Persist to MongoDB Atlas if connected
        try:
            if mongo_service.is_connected():
                mongo_service.upsert_workflow(run_data)
        except Exception as e:
            logger.warning("Failed to upsert workflow run %s to MongoDB: %s", run_id, e)

        repo_name = run_data.get("repository", "SentinelOps")
        short_repo = repo_name.split("/")[-1]

        with get_db() as db:
            # Upsert Repository
            repo = db.query(Repository).filter_by(full_name=repo_name).first()
            if not repo:
                repo = Repository(
                    name=short_repo,
                    full_name=repo_name,
                    owner=repo_name.split("/")[0] if "/" in repo_name else None,
                    default_branch=run_data.get("branch", "main"),
                )
                db.add(repo)
                db.flush()

            # Upsert WorkflowRun
            wf = db.query(WorkflowRun).filter_by(run_id=run_id).first()
            if not wf:
                wf = WorkflowRun(
                    run_id=run_id,
                    repository_id=repo.id,
                    repo_name=repo_name,
                    name=run_data.get("workflow_name", "CI/CD Workflow"),
                    branch=run_data.get("branch", "main"),
                    commit_sha=run_data.get("commit_sha", "HEAD"),
                    status=run_data.get("status", "completed"),
                    conclusion=run_data.get("conclusion"),
                    actor=run_data.get("actor"),
                    event_type=run_data.get("event_type", "workflow_run"),
                    html_url=run_data.get("html_url", ""),
                )
                db.add(wf)
            else:
                wf.status = run_data.get("status", wf.status)
                wf.conclusion = run_data.get("conclusion", wf.conclusion)
                wf.commit_sha = run_data.get("commit_sha", wf.commit_sha)

            db.flush()
            return wf.to_dict()

    def persist_incident(self, incident_data: dict[str, Any]) -> dict[str, Any]:
        """
        Stores or updates an incident record in the database (MongoDB Atlas + SQLite).
        """
        inc_id = incident_data.get("id")
        if not inc_id:
            return incident_data

        # Persist to MongoDB Atlas first if connected
        try:
            if mongo_service.is_connected():
                mongo_service.upsert_incident(incident_data)
        except Exception as e:
            logger.warning("Failed to upsert incident %s to MongoDB: %s", inc_id, e)

        source_val = incident_data.get("source", "webhook")

        with get_db() as db:
            inc = db.query(Incident).filter_by(id=inc_id).first()
            if not inc:
                inc = Incident(
                    id=inc_id,
                    repo=incident_data.get("repo", "SentinelOps"),
                    pipeline=incident_data.get("pipeline", "CI/CD Workflow"),
                    failure=incident_data.get("failure", "Workflow failure"),
                    rootCause=incident_data.get("rootCause", "Under investigation"),
                    confidence=incident_data.get("confidence", 0),
                    confidenceColor=incident_data.get("confidenceColor", "primary"),
                    status=incident_data.get("status", "Investigating"),
                    time=incident_data.get("time", "just now"),
                    runId=incident_data.get("runId"),
                    branch=incident_data.get("branch"),
                    commit=incident_data.get("commit"),
                    actionLabel=incident_data.get("actionLabel", "Investigate"),
                    actionVariant=incident_data.get("actionVariant", "primary"),
                    prNumber=incident_data.get("prNumber"),
                    prUrl=incident_data.get("prUrl"),
                    remediationBranch=incident_data.get("remediationBranch"),
                    diff=incident_data.get("diff"),
                    agent_reasoning=json.dumps(incident_data["agent_reasoning"]) if isinstance(incident_data.get("agent_reasoning"), (dict, list)) else incident_data.get("agent_reasoning"),
                    source=source_val,
                )
                db.add(inc)
            else:
                inc.status = incident_data.get("status", inc.status)
                inc.rootCause = incident_data.get("rootCause", inc.rootCause)
                inc.confidence = incident_data.get("confidence", inc.confidence)
                if incident_data.get("source") is not None:
                    inc.source = incident_data.get("source")
                if incident_data.get("prNumber") is not None:
                    inc.prNumber = incident_data.get("prNumber")
                if incident_data.get("prUrl") is not None:
                    inc.prUrl = incident_data.get("prUrl")
                if incident_data.get("remediationBranch") is not None:
                    inc.remediationBranch = incident_data.get("remediationBranch")
                if incident_data.get("diff") is not None:
                    inc.diff = incident_data.get("diff")
                if incident_data.get("agent_reasoning") is not None:
                    ar = incident_data.get("agent_reasoning")
                    inc.agent_reasoning = json.dumps(ar) if isinstance(ar, (dict, list)) else ar

            db.flush()
            return inc.to_dict()

    def get_incident_by_id(self, incident_id: str) -> dict[str, Any] | None:
        """
        Retrieves a single incident by ID or runId (case-insensitive) from MongoDB Atlas or SQLite.
        """
        clean_id = str(incident_id).strip()
        raw_num = clean_id.upper().replace("INC-", "").strip()

        # Try MongoDB Atlas first
        try:
            if mongo_service.is_connected():
                doc = mongo_service.get_incident(clean_id)
                if not doc and raw_num.isdigit():
                    # Check by runId in mongo
                    clean_doc = mongo_service._clean_doc(
                        mongo_service._db.incidents.find_one({"runId": int(raw_num)})
                    ) if mongo_service._db is not None else None
                    if clean_doc:
                        return clean_doc
                if doc:
                    return doc
        except Exception as e:
            logger.warning("Failed to fetch incident %s from MongoDB: %s", clean_id, e)

        # Fallback to SQLite
        with get_db() as db:
            inc = db.query(Incident).filter(Incident.id.ilike(clean_id)).first()
            if not inc and raw_num.isdigit():
                inc = db.query(Incident).filter(Incident.runId == int(raw_num)).first()
            return inc.to_dict() if inc else None

    def get_all_incidents(self, status: str | None = None, search: str | None = None) -> list[dict[str, Any]]:
        """
        Fetches incidents from database with optional status and text filters.
        """
        # Try MongoDB Atlas if connected
        try:
            if mongo_service.is_connected():
                docs = mongo_service.get_all_incidents(status=status, search=search)
                if docs and len(docs) > 0:
                    return docs
        except Exception as e:
            logger.warning("Failed to fetch all incidents from MongoDB: %s", e)

        # Fallback to SQLite
        with get_db() as db:
            query = db.query(Incident).order_by(Incident.created_at.desc())
            if status and status.lower() != "all":
                query = query.filter(Incident.status.ilike(status))
            records = query.all()

            results = [r.to_dict() for r in records]
            if search:
                s = search.lower()
                results = [
                    r for r in results
                    if s in r.get("id", "").lower()
                    or s in r.get("repo", "").lower()
                    or s in r.get("failure", "").lower()
                    or s in (r.get("rootCause") or "").lower()
                ]
            return results

    def update_incident_status(self, incident_id: str, new_status: str) -> dict[str, Any] | None:
        """
        Updates the status of an existing incident in MongoDB Atlas and SQLite.
        """
        # Update MongoDB Atlas
        try:
            if mongo_service.is_connected():
                mongo_service.update_incident_status(incident_id, new_status)
        except Exception as e:
            logger.warning("Failed to update incident %s status in MongoDB: %s", incident_id, e)

        # Update SQLite
        with get_db() as db:
            inc = db.query(Incident).filter(Incident.id.ilike(incident_id)).first()
            if not inc:
                return None
            inc.status = new_status
            db.flush()
            return inc.to_dict()

    def delete_incident(self, incident_id: str) -> bool:
        """
        Deletes an incident by ID from MongoDB Atlas and SQLite.
        """
        # Delete from MongoDB Atlas
        try:
            if mongo_service.is_connected():
                mongo_service.delete_incident(incident_id)
        except Exception as e:
            logger.warning("Failed to delete incident %s from MongoDB: %s", incident_id, e)

        # Delete from SQLite
        with get_db() as db:
            inc = db.query(Incident).filter(Incident.id.ilike(incident_id)).first()
            if inc:
                db.delete(inc)
                db.flush()
                return True
            return False


# Singleton incident service
incident_service = IncidentService()
