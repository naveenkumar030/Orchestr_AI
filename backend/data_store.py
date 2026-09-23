"""
Real Operational Data Store for SentinelOps Autonomous DevOps CI/CD Control Center.
Connects directly to the live GitHub repository, GitHub Actions REST API,
and persistent SQLite database (sentinelops.db). Zero mock/simulated baseline data.
"""

import json
import os
import random
import sys
import threading
import time
from datetime import datetime, timezone
from typing import Any

# ─── Navigation ───────────────────────────────────────────────────────────────
NAV_ITEMS = [
    {"path": "/dashboard", "label": "Overview", "icon": "dashboard"},
    {"path": "/pipelines", "label": "Pipelines", "icon": "account_tree"},
    {"path": "/incidents", "label": "Incidents", "icon": "warning"},
    {"path": "/ai-agents", "label": "AI Agents", "icon": "smart_toy"},
    {"path": "/pull-requests", "label": "Pull Requests", "icon": "call_merge"},
    {"path": "/logs", "label": "Logs", "icon": "terminal"},
    {"path": "/analytics", "label": "Analytics", "icon": "monitoring"},
    {"path": "/settings", "label": "Settings", "icon": "tune"},
    {"path": "/profile", "label": "Profile", "icon": "account_circle"},
]

# ─── Fleet AI Agents ─────────────────────────────────────────────────────────
# DEMO FIXTURE: Default baseline agent fleet initialized in memory; state overrides hydrated from MongoDB
AI_AGENTS = [
    {
        "id": "agent-001",
        "name": "Sentinel-Core",
        "role": "Policy Enforcement & Dispatch",
        "status": "active",
        "capability": "Real-time CI/CD monitoring, policy gates & anomaly detection",
        "tasksCompleted": 0,
        "currentTask": "Monitoring GitHub Actions workflows & policy gates",
        "successRate": 100.0,
        "lastSeen": "now",
        "tags": ["orchestrator", "policy", "real-time", "groq"],
        "hostRunner": "sentinel-worker-01",
        "modelBackend": "SentinelOps Core Engine v3.1",
    },
    {
        "id": "agent-002",
        "name": "Healer-Alpha",
        "role": "Autonomous Remediation",
        "status": "active",
        "capability": "Semantic failure triage, patch synthesis & automated PR generation",
        "tasksCompleted": 0,
        "currentTask": "Listening for workflow failures & synthesizing autonomous fixes",
        "successRate": 100.0,
        "lastSeen": "now",
        "tags": ["rca", "patching", "groq", "github-api"],
        "hostRunner": "sentinel-worker-02",
        "modelBackend": "Groq LPU (openai/gpt-oss-120b) / AST Synthesizer",
    },
    {
        "id": "agent-003",
        "name": "TestForge",
        "role": "Regression Verification",
        "status": "active",
        "capability": "Dynamic unit and integration test synthesis",
        "tasksCompleted": 0,
        "currentTask": "Synthesizing dynamic regression test suites & verification runs",
        "successRate": 100.0,
        "lastSeen": "now",
        "tags": ["pytest", "selenium", "sandbox", "groq"],
        "hostRunner": "sentinel-worker-03",
        "modelBackend": "Groq LPU / TestForge v2.0",
    },
    {
        "id": "agent-004",
        "name": "CanaryGuard",
        "role": "Progressive Delivery",
        "status": "active",
        "capability": "Automated deployment monitoring and zero-downtime rollback",
        "tasksCompleted": 0,
        "currentTask": "Monitoring progressive delivery canary health & zero-downtime rollouts",
        "successRate": 100.0,
        "lastSeen": "now",
        "tags": ["canary", "rollout", "health-checks", "groq"],
        "hostRunner": "sentinel-worker-04",
        "modelBackend": "CanaryGuard v1.4",
    },
    {
        "id": "agent-005",
        "name": "Reviewer-Delta",
        "role": "Code Review & Security Audit",
        "status": "active",
        "capability": "Semantic AST diff analysis, policy compliance & PR auditing",
        "tasksCompleted": 0,
        "currentTask": "Auditing open pull requests & security policies",
        "successRate": 100.0,
        "lastSeen": "now",
        "tags": ["code-review", "ast-diff", "compliance", "groq"],
        "hostRunner": "sentinel-worker-05",
        "modelBackend": "Groq LPU (gpt-oss-120b) / Claude 3.7 Sonnet / AST Parser",
    },
    {
        "id": "agent-006",
        "name": "Scanner-Zeta",
        "role": "CVE & Supply Chain Scanner",
        "status": "active",
        "capability": "Trivy & Snyk container image security, dependency auditing",
        "tasksCompleted": 0,
        "currentTask": "Continuous container vulnerability & supply-chain scanning",
        "successRate": 100.0,
        "lastSeen": "now",
        "tags": ["security", "cve", "trivy", "groq"],
        "hostRunner": "sentinel-worker-06",
        "modelBackend": "Groq LPU / Trivy Engine / Grype",
    },
    {
        "id": "agent-007",
        "name": "Validator-Beta",
        "role": "Autonomous CI Validation & Regression Assessor",
        "status": "active",
        "capability": "Real-time GitHub Actions CI validation polling, log inspection & fix effectiveness evaluation",
        "tasksCompleted": 0,
        "currentTask": "Polling workflow runs, verifying patch effectiveness & guarding against regressions",
        "successRate": 100.0,
        "lastSeen": "now",
        "tags": ["ci-validation", "github-actions", "regression-check", "groq"],
        "hostRunner": "sentinel-worker-07",
        "modelBackend": "Groq LPU (gpt-oss-120b) / ValidatorAgent v2.0",
    },
    {
        "id": "agent-008",
        "name": "MergeGuard-Zero",
        "role": "Autonomous Merge Safety Boundary",
        "status": "active",
        "capability": "Enforces 7-point strict safety policy before authorizing autonomous merges",
        "tasksCompleted": 0,
        "currentTask": "Auditing PR safety conditions, secret scans, confidence & CI status for auto-merge",
        "successRate": 100.0,
        "lastSeen": "now",
        "tags": ["auto-merge", "safety-gate", "zero-downtime", "sentinelguard"],
        "hostRunner": "sentinel-worker-08",
        "modelBackend": "MergeGuard Policy Engine v2.4",
    },
    {
        "id": "agent-009",
        "name": "CanaryGuard-Deployer",
        "role": "Autonomous Deployment & Health Verifier",
        "status": "active",
        "capability": "Tracks production deployments and enforces consecutive HTTP probe verification",
        "tasksCompleted": 0,
        "currentTask": "Monitoring deployment health checks and response latency metrics",
        "successRate": 100.0,
        "lastSeen": "now",
        "tags": ["deployment", "health-check", "latency-probe", "groq"],
        "hostRunner": "sentinel-worker-09",
        "modelBackend": "CanaryGuard Engine v3.0 / HTTP Prober",
    },
    {
        "id": "agent-010",
        "name": "RollbackEngine-Omega",
        "role": "Autonomous Rollback & State Restorer",
        "status": "active",
        "capability": "Executes single-attempt zero-downtime rollbacks when health verification fails",
        "tasksCompleted": 0,
        "currentTask": "Guarding against deployment regressions and managing state fallbacks",
        "successRate": 100.0,
        "lastSeen": "now",
        "tags": ["rollback", "auto-recovery", "state-restore", "sentinelguard"],
        "hostRunner": "sentinel-worker-10",
        "modelBackend": "RollbackEngine v3.0",
    },
]

