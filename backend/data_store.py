"""
In-memory data store for SentinelOps Autonomous DevOps CI/CD Control Center.
Pre-seeded with realistic enterprise operational data, supporting dynamic mutations.
"""

import sys
import os
import time
import random
import threading
from datetime import datetime

# ─── Navigation ───────────────────────────────────────────────────────────────
NAV_ITEMS = [
    {"path": "/dashboard", "label": "Overview", "icon": "dashboard"},
    {"path": "/pipelines", "label": "Pipelines", "icon": "account_tree", "badge": {"text": "148 active", "variant": "neutral"}},
    {"path": "/incidents", "label": "Incidents", "icon": "warning", "badge": {"text": "2 live", "variant": "error"}},
    {"path": "/ai-agents", "label": "AI Agents", "icon": "smart_toy", "badge": {"text": "", "variant": "pulse"}},
    {"path": "/pull-requests", "label": "Pull Requests", "icon": "call_merge", "badge": {"text": "5 pending", "variant": "neutral"}},
    {"path": "/logs", "label": "Logs", "icon": "terminal"},
    {"path": "/analytics", "label": "Analytics", "icon": "monitoring"},
    {"path": "/settings", "label": "Settings", "icon": "tune"},
    {"path": "/profile", "label": "Profile", "icon": "account_circle"},
]


KPI_METRICS = [
    {
        "label": "Total Pipelines",
        "value": "1,428",
        "trend": "+12.4%",
        "trendDirection": "up",
        "trendPositive": True,
        "sub": "Across 38 microservice repos",
        "subRight": "All clusters",
        "progress": 84,
        "progressColor": "bg-[#D97757]",
        "icon": "account_tree",
        "iconBg": "bg-[#F9ECE7]",
        "iconColor": "text-[#D97757]",
        "hoverBorder": "hover:border-[#D97757]/40",
    },
    {
        "label": "Failed Pipelines",
        "value": "14",
        "trend": "-42% reduction",
        "trendDirection": "down",
        "trendPositive": True,
        "sub": "2 actively being diagnosed",
        "subRight": "12 resolved",
        "progress": 18,
        "progressColor": "bg-[#C34A4A]",
        "icon": "warning",
        "iconBg": "bg-[#FDF0F0]",
        "iconColor": "text-[#C34A4A]",
        "hoverBorder": "hover:border-[#C34A4A]/40",
    },
    {
        "label": "Auto Repaired",
        "value": "132",
        "trend": "+18.2% auto",
        "trendDirection": "up",
        "trendPositive": True,
        "sub": "Zero human intervention",
        "subRight": "v2.4 Kernel",
        "progress": 91,
        "progressColor": "bg-[#B87A36]",
        "icon": "auto_fix_high",
        "iconBg": "bg-[#F6EFE6]",
        "iconColor": "text-[#B87A36]",
        "hoverBorder": "hover:border-[#B87A36]/40",
    },
    {
        "label": "Recovery Rate",
        "value": "94.8%",
        "trend": "avg MTTR: 1.8m",
        "trendDirection": "up",
        "trendPositive": True,
        "sub": "Down from 34m manual",
        "subRight": "-94.7% MTTR",
        "progress": 95,
        "progressColor": "bg-[#D97757]",
        "icon": "bolt",
        "iconBg": "bg-[#F9ECE7]",
        "iconColor": "text-[#D97757]",
        "hoverBorder": "hover:border-[#D97757]/40",
    },
]

# ─── Remediation Steps (Live Timeline) ───────────────────────────────────────
REMEDIATION_STEPS = [
    {"id": "1", "label": "Failure detected in payment-service", "description": "Process exited with non-zero exit code 1 in test runner.", "time": "02:14:10", "status": "done"},
    {"id": "2", "label": "Retrieved GitHub Actions logs", "description": "Streamed 4,812 raw console output lines into parser.", "time": "02:14:12", "status": "done"},
    {"id": "3", "label": "Analyzed commit 9f8a42b", "description": "Semantic AST diff identified package.json bump anomaly.", "time": "02:14:18", "status": "done"},
    {"id": "4", "label": "Identified root cause (96% conf)", "description": "Peer dependency mismatch in @stripe/stripe-node v14.2.", "time": "02:14:24", "status": "done"},
    {"id": "5", "label": "Generated deterministic patch", "description": "Replaced lockfile pins, reconciled sub-dependencies.", "time": "02:14:35", "status": "done"},
    {"id": "6", "label": "Created branch fix/pkg-mismatch", "description": None, "time": "02:14:41", "status": "done"},
    {"id": "7", "label": "Running CI validation test suite", "description": "Ephemeral micro-sandbox node initialized. 48/52 tests passing.", "time": None, "status": "running"},
    {"id": "8", "label": "Auto-create PR #185 & request SRE signoff", "description": None, "time": None, "status": "pending"},
]

# ─── Incidents ───────────────────────────────────────────────────────────────
INCIDENTS = [
    {
        "id": "INC-8924",
        "repo": "payment-service",
        "pipeline": "CI Pipeline",
        "failure": "Dependency Error",
        "rootCause": "package mismatch in @stripe/stripe-node",
        "confidence": 96,
        "confidenceColor": "primary",
        "status": "Fixed",
        "time": "4m ago",
    },
    {
        "id": "INC-8923",
        "repo": "auth-service",
        "pipeline": "Deploy Staging",
        "failure": "Env Config Missing",
        "rootCause": "JWT_SECRET not injected in staging",
        "confidence": 91,
        "confidenceColor": "primary",
        "status": "PR Created",
        "time": "12m ago",
    },
    {
        "id": "INC-8922",
        "repo": "order-orchestrator",
        "pipeline": "Integration Test",
        "failure": "Timeout Exception",
        "rootCause": "Redis lock lease expiration in gRPC",
        "confidence": 88,
        "confidenceColor": "tertiary",
        "status": "Investigating",
        "time": "18m ago",
    },
    {
        "id": "INC-8921",
        "repo": "notification-worker",
        "pipeline": "Deploy Staging",
        "failure": "Helm Template Error",
        "rootCause": "Invalid YAML indentation in values.yaml",
        "confidence": 99,
        "confidenceColor": "primary",
        "status": "Needs Approval",
        "time": "32m ago",
        "actionLabel": "Review Fix",
        "actionVariant": "primary",
    },
    {
        "id": "INC-8920",
        "repo": "inventory-api",
        "pipeline": "Lint & Security",
        "failure": "Trivy CVE Alert",
        "rootCause": "Critical vulnerability in base alpine:3.18",
        "confidence": 84,
        "confidenceColor": "error",
        "status": "Failed",
        "time": "1h ago",
    },
]

