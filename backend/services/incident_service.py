"""
Incident and Workflow Persistence Service for SentinelOps.
Handles database storage, retrieval, and updates for incidents and workflow runs.
"""

import json
from typing import Optional, List, Dict, Any
from database import get_db
from models.workflow import Repository, WorkflowRun
from models.incident import Incident


class IncidentService:
    """
    Manages persistent storage and querying for SentinelOps incidents and workflow runs.
    """

    def persist_workflow_run(self, run_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Stores or updates a workflow run and its repository in the database.
        """
        run_id = run_data.get("run_id")
        if not run_id:
            return None

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

    def persist_incident(self, incident_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Stores or updates an incident record in the database.
        """
        inc_id = incident_data.get("id")
        if not inc_id:
            return incident_data

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
                )
                db.add(inc)
            else:
                inc.status = incident_data.get("status", inc.status)
                inc.rootCause = incident_data.get("rootCause", inc.rootCause)
                inc.confidence = incident_data.get("confidence", inc.confidence)
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

    def get_incident_by_id(self, incident_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves a single incident by ID (case-insensitive) from the database.
        """
        with get_db() as db:
            inc = db.query(Incident).filter(Incident.id.ilike(incident_id)).first()
            return inc.to_dict() if inc else None

    def get_all_incidents(self, status: Optional[str] = None, search: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Fetches incidents from database with optional status and text filters.
        """
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

    def update_incident_status(self, incident_id: str, new_status: str) -> Optional[Dict[str, Any]]:
        """
        Updates the status of an existing incident in the database (case-insensitive).
        """
        with get_db() as db:
            inc = db.query(Incident).filter(Incident.id.ilike(incident_id)).first()
            if not inc:
                return None
            inc.status = new_status
            db.flush()
            return inc.to_dict()

    def delete_incident(self, incident_id: str) -> bool:
        """
        Deletes an incident by ID (case-insensitive) from the database.
        """
        with get_db() as db:
            inc = db.query(Incident).filter(Incident.id.ilike(incident_id)).first()
            if inc:
                db.delete(inc)
                db.flush()
                return True
            return False


# Singleton incident service
incident_service = IncidentService()