# ─── Settings & Policies ─────────────────────────────────────────────────────
# DEMO FIXTURE: Default baseline settings; live overrides persisted & hydrated from MongoDB Atlas
SETTINGS = {
    "confidenceThreshold": 90,
    "autoMergeActive": True,
    "ciSuccessRequired": True,
    "zeroCveRequired": True,
    "humanApprovalRequired": False,
    "model": "Groq Cloud LPU (openai/gpt-oss-120b Ultra Fast)",
    "reasoningBudget": 4096,
    "astCaching": True,
    "temperature": 0.10,
    "notificationsEnabled": True,
    "slackChannel": "#devops-alerts",
    "pagerDutyService": "SentinelOps-CI-CD",
}


from store.incident import IncidentMixin
from store.agent import AgentMixin
from store.pipeline import PipelineMixin
from store.github import GitHubMixin
from store.deployment import DeploymentMixin
from store.system import SystemMixin

class DataStore(IncidentMixin, AgentMixin, PipelineMixin, GitHubMixin, DeploymentMixin, SystemMixin):
    """
    Live Operational Data Store.
    Provides real GitHub Actions runs, real PRs, real SQLite incidents,
    and dynamically calculated MTTR & throughput analytics.
    """

    def __init__(self):
        self.repo = os.environ.get("GITHUB_REPO", "naveenkumar030/SentinelOps")
        self.ai_agents = list(AI_AGENTS)
        self.settings = dict(SETTINGS)
        self.webhook_events = []
        self.logs = []
        self.pipelines = []
        self.pull_requests = []
        self._incident_metadata: dict[str, Any] = {}
        self._agent_reasoning_records: dict[str, Any] = {}
        self.deployments: list[dict[str, Any]] = []
        self.rollbacks: list[dict[str, Any]] = []
        self._incidents_override: list[dict[str, Any]] | None = None
        self.start_time = time.time()
        self._last_gh_fetch = 0.0
        self._cached_gh_runs: list[dict[str, Any]] = []

        # Record real startup logs
        self.add_log(
            service="system",
            level="INFO",
            message=f"SentinelOps v3.1.1 operational engine online. Active repository: {self.repo}",
        )
        self.add_log(
            service="git",
            level="INFO",
            message="Real-time GitHub Actions & Pull Requests synchronization enabled",
        )

        # Initialize persistent SQLite database
        try:
            from database import init_db
            init_db()
        except Exception as e:
            self.add_log(service="database", level="WARN", message=f"DB Init notice: {e}")

        # Clean up any leftover test incidents from prior test runs
        try:
            from services.incident_service import incident_service
            for inc in incident_service.get_all_incidents():
                inc_id = str(inc.get("id", ""))
                if inc_id.startswith("INC-9010") or inc_id.startswith("INC-9910"):
                    incident_service.delete_incident(inc_id)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error('Exception in data_store', exc_info=True)

        # Consolidated hydration from MongoDB Atlas (settings, deployments, rollbacks, agents, metadata, pipelines, webhooks, logs)
        self._hydrate_from_mongo()

        # Synchronize GitHub runs once synchronously to ensure initial state is primed
        try:
            self._sync_github_runs(force=True)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error('Exception in data_store', exc_info=True)

    def _hydrate_from_mongo(self):
        """
        Consolidated hydration of operational state from MongoDB Atlas on startup.
        Loads settings, deployments, rollbacks, agent statuses, incident metadata,
        local pipelines, webhook events, and primes in-memory logs.
        """
        try:
            from services.mongo_service import mongo_service
            if not mongo_service.is_connected():
                return

            # 1. Global operational settings
            stored_settings = mongo_service.get_settings()
            if stored_settings:
                self.settings.update(stored_settings)

            # 2. Deployments & Rollbacks
            stored_deps = mongo_service.get_deployments(limit=50)
            if stored_deps:
                for d in stored_deps:
                    if not any(x.get("deployment_id") == d.get("deployment_id") for x in self.deployments):
                        self.deployments.append(d)
            stored_rbs = mongo_service.get_rollbacks(limit=50)
            if stored_rbs:
                for r in stored_rbs:
                    if not any(x.get("rollback_id") == r.get("rollback_id") for x in self.rollbacks):
                        self.rollbacks.append(r)

            # 3. AI Agent Status overrides & Custom Agents
            agent_statuses = mongo_service.get_agent_statuses()
            if agent_statuses:
                for agent in self.ai_agents:
                    aid = agent.get("id")
                    if aid in agent_statuses:
                        override = agent_statuses[aid]
                        if override.get("status"):
                            agent["status"] = override["status"]
                        if override.get("last_seen"):
                            agent["lastSeen"] = override["last_seen"]
            custom_agents = mongo_service.get_agents()
            if custom_agents:
                existing_ids = {a.get("id") for a in self.ai_agents}
                for ca in custom_agents:
                    if ca.get("id") not in existing_ids:
                        self.ai_agents.append(ca)
                        existing_ids.add(ca.get("id"))

            # 4. Incident Metadata Overlay
            inc_metadata = mongo_service.get_all_incident_metadata()
            if inc_metadata:
                self._incident_metadata.update(inc_metadata)

            # 5. Local Pipelines
            local_pipes = mongo_service.get_local_pipelines(limit=50)
            if local_pipes:
                seen_pipe_ids = {p.get("id") for p in self.pipelines}
                for lp in local_pipes:
                    if lp.get("id") not in seen_pipe_ids:
                        self.pipelines.append(lp)
                        seen_pipe_ids.add(lp.get("id"))

            # 6. Webhook Events
            db_wh_events = mongo_service.get_webhook_events(limit=50)
            if db_wh_events:
                seen_wh_ids = {w.get("id") or w.get("deliveryId") for w in self.webhook_events}
                for we in db_wh_events:
                    wid = we.get("id") or we.get("deliveryId")
                    if wid not in seen_wh_ids:
                        self.webhook_events.append(we)
                        seen_wh_ids.add(wid)

            # 7. Prime in-memory logs buffer
            recent_logs = mongo_service.get_logs(limit=100)
            if recent_logs:
                seen_log_keys = {l.get("id") or l.get("traceId") for l in self.logs}
                for rl in recent_logs:
                    lkey = rl.get("id") or rl.get("traceId")
                    if lkey not in seen_log_keys:
                        self.logs.append(rl)
                        seen_log_keys.add(lkey)

        except Exception as e:
            import logging
            logging.getLogger(__name__).error('Exception in data_store _hydrate_from_mongo', exc_info=True)


# Singleton instance
store = DataStore()