# ─── Pipelines ───────────────────────────────────────────────────────────────
PIPELINES = [
    {
        "id": "pipe-001",
        "name": "CI Pipeline",
        "repo": "payment-service",
        "branch": "fix/pkg-mismatch",
        "commit": "9f8a42b",
        "status": "running",
        "stages": [
            {"name": "Checkout", "status": "success", "duration": "2s"},
            {"name": "Build", "status": "success", "duration": "45s"},
            {"name": "Test", "status": "running"},
            {"name": "Scan", "status": "queued"},
            {"name": "Deploy", "status": "queued"},
        ],
        "duration": "1m 18s",
        "triggeredBy": "AI Agent (SentinelOps)",
        "time": "2m ago",
        "aiFixed": True,
    },
    {
        "id": "pipe-002",
        "name": "Deploy Staging",
        "repo": "auth-service",
        "branch": "main",
        "commit": "a1b2c3d",
        "status": "success",
        "stages": [
            {"name": "Checkout", "status": "success", "duration": "1s"},
            {"name": "Build", "status": "success", "duration": "38s"},
            {"name": "Test", "status": "success", "duration": "1m 12s"},
            {"name": "Scan", "status": "success", "duration": "22s"},
            {"name": "Deploy", "status": "success", "duration": "18s"},
        ],
        "duration": "2m 31s",
        "triggeredBy": "github-actions[bot]",
        "time": "8m ago",
    },
    {
        "id": "pipe-003",
        "name": "Integration Test",
        "repo": "order-orchestrator",
        "branch": "feature/async-queue",
        "commit": "f4e5d6c",
        "status": "failed",
        "stages": [
            {"name": "Checkout", "status": "success", "duration": "1s"},
            {"name": "Build", "status": "success", "duration": "52s"},
            {"name": "Test", "status": "failed", "duration": "3m 04s"},
            {"name": "Scan", "status": "cancelled"},
            {"name": "Deploy", "status": "cancelled"},
        ],
        "duration": "4m 02s",
        "triggeredBy": "naveen.k",
        "time": "18m ago",
    },
    {
        "id": "pipe-004",
        "name": "Lint & Security",
        "repo": "inventory-api",
        "branch": "main",
        "commit": "c7d8e9f",
        "status": "failed",
        "stages": [
            {"name": "Checkout", "status": "success", "duration": "1s"},
            {"name": "Lint", "status": "success", "duration": "8s"},
            {"name": "SAST", "status": "failed", "duration": "24s"},
            {"name": "Scan", "status": "cancelled"},
            {"name": "Deploy", "status": "cancelled"},
        ],
        "duration": "34s",
        "triggeredBy": "dependabot[bot]",
        "time": "1h ago",
    },
    {
        "id": "pipe-005",
        "name": "Deploy Production",
        "repo": "gateway-service",
        "branch": "release/v3.2",
        "commit": "b1c2d3e",
        "status": "queued",
        "stages": [
            {"name": "Checkout", "status": "queued"},
            {"name": "Build", "status": "queued"},
            {"name": "Test", "status": "queued"},
            {"name": "Scan", "status": "queued"},
            {"name": "Deploy", "status": "queued"},
        ],
        "duration": "—",
        "triggeredBy": "release-bot",
        "time": "queued",
    },
]

# ─── AI Agents ───────────────────────────────────────────────────────────────
AI_AGENTS = [
    {
        "id": "agent-001",
        "name": "Sentinel-α",
        "role": "Failure Detection",
        "status": "active",
        "capability": "Real-time CI/CD monitoring and anomaly detection",
        "tasksCompleted": 2841,
        "currentTask": "Monitoring 148 active pipelines",
        "successRate": 99.4,
        "lastSeen": "now",
        "tags": ["monitoring", "anomaly-detection", "real-time"],
    },
    {
        "id": "agent-002",
        "name": "Resolver-β",
        "role": "Root Cause Analysis",
        "status": "processing",
        "capability": "Semantic log parsing and dependency graph traversal",
        "tasksCompleted": 1204,
        "currentTask": "Analyzing INC-8924 root cause",
        "successRate": 96.8,
        "lastSeen": "2s ago",
        "tags": ["rca", "log-analysis", "dependency-graph"],
    },
    {
        "id": "agent-003",
        "name": "Patcher-γ",
        "role": "Autonomous Remediation",
        "status": "processing",
        "capability": "Deterministic patch generation and lockfile reconciliation",
        "tasksCompleted": 132,
        "currentTask": "Generating patch for @stripe/stripe-node",
        "successRate": 94.7,
        "lastSeen": "5s ago",
        "tags": ["patching", "auto-fix", "npm"],
    },
    {
        "id": "agent-004",
        "name": "Reviewer-δ",
        "role": "Code Review",
        "status": "active",
        "capability": "Semantic code diff analysis and PR review automation",
        "tasksCompleted": 589,
        "currentTask": "Reviewing PR #184",
        "successRate": 97.2,
        "lastSeen": "12s ago",
        "tags": ["code-review", "pr-automation", "ast-diff"],
    },
    {
        "id": "agent-005",
        "name": "Deploy-ε",
        "role": "Deployment Orchestration",
        "status": "idle",
        "capability": "Helm chart validation and zero-downtime rollout management",
        "tasksCompleted": 318,
        "currentTask": None,
        "successRate": 98.1,
        "lastSeen": "1m ago",
        "tags": ["helm", "kubernetes", "rollout"],
    },
    {
        "id": "agent-006",
        "name": "Scanner-ζ",
        "role": "Security Scanning",
        "status": "standby",
        "capability": "CVE detection, SAST analysis, and container image scanning",
        "tasksCompleted": 743,
        "currentTask": None,
        "successRate": 99.1,
        "lastSeen": "3m ago",
        "tags": ["cve", "sast", "trivy"],
    },
]

# ─── Pull Requests ───────────────────────────────────────────────────────────
PULL_REQUESTS = [
    {
        "id": "pr-001",
        "number": 185,
        "title": "fix: resolve @stripe/stripe-node peer dependency mismatch",
        "repo": "payment-service",
        "branch": "fix/pkg-mismatch",
        "author": "AI Agent (Patcher-γ)",
        "status": "reviewing",
        "aiReviewScore": 96,
        "comments": 3,
        "additions": 12,
        "deletions": 8,
        "time": "2m ago",
        "aiComment": "Lockfile pins updated. 0 syntax regressions detected. Test coverage unchanged.",
    },
    {
        "id": "pr-002",
        "number": 184,
        "title": "feat: add JWT_SECRET injection to staging deployment",
        "repo": "auth-service",
        "branch": "fix/jwt-staging-env",
        "author": "AI Agent (Patcher-γ)",
        "status": "approved",
        "aiReviewScore": 91,
        "comments": 1,
        "additions": 4,
        "deletions": 0,
        "time": "12m ago",
        "aiComment": "Secret correctly referenced via Kubernetes SecretRef. No plaintext exposure.",
    },
    {
        "id": "pr-003",
        "number": 183,
        "title": "refactor: migrate order-orchestrator to async gRPC handler",
        "repo": "order-orchestrator",
        "branch": "feature/async-queue",
        "author": "naveen.k",
        "status": "changes_requested",
        "aiReviewScore": 74,
        "comments": 8,
        "additions": 243,
        "deletions": 91,
        "time": "1h ago",
        "aiComment": "Redis lock timeout handling incomplete. 3 potential race conditions flagged.",
    },
    {
        "id": "pr-004",
        "number": 182,
        "title": "chore: bump alpine base image to 3.19 (CVE fix)",
        "repo": "inventory-api",
        "branch": "fix/alpine-cve",
        "author": "dependabot[bot]",
        "status": "reviewing",
        "aiReviewScore": 88,
        "comments": 0,
        "additions": 2,
        "deletions": 2,
        "time": "45m ago",
        "aiComment": "CVE-2024-XXXX patched. Image digest verified. No breaking changes.",
    },
    {
        "id": "pr-005",
        "number": 181,
        "title": "feat: gateway rate-limit per tenant (release/v3.2)",
        "repo": "gateway-service",
        "branch": "release/v3.2",
        "author": "priya.m",
        "status": "merged",
        "aiReviewScore": 99,
        "comments": 14,
        "additions": 512,
        "deletions": 38,
        "time": "3h ago",
    },
]

# ─── Logs ────────────────────────────────────────────────────────────────────
LOG_ENTRIES = [
    {"id": "l-01", "timestamp": "02:14:41.023", "level": "INFO", "service": "payment-service", "message": "Branch fix/pkg-mismatch created by AI Agent", "traceId": "trace-8924a"},
    {"id": "l-02", "timestamp": "02:14:38.910", "level": "INFO", "service": "ai-kernel", "message": "Patch generated: replaced @stripe/stripe-node ^14.1.0 → ^14.2.1", "traceId": "trace-8924a"},
    {"id": "l-03", "timestamp": "02:14:24.441", "level": "INFO", "service": "ai-kernel", "message": "Root cause identified: peer dependency mismatch (confidence 96%)", "traceId": "trace-8924a"},
    {"id": "l-04", "timestamp": "02:14:18.202", "level": "DEBUG", "service": "resolver-beta", "message": "AST diff on commit 9f8a42b — 1 anomaly in package.json", "traceId": "trace-8924a"},
    {"id": "l-05", "timestamp": "02:14:12.009", "level": "DEBUG", "service": "sentinel-alpha", "message": "Streamed 4812 lines from GitHub Actions runner logs", "traceId": "trace-8924a"},
    {"id": "l-06", "timestamp": "02:14:10.001", "level": "ERROR", "service": "payment-service", "message": "Process exited with non-zero exit code 1 — test runner failure", "traceId": "trace-8924a"},
    {"id": "l-07", "timestamp": "02:13:58.773", "level": "WARN", "service": "order-orchestrator", "message": "Redis lock lease expired after 30000ms — gRPC handler stalled", "traceId": "trace-8922b"},
    {"id": "l-08", "timestamp": "02:13:44.512", "level": "ERROR", "service": "inventory-api", "message": "Trivy scan: CRITICAL CVE detected in alpine:3.18 base image", "traceId": "trace-8920c"},
    {"id": "l-09", "timestamp": "02:13:31.001", "level": "INFO", "service": "gateway-service", "message": "Deploy pipeline queued — release/v3.2 awaiting slot", "traceId": "trace-gate"},
    {"id": "l-10", "timestamp": "02:13:22.440", "level": "INFO", "service": "auth-service", "message": "Staging deploy triggered via AI remediation PR #184", "traceId": "trace-8923d"},
    {"id": "l-11", "timestamp": "02:12:55.199", "level": "TRACE", "service": "resolver-beta", "message": "Dependency graph traversal depth=4 nodes=187", "traceId": "trace-8924a"},
    {"id": "l-12", "timestamp": "02:12:40.003", "level": "WARN", "service": "notification-worker", "message": "Helm template render failed — indentation error on line 44 of values.yaml", "traceId": "trace-8921e"},
]

# ─── Settings & Policies ─────────────────────────────────────────────────────
SETTINGS = {
    "confidenceThreshold": 95,
    "autoMergeActive": True,
    "ciSuccessRequired": True,
    "zeroCveRequired": True,
    "humanApprovalRequired": False,
    "model": "Gemini 1.5 Pro (Ultra Reasoning)",
    "reasoningBudget": 4096,
    "astCaching": True,
    "temperature": 0.10,
    "notificationsEnabled": True,
    "slackChannel": "#devops-alerts",
    "pagerDutyService": "Autonomous-CI-CD",
}

# ─── Analytics ───────────────────────────────────────────────────────────────
ANALYTICS = {
    "dora": {
        "deploymentFrequency": "18.4 / day",
        "deploymentFrequencyRating": "Elite",
        "leadTimeForChanges": "14.2m",
        "leadTimeRating": "Elite",
        "changeFailureRate": "1.4%",
        "changeFailureRating": "Elite",
        "mttr": "1.8m",
        "mttrRating": "Elite",
    },
    "velocity": {
        "prsProcessed": 348,
        "avgMergeTime": "4.2m",
        "autoFixRate": "92.4%",
        "humanOverrideRate": "7.6%",
        "hoursSaved": "327.4 hrs",
        "costSaved": "$42,560",
        "patchesSynthesized": 132,
    },
    "mttr": {
        "current": "1.8m",
        "previous": "34.0m",
        "reductionPercent": "94.7%",
    },
    "failureCategories": [
        {"name": "Dependency Mismatch", "percentage": 42},
        {"name": "Env & Secret Missing", "percentage": 28},
        {"name": "Timeout & Leases", "percentage": 16},
        {"name": "Config & Helm Syntax", "percentage": 14},
    ],
    "microservices": [
        {"name": "auth-gateway-edge", "cluster": "k8s/prod-us-east-1", "events": "86 events", "rate": "97.6%", "saved": "114.2 hrs", "health": "99.8 / 100"},
        {"name": "payment-service", "cluster": "k8s/prod-us-east-1", "events": "64 events", "rate": "95.3%", "saved": "82.6 hrs", "health": "99.2 / 100"},
        {"name": "order-orchestrator", "cluster": "k8s/prod-eu-west-1", "events": "48 events", "rate": "91.7%", "saved": "64.1 hrs", "health": "98.5 / 100"},
        {"name": "inventory-api", "cluster": "k8s/prod-us-central", "events": "32 events", "rate": "93.8%", "saved": "42.0 hrs", "health": "99.0 / 100"},
        {"name": "billing-engine", "cluster": "k8s/prod-us-east-1", "events": "18 events", "rate": "100%", "saved": "24.5 hrs", "health": "100 / 100"},
    ],
}


class DataStore:
    def __init__(self):
        self.kpi_metrics = list(KPI_METRICS)
        self.remediation_steps = list(REMEDIATION_STEPS)
        self.incidents = list(INCIDENTS)
        self.pipelines = list(PIPELINES)
        self.ai_agents = list(AI_AGENTS)
        self.pull_requests = list(PULL_REQUESTS)
        self.logs = list(LOG_ENTRIES)
        self.settings = dict(SETTINGS)
        self.analytics = dict(ANALYTICS)
        self.webhook_events = []
        self.start_time = time.time()

        # Initialize persistent database layer
        try:
            from database import init_db
            from services.incident_service import incident_service
            init_db()
            db_incs = incident_service.get_all_incidents()
            if not db_incs:
                for inc in self.incidents:
                    incident_service.persist_incident(inc)
            else:
                existing_ids = {i["id"] for i in self.incidents}
                for db_inc in db_incs:
                    if db_inc["id"] not in existing_ids:
                        self.incidents.insert(0, db_inc)
        except Exception:
            pass

    def get_health(self):
        uptime_sec = int(time.time() - self.start_time)
        return {
            "status": "healthy",
            "backend": "Python Flask",
            "version": "3.1.1",
            "pythonVersion": sys.version.split()[0],
            "pid": os.getpid(),
            "aiKernel": "v2.4 Autonomous Engine",
            "uptimeSeconds": uptime_sec,
            "activePipelines": len([p for p in self.pipelines if p.get("status") == "running"]),
            "activeIncidents": len([i for i in self.incidents if i.get("status") != "Resolved"]),
            "activeAgents": len([a for a in self.ai_agents if a.get("status") in ["active", "processing"]]),
            "totalAgents": len(self.ai_agents),
            "timestamp": datetime.now().isoformat(),
        }

    def get_overview(self):
        return {
            "kpiMetrics": self.kpi_metrics,
            "remediationSteps": self.remediation_steps,
            "incidents": self.incidents[:5],
            "pipelines": self.pipelines[:5],
            "stats": {
                "successRate": "98.6%",
                "failureRate": "1.4%",
                "avgRecovery": "1m 48s",
                "autoResolution": "92.4%",
            },
        }

    # ── Incidents ─────────────────────────────────────────────────────────────
    def get_incidents(self, status=None, search=None):
        res = self.incidents
        if status and status.lower() != "all":
            res = [i for i in res if i.get("status", "").lower() == status.lower()]
        if search:
            s = search.lower()
            res = [i for i in res if s in i.get("id", "").lower() or s in i.get("repo", "").lower() or s in i.get("failure", "").lower() or s in i.get("rootCause", "").lower()]
        return res

    def get_incident(self, incident_id):
        for inc in self.incidents:
            if inc["id"].lower() == incident_id.lower():
                return inc
        return None

    def update_incident_status(self, incident_id, new_status):
        for inc in self.incidents:
            if inc["id"].lower() == incident_id.lower():
                inc["status"] = new_status
                # If resolved, add log entry
                self.add_log(
                    service=inc.get("repo", "ai-kernel"),
                    level="INFO",
                    message=f"Incident {inc['id']} status updated to '{new_status}' by operator/AI",
                )
                try:
                    from services.incident_service import incident_service
                    incident_service.update_incident_status(inc["id"], new_status)
                except Exception:
                    pass
                return inc
        return None

    def explain_incident(self, incident_id):
        inc = self.get_incident(incident_id)
        if not inc:
            return None
        return {
            "incidentId": inc["id"],
            "repo": inc["repo"],
            "pipeline": inc["pipeline"],
            "confidence": inc["confidence"],
            "rootCause": inc["rootCause"],
            "explanation": (
                f"Autonomous Diagnostics report for {inc['id']}: SentinelOps AST parser inspected commit changes "
                f"in repository '{inc['repo']}'. The root cause was determined to be '{inc['rootCause']}' with "
                f"{inc['confidence']}% algorithmic confidence. The engine proposes deterministic lockfile pin reconciliation "
                f"with automated sandbox test validation."
            ),
            "suggestedAction": "Apply deterministic lockfile patch and trigger automated validation run.",
            "policyCheck": "Complies with Zero-Regression & Auto-Merge Guardrail Policy v2.4.",
        }

    # ── Pipelines ─────────────────────────────────────────────────────────────
    def get_pipelines(self, status=None):
        if status and status.lower() != "all":
            return [p for p in self.pipelines if p.get("status", "").lower() == status.lower()]
        return self.pipelines

    def get_pipeline(self, pipeline_id):
        for p in self.pipelines:
            if p["id"].lower() == pipeline_id.lower():
                return p
        return None

    def _run_pipeline_stages_async(self, pipeline_id):
        """Asynchronously simulates live DAG execution stages advancing sequentially."""
        time.sleep(0.8)
        stages_sequence = [
            ("Checkout", "1s", "Git checkout verified commit sha"),
            ("Build", "12s", "Compiled assets & generated microservice container"),
            ("Test", "18s", "Executed unit & contract test suite (142/142 passed)"),
            ("Scan", "6s", "Trivy & Snyk security scan clean: 0 high/critical CVEs"),
            ("Deploy", "4s", "Progressive canary release deployed to k8s cluster"),
        ]

        for idx, (s_name, s_dur, s_msg) in enumerate(stages_sequence):
            p = self.get_pipeline(pipeline_id)
            if not p or p.get("status") in ["cancelled", "failed"]:
                return

            if idx < len(p.get("stages", [])):
                p["stages"][idx]["status"] = "running"
            self.add_log(service=p["repo"], level="INFO", message=f"[{p['id']}] Stage '{s_name}' initialized")
            time.sleep(1.8)

            p = self.get_pipeline(pipeline_id)
            if not p:
                return
            if idx < len(p.get("stages", [])):
                p["stages"][idx]["status"] = "success"
                p["stages"][idx]["duration"] = s_dur
            self.add_log(service=p["repo"], level="INFO", message=f"[{p['id']}] Stage '{s_name}' passed: {s_msg}")

        p = self.get_pipeline(pipeline_id)
        if p:
            p["status"] = "success"
            p["duration"] = "41s"
            p["time"] = "just now"
            p["aiFixed"] = True
            self.add_log(service=p["repo"], level="INFO", message=f"Pipeline {p['id']} successfully completed all 5 DAG stages!")

    def trigger_pipeline(self, repo="payment-service", branch="main", name="Autonomous CI Pipeline"):
        new_id = f"pipe-{len(self.pipelines) + 1:03d}"
        new_pipe = {
            "id": new_id,
            "name": name,
            "repo": repo,
            "branch": branch,
            "commit": f"{random.randint(1000000, 9999999):x}",
            "status": "running",
            "stages": [
                {"name": "Checkout", "status": "running", "duration": "1s"},
                {"name": "Build", "status": "queued"},
                {"name": "Test", "status": "queued"},
                {"name": "Scan", "status": "queued"},
                {"name": "Deploy", "status": "queued"},
            ],
            "duration": "in progress",
            "triggeredBy": "Operator via Flask API",
            "time": "just now",
            "aiFixed": False,
        }
        self.pipelines.insert(0, new_pipe)
        self.add_log(
            service=repo,
            level="INFO",
            message=f"Pipeline {new_id} ({name}) scheduled on branch '{branch}' via Flask backend",
        )
        threading.Thread(target=self._run_pipeline_stages_async, args=(new_id,), daemon=True).start()
        return new_pipe

    def retry_pipeline(self, pipeline_id):
        p = self.get_pipeline(pipeline_id)
        if not p:
            return None
        p["status"] = "running"
        p["time"] = "retrying now"
        for stage in p.get("stages", []):
            stage["status"] = "queued"
        if p.get("stages"):
            p["stages"][0]["status"] = "running"

        self.add_log(service=p["repo"], level="INFO", message=f"Pipeline {p['id']} re-triggered by operator")
        threading.Thread(target=self._run_pipeline_stages_async, args=(pipeline_id,), daemon=True).start()
        return p

    def simulate_anomaly(self):
        """Simulates a live chaos engineering outage and autonomous agent remediation."""
        inc_num = len(self.incidents) + 8920
        inc_id = f"inc-{inc_num}"

        new_incident = {
            "id": inc_id,
            "repo": "order-orchestrator",
            "pipeline": "pipe-002",
            "failure": "Redis connection pool starvation: timeout after 30000ms",
            "rootCause": "Missing connection leak eviction in redis-py pool manager",
            "confidence": 98,
            "confidenceColor": "primary",
            "status": "Investigating",
            "time": "just now",
            "actionLabel": "Auto-Heal Active",
            "actionVariant": "primary",
        }
        self.incidents.insert(0, new_incident)

        self.add_log(
            service="order-orchestrator",
            level="ERROR",
            message=f"CRITICAL: Connection pool exhausted (max 500 connections). Error rate spike +42% on /checkout",
        )
        self.add_log(
            service="ai-kernel",
            level="WARN",
            message=f"Autonomous Agent Sentinel-α intercepted anomaly {inc_id}. Triggering Resolver-β triage",
        )

        for a in self.ai_agents:
            if a["id"] == "agent-002":
                a["status"] = "processing"
                a["currentTask"] = f"Diagnosing {inc_id} in order-orchestrator"

        def _resolve_anomaly_bg():
            time.sleep(3.5)
            self.add_log(
                service="resolver-beta",
                level="INFO",
                message=f"AST diff inspection complete: connection leak in pool.py identified. Generating deterministic fix",
            )
            for inc in self.incidents:
                if inc["id"] == inc_id:
                    inc["status"] = "PR Created"
                    inc["actionLabel"] = "Review PR #186"
                    break

            pr_id = f"pr-{len(self.pull_requests) + 1:03d}"
            pr_number = 186
            new_pr = {
                "id": pr_id,
                "number": pr_number,
                "title": "fix: configure aggressive idle connection eviction in Redis pool",
                "repo": "order-orchestrator",
                "branch": "fix/redis-pool-leak",
                "author": "AI Agent (Patcher-γ)",
                "status": "reviewing",
                "aiReviewScore": 97,
                "comments": 2,
                "additions": 8,
                "deletions": 3,
                "time": "just now",
                "aiComment": "Auto-generated patch: adds max_idle_time=60 and health_check_interval=30 to RedisConnectionPool.",
            }
            self.pull_requests.insert(0, new_pr)
            self.add_log(
                service="patcher-gamma",
                level="INFO",
                message=f"PR #{pr_number} generated & pushed to branch 'fix/redis-pool-leak'. SRE approval requested",
            )

        threading.Thread(target=_resolve_anomaly_bg, daemon=True).start()
        return new_incident

    # ── AI Agents ─────────────────────────────────────────────────────────────
    def get_ai_agents(self):
        return self.ai_agents

    def add_ai_agent(self, data):
        agent_id = f"agent-{len(self.ai_agents) + 1:03d}"
        new_agent = {
            "id": agent_id,
            "name": data.get("name") or f"Agent-Pod-{len(self.ai_agents) + 1}",
            "role": data.get("role") or "General Remediation",
            "status": data.get("status") or "active",
            "capability": data.get("capability") or "Autonomous task processing & AST validation",
            "tasksCompleted": int(data.get("tasksCompleted", 0)),
            "currentTask": data.get("currentTask") or "Initialized pod, listening on queue",
            "successRate": float(data.get("successRate", 99.2)),
            "lastSeen": "just now",
            "tags": data.get("tags") or ["autonomous", "k8s", "dynamic-pod"],
            "hostRunner": data.get("hostRunner") or "k8s-agent-worker-03",
            "modelBackend": data.get("modelBackend") or "Claude 3.7 Sonnet / Gemini 1.5 Pro",
        }
        self.ai_agents.append(new_agent)
        self.add_log(
            service="agent-orchestrator",
            level="INFO",
            message=f"Deployed new agent pod '{new_agent['name']}' ({new_agent['role']}) to cluster",
        )
        return new_agent

    def update_agent_status(self, agent_id, new_status):
        for agent in self.ai_agents:
            if agent["id"].lower() == agent_id.lower() or agent["name"].lower() == agent_id.lower():
                agent["status"] = new_status
                agent["lastSeen"] = "just now"
                self.add_log(
                    service="agent-orchestrator",
                    level="INFO",
                    message=f"Agent '{agent['name']}' ({agent['id']}) status updated to '{new_status}'",
                )
                return agent
        return None

    # ── Pull Requests ─────────────────────────────────────────────────────────
    def get_pull_requests(self):
        return self.pull_requests

    def review_pull_request(self, pr_id):
        target = str(pr_id).lower()
        for pr in self.pull_requests:
            if (
                pr["id"].lower() == target
                or str(pr.get("number")) == target
                or f"pr-{pr.get('number')}".lower() == target
            ):
                pr["aiReviewScore"] = min(99, (pr.get("aiReviewScore") or 85) + 3)
                pr["status"] = "approved"
                pr["aiComment"] = f"AI Re-audit complete: Zero security regressions. Compliance score {pr['aiReviewScore']}%."
                self.add_log(service=pr["repo"], level="INFO", message=f"PR #{pr['number']} reviewed & approved by AI Reviewer-δ")
                return pr
        return None

    def merge_pull_request(self, pr_id):
        target = str(pr_id).lower()
        for pr in self.pull_requests:
            if (
                pr["id"].lower() == target
                or str(pr.get("number")) == target
                or f"pr-{pr.get('number')}".lower() == target
            ):
                pr["status"] = "merged"
                self.add_log(service=pr["repo"], level="INFO", message=f"PR #{pr['number']} auto-merged to branch {pr['branch']}")
                return pr
        return None

    # ── Logs ──────────────────────────────────────────────────────────────────
    def get_logs(self, service=None, level=None, query=None, limit=100):
        res = self.logs
        if service and service.lower() != "all":
            res = [l for l in res if l.get("service", "").lower() == service.lower()]
        if level and level.upper() != "ALL":
            res = [l for l in res if l.get("level", "").upper() == level.upper()]
        if query:
            q = query.lower()
            res = [l for l in res if q in l.get("message", "").lower() or q in l.get("service", "").lower()]
        return res[:limit]

    def add_log(self, service, level, message, trace_id=None):
        log_id = f"l-{len(self.logs) + 1:02d}"
        now_str = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        entry = {
            "id": log_id,
            "timestamp": now_str,
            "level": level.upper(),
            "service": service,
            "message": message,
            "traceId": trace_id or f"trace-{random.randint(1000, 9999)}",
        }
        self.logs.insert(0, entry)
        return entry

    # ── Settings & Analytics ──────────────────────────────────────────────────
    def get_settings(self):
        return self.settings

    def update_settings(self, new_settings):
        self.settings.update(new_settings)
        return self.settings

    def get_analytics(self, time_range="30d"):
        res = dict(self.analytics)
        res["timeRange"] = time_range

        # Dynamic multipliers based on range
        multiplier = 1.0
        if time_range == "7d":
            multiplier = 0.25
        elif time_range == "90d":
            multiplier = 2.8

        prs = int(348 * multiplier)
        hours = round(327.4 * multiplier, 1)
        cost = int(42560 * multiplier)
        patches = int(132 * multiplier)

        res["velocity"] = {
            "prsProcessed": prs,
            "avgMergeTime": "4.2m",
            "autoFixRate": "92.4%",
            "humanOverrideRate": "7.6%",
            "hoursSaved": f"{hours} hrs",
            "costSaved": f"${cost:,}",
            "patchesSynthesized": patches,
        }
        return res


    # ── GitHub Webhook Integration ────────────────────────────────────────────
    def handle_github_workflow_run(self, payload):
        """Processes incoming GitHub Actions workflow_run webhook payloads."""
        try:
            from services.github_service import github_service
        except ImportError:
            try:
                from backend.services.github_service import github_service
            except ImportError:
                github_service = None

        if github_service:
            run_data = github_service.parse_workflow_run(payload)
            action = run_data["action"]
            repo_name = run_data["repository"].split("/")[-1]
            wf_name = run_data["workflow_name"]
            branch = run_data["branch"]
            raw_commit = run_data["commit_sha"]
            commit_sha = raw_commit[:7] if len(raw_commit) >= 7 else raw_commit
            raw_status = run_data["status"]
            conclusion = run_data["conclusion"]
            actor = run_data["actor"]
            run_id = run_data["run_id"]
            is_failed = github_service.is_failed_workflow(run_data)
        else:
            action = payload.get("action", "completed")
            run = payload.get("workflow_run", {})
            repo_obj = payload.get("repository", {}) or run.get("repository", {})
            repo_name = repo_obj.get("name") or "SentinelOps"
            wf_name = run.get("name") or "CI/CD Workflow"
            branch = run.get("head_branch") or "main"
            raw_commit = run.get("head_sha") or "HEAD"
            commit_sha = raw_commit[:7] if len(raw_commit) >= 7 else raw_commit
            actor = payload.get("sender", {}).get("login") or run.get("actor", {}).get("login") or "github-actions"
            raw_status = run.get("status", "completed")
            conclusion = run.get("conclusion")
            run_id = run.get("id", 0)
            is_failed = (action == "completed" and conclusion in ["failure", "timed_out"])
            run_data = {
                "repository": repo_name,
                "workflow_name": wf_name,
                "run_id": run_id,
                "branch": branch,
                "commit_sha": commit_sha,
                "status": raw_status,
                "conclusion": conclusion,
                "action": action,
                "actor": actor,
            }

        # Map GitHub status & conclusion to SentinelOps status: 'running', 'success', 'failed', 'queued', 'cancelled'
        if raw_status in ["queued", "waiting", "requested"]:
            pipe_status = "queued"
        elif raw_status == "in_progress":
            pipe_status = "running"
        elif raw_status == "completed":
            if conclusion == "success":
                pipe_status = "success"
            elif conclusion in ["failure", "timed_out", "startup_failure"]:
                pipe_status = "failed"
            elif conclusion == "cancelled":
                pipe_status = "cancelled"
            else:
                pipe_status = "success" if not conclusion else conclusion
        else:
            pipe_status = raw_status

        # Find existing pipeline for repo/branch or create a new entry
        pipe = None
        for p in self.pipelines:
            if p.get("repo") == repo_name and p.get("branch") == branch:
                pipe = p
                break

        if pipe:
            pipe["status"] = pipe_status
            pipe["name"] = wf_name
            pipe["commit"] = commit_sha
            pipe["time"] = "just now"
            pipe["triggeredBy"] = actor
        else:
            new_id = f"pipe-{len(self.pipelines) + 1:03d}"
            pipe = {
                "id": new_id,
                "name": wf_name,
                "repo": repo_name,
                "branch": branch,
                "commit": commit_sha,
                "status": pipe_status,
                "stages": [
                    {"name": "Checkout", "status": "success", "duration": "2s"},
                    {"name": "Build", "status": "success" if pipe_status == "success" else ("running" if pipe_status == "running" else "queued")},
                    {"name": "Test", "status": "success" if pipe_status == "success" else ("failed" if pipe_status == "failed" else "queued")},
                    {"name": "Scan", "status": "success" if pipe_status == "success" else "queued"},
                    {"name": "Deploy", "status": "success" if pipe_status == "success" else "queued"},
                ],
                "duration": "1m 15s" if pipe_status == "success" else "—",
                "triggeredBy": actor,
                "time": "just now",
            }
            self.pipelines.insert(0, pipe)

        # Record real-time log event for observability
        log_level = "ERROR" if pipe_status == "failed" else ("WARNING" if pipe_status == "cancelled" else "INFO")
        log_msg = f"[GitHub Webhook] Workflow '{wf_name}' ({action}) on {repo_name}@{branch} [{commit_sha}]: status={pipe_status}"
        if conclusion:
            log_msg += f", conclusion={conclusion}"
        self.add_log(service=repo_name, level=log_level, message=log_msg)

        incident_event = None
        if is_failed or pipe_status == "failed":
            if github_service:
                incident_event = github_service.create_incident_from_workflow_run(run_data)
            else:
                incident_event = {
                    "id": f"INC-{run_id}" if run_id else f"INC-{int(time.time())}",
                    "event_type": "workflow_run_failure",
                    "repository": repo_name,
                    "workflow": wf_name,
                    "run_id": run_id,
                    "branch": branch,
                    "commit_sha": commit_sha,
                    "status": raw_status,
                    "conclusion": conclusion or "failure",
                    "detected_at": datetime.now().isoformat(),
                    "severity": "high",
                    "incident_status": "Investigating",
                    "summary": f"Workflow '{wf_name}' failed on {repo_name}@{branch} [{commit_sha}] (Run #{run_id})",
                }

            # Ingest into self.incidents if not already present
            existing_inc = next((i for i in self.incidents if i.get("id") == incident_event["id"]), None)
            inc_record = {
                "id": incident_event["id"],
                "repo": repo_name,
                "pipeline": wf_name,
                "failure": f"Workflow Run Failure ({conclusion or 'failure'})",
                "rootCause": f"Pipeline failure in '{wf_name}' at commit {commit_sha}",
                "confidence": 92,
                "confidenceColor": "error",
                "status": "Investigating",
                "time": "just now",
                "runId": run_id,
                "branch": branch,
                "commit": commit_sha,
                "actionLabel": "Investigate",
                "actionVariant": "primary",
            }
            if not existing_inc:
                self.incidents.insert(0, inc_record)

            try:
                from services.incident_service import incident_service
                incident_service.persist_incident(inc_record)
            except Exception:
                pass

            self.add_log(
                service="SentinelOps-AI",
                level="WARN",
                message=f"Autonomous diagnosis triggered for failed workflow '{wf_name}' on {repo_name} (Run #{run_id})",
            )

        # Persist workflow run record in database
        try:
            from services.incident_service import incident_service
            incident_service.persist_workflow_run(run_data)
        except Exception:
            pass

        # Record event in webhook history
        summary = f"Workflow '{wf_name}' ({action}) -> {pipe_status}"
        self.record_webhook_event("workflow_run", payload, status="processed", summary=summary)

        return {
            "pipelineId": pipe["id"],
            "status": pipe_status,
            "repo": repo_name,
            "branch": branch,
            "commit": commit_sha,
            "incident": incident_event,
        }

    def handle_github_push(self, payload):
        """Processes incoming GitHub push webhook payloads."""
        ref = payload.get("ref", "refs/heads/main")
        branch = ref.replace("refs/heads/", "")
        repo_obj = payload.get("repository", {})
        repo_name = repo_obj.get("name") or "SentinelOps"
        pusher = payload.get("pusher", {}).get("name") or payload.get("sender", {}).get("login") or "developer"
        head_commit = payload.get("head_commit") or {}
        raw_commit = head_commit.get("id") or payload.get("after") or "HEAD"
        commit_sha = raw_commit[:7] if len(raw_commit) >= 7 else raw_commit
        commit_msg = (head_commit.get("message") or "Code push received").split("\n")[0]
        commits_count = len(payload.get("commits", [])) or 1

        new_id = f"pipe-{len(self.pipelines) + 1:03d}"
        pipe = {
            "id": new_id,
            "name": f"Push: {commit_msg[:36]}",
            "repo": repo_name,
            "branch": branch,
            "commit": commit_sha,
            "status": "running",
            "stages": [
                {"name": "Checkout", "status": "success", "duration": "2s"},
                {"name": "Build", "status": "running", "duration": "—"},
                {"name": "Test", "status": "queued"},
                {"name": "Scan", "status": "queued"},
                {"name": "Deploy", "status": "queued"},
            ],
            "duration": "Running...",
            "triggeredBy": f"Push by {pusher}",
            "time": "just now",
        }
        self.pipelines.insert(0, pipe)

        log_msg = f"[GitHub Webhook] Push to {repo_name}@{branch} by {pusher} ({commits_count} commit(s)) [{commit_sha}]: {commit_msg}"
        self.add_log(service=repo_name, level="INFO", message=log_msg)

        summary = f"Push to {repo_name}@{branch} [{commit_sha}] by {pusher}"
        self.record_webhook_event("push", payload, status="processed", summary=summary)

        return {
            "pipelineId": pipe["id"],
            "status": "running",
            "repo": repo_name,
            "branch": branch,
            "commit": commit_sha,
            "message": commit_msg
        }

    def handle_github_pull_request(self, payload):
        """Processes incoming GitHub pull_request webhook payloads."""
        action = payload.get("action", "opened")
        pr_obj = payload.get("pull_request", {})
        repo_obj = payload.get("repository", {})
        repo_name = repo_obj.get("name") or "SentinelOps"
        pr_number = pr_obj.get("number") or payload.get("number") or 100
        pr_title = pr_obj.get("title") or f"Pull Request #{pr_number}"
        head_ref = pr_obj.get("head", {}).get("ref") or "feat/updates"
        base_ref = pr_obj.get("base", {}).get("ref") or "main"
        author = pr_obj.get("user", {}).get("login") or payload.get("sender", {}).get("login") or "contributor"
        merged = pr_obj.get("merged", False)
        changed_files = pr_obj.get("changed_files", 3)
        additions = pr_obj.get("additions", 42)
        deletions = pr_obj.get("deletions", 8)

        # Check existing PR
        existing_pr = None
        for p in self.pull_requests:
            if p.get("number") == pr_number or p.get("id") == f"PR-{pr_number}":
                existing_pr = p
                break

        if action in ["opened", "synchronize", "reopened"]:
            status = "reviewing"
            ai_score = random.randint(91, 98)
            ai_comment = f"Autonomous AST & Security Audit: 0 CVEs detected. {changed_files} files inspected (+{additions}/-{deletions}). Code health score {ai_score}%."
            if existing_pr:
                existing_pr["title"] = pr_title
                existing_pr["status"] = status
                existing_pr["branch"] = head_ref
                existing_pr["aiReviewScore"] = ai_score
                existing_pr["aiComment"] = ai_comment
                existing_pr["time"] = "just now"
                target_pr = existing_pr
            else:
                target_pr = {
                    "id": f"PR-{pr_number}",
                    "number": pr_number,
                    "title": pr_title,
                    "repo": repo_name,
                    "branch": head_ref,
                    "author": author,
                    "avatar": f"https://api.dicebear.com/7.x/bottts/svg?seed={author}",
                    "status": status,
                    "aiReviewScore": ai_score,
                    "checksPassing": 4,
                    "totalChecks": 4,
                    "time": "just now",
                    "aiComment": ai_comment,
                }
                self.pull_requests.insert(0, target_pr)

            log_msg = f"[GitHub Webhook] PR #{pr_number} '{pr_title}' ({action}) by @{author} -> SentinelOps AI Audit dispatched ({ai_score}%)"
            self.add_log(service=repo_name, level="INFO", message=log_msg)
            summary = f"PR #{pr_number} ({action}) by @{author}: {pr_title}"
            self.record_webhook_event("pull_request", payload, status="processed", summary=summary)
            return {"prId": target_pr["id"], "action": action, "status": target_pr["status"], "aiScore": ai_score}

        elif action == "closed":
            pr_status = "merged" if merged else "closed"
            if existing_pr:
                existing_pr["status"] = pr_status
            log_msg = f"[GitHub Webhook] PR #{pr_number} was {pr_status} into '{base_ref}'"
            self.add_log(service=repo_name, level="INFO", message=log_msg)
            summary = f"PR #{pr_number} {pr_status} into {base_ref}"
            self.record_webhook_event("pull_request", payload, status="processed", summary=summary)
            return {"prNumber": pr_number, "action": action, "status": pr_status}

        summary = f"PR #{pr_number} {action} acknowledged"
        self.record_webhook_event("pull_request", payload, status="ignored", summary=summary)
        return {"prNumber": pr_number, "action": action, "status": "acknowledged"}

    def record_webhook_event(self, event_type, payload, status="processed", summary=""):
        """Records webhook event in memory for real-time UI diagnostics."""
        event_entry = {
            "id": f"wh-{len(self.webhook_events) + 1:04d}",
            "event": event_type,
            "status": status,
            "summary": summary,
            "timestamp": datetime.now().isoformat(),
            "deliveryId": payload.get("delivery_id") or f"del-{int(time.time() * 1000)}",
            "repo": (payload.get("repository", {}) or {}).get("name") or "SentinelOps",
            "sender": (payload.get("sender", {}) or {}).get("login") or payload.get("pusher", {}).get("name") or "github",
        }
        self.webhook_events.insert(0, event_entry)
        if len(self.webhook_events) > 50:
            self.webhook_events.pop()
        return event_entry

    def get_webhook_history(self, limit=20):
        """Returns recent webhook events."""
        return self.webhook_events[:limit]

    def dispatch_github_workflow(self, branch="main", workflow="deploy.yml", inputs=None):
        """
        Dispatches a workflow_dispatch event to GitHub Actions via the GitHub REST API.
        If GITHUB_TOKEN is available, makes a live HTTPS request to GitHub.
        Otherwise, triggers an autonomous simulated workflow in SentinelOps.
        """
        import urllib.request
        import urllib.error

        token = os.environ.get("GITHUB_TOKEN")
        repo = os.environ.get("GITHUB_REPO", "naveenkumar030/SentinelOps")

        if token:
            url = f"https://api.github.com/repos/{repo}/actions/workflows/{workflow}/dispatches"
            req_data = json.dumps({"ref": branch, "inputs": inputs or {}}).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=req_data,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "SentinelOps-DevOps-Agent",
                    "Content-Type": "application/json",
                },
                method="POST"
            )
            try:
                with urllib.request.urlopen(req, timeout=10) as resp:
                    if resp.status in (200, 204):
                        pipe = self.trigger_pipeline(repo="SentinelOps", branch=branch, name=f"GitHub Actions: {workflow}")
                        self.add_log(service="GitHub-Dispatch", level="INFO", message=f"Successfully dispatched '{workflow}' to {repo}@{branch} via GitHub API")
                        return {"success": True, "live": True, "repo": repo, "branch": branch, "pipeline": pipe}
            except urllib.error.HTTPError as e:
                err_msg = f"GitHub API dispatch error ({e.code}): {e.reason}"
                self.add_log(service="GitHub-Dispatch", level="ERROR", message=err_msg)
                return {"success": False, "live": True, "error": err_msg}
            except Exception as ex:
                err_msg = f"GitHub API connection error: {str(ex)}"
                self.add_log(service="GitHub-Dispatch", level="ERROR", message=err_msg)
                return {"success": False, "live": True, "error": err_msg}

        # Simulation fallback when GITHUB_TOKEN is not configured in local environment
        pipe = self.trigger_pipeline(repo="SentinelOps", branch=branch, name=f"Autonomous Workflow ({workflow})")
        self.add_log(
            service="GitHub-Dispatch",
            level="INFO",
            message=f"Dispatched workflow '{workflow}' for {repo}@{branch} in Autonomous Mode (Set GITHUB_TOKEN for direct GitHub Actions API calls)"
        )
        return {
            "success": True,
            "live": False,
            "message": "Dispatched in Autonomous Simulation mode. Set GITHUB_TOKEN to trigger GitHub Actions directly.",
            "repo": repo,
            "branch": branch,
            "pipeline": pipe
        }


# Singleton instance
store = DataStore()

