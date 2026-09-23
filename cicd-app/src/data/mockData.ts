import type { Incident, Pipeline, AIAgent, PullRequest, LogEntry, KpiMetric, RemediationStep, NavItem } from '../types';

// ─── Navigation ───────────────────────────────────────────────────────────────
export const navItems: NavItem[] = [
  { path: '/dashboard',     label: 'Overview',      icon: 'dashboard' },
  { path: '/pipelines',     label: 'Pipelines',     icon: 'account_tree' },
  { path: '/incidents',     label: 'Incidents',     icon: 'warning' },
  { path: '/ai-agents',     label: 'AI Agents',     icon: 'smart_toy',    badge: { text: '', variant: 'pulse' } },
  { path: '/pull-requests', label: 'Pull Requests', icon: 'call_merge' },
  { path: '/logs',          label: 'Logs',          icon: 'terminal' },
  { path: '/analytics',     label: 'Analytics',     icon: 'monitoring' },
  { path: '/settings',      label: 'Settings',      icon: 'tune' },
  { path: '/profile',       label: 'Profile',       icon: 'account_circle' },
];

// ─── KPI Cards (Overview) ─────────────────────────────────────────────────────
export const kpiMetrics: KpiMetric[] = [
  {
    label: 'Total Pipelines',
    value: '0',
    trend: 'No runs',
    trendDirection: 'up',
    trendPositive: true,
    sub: 'Repository connected',
    subRight: 'Live telemetry',
    progress: 0,
    progressColor: 'bg-[#D97757]',
    icon: 'account_tree',
    iconBg: 'bg-[#F9ECE7]',
    iconColor: 'text-[#D97757]',
    hoverBorder: 'hover:border-[#D97757]/40',
  },
  {
    label: 'Failed Pipelines',
    value: '0',
    trend: '0% failed',
    trendDirection: 'up',
    trendPositive: true,
    sub: '0 logged failures',
    subRight: 'Healthy',
    progress: 0,
    progressColor: 'bg-[#C34A4A]',
    icon: 'warning',
    iconBg: 'bg-[#FDF0F0]',
    iconColor: 'text-[#C34A4A]',
    hoverBorder: 'hover:border-[#C34A4A]/40',
  },
  {
    label: 'Auto Repaired',
    value: '0',
    trend: 'Autonomous',
    trendDirection: 'up',
    trendPositive: true,
    sub: 'Healer-Alpha triage & PRs',
    subRight: 'v2.4 Kernel',
    progress: 0,
    progressColor: 'bg-[#B87A36]',
    icon: 'auto_fix_high',
    iconBg: 'bg-[#F6EFE6]',
    iconColor: 'text-[#B87A36]',
    hoverBorder: 'hover:border-[#B87A36]/40',
  },
  {
    label: 'Recovery Rate',
    value: '100%',
    trend: 'avg MTTR: 0.0m',
    trendDirection: 'up',
    trendPositive: true,
    sub: 'Sub-minute resolution',
    subRight: 'Ready',
    progress: 100,
    progressColor: 'bg-[#D97757]',
    icon: 'bolt',
    iconBg: 'bg-[#F9ECE7]',
    iconColor: 'text-[#D97757]',
    hoverBorder: 'hover:border-[#D97757]/40',
  },
];

// ─── Agent Remediation Steps (Overview sidebar) ───────────────────────────────
export const remediationSteps: RemediationStep[] = [];

// ─── Incidents Table ──────────────────────────────────────────────────────────
export const incidents: Incident[] = [];

// ─── Pipelines ────────────────────────────────────────────────────────────────
export const pipelines: Pipeline[] = [];

// ─── AI Agents ────────────────────────────────────────────────────────────────
export const aiAgents: AIAgent[] = [
  {
    id: 'agent-001',
    name: 'Sentinel-α',
    role: 'Failure Detection',
    status: 'active',
    capability: 'Real-time CI/CD monitoring and anomaly detection',
    tasksCompleted: 0,
    currentTask: 'Listening for workflow events & telemetry',
    successRate: 100.0,
    lastSeen: 'now',
    tags: ['monitoring', 'anomaly-detection', 'real-time'],
  },
  {
    id: 'agent-002',
    name: 'Resolver-β',
    role: 'Root Cause Analysis',
    status: 'active',
    capability: 'Semantic log parsing and dependency graph traversal',
    tasksCompleted: 0,
    currentTask: 'Ready to triage pipeline failures',
    successRate: 100.0,
    lastSeen: 'now',
    tags: ['rca', 'log-analysis', 'dependency-graph'],
  },
  {
    id: 'agent-003',
    name: 'Patcher-γ',
    role: 'Autonomous Remediation',
    status: 'active',
    capability: 'Deterministic patch generation and lockfile reconciliation',
    tasksCompleted: 0,
    currentTask: 'Ready to synthesize autonomous code patches',
    successRate: 100.0,
    lastSeen: 'now',
    tags: ['patching', 'auto-fix', 'npm'],
  },
  {
    id: 'agent-004',
    name: 'Reviewer-δ',
    role: 'Code Review',
    status: 'active',
    capability: 'Semantic code diff analysis and PR review automation',
    tasksCompleted: 0,
    currentTask: 'Auditing pull requests & safety policies',
    successRate: 100.0,
    lastSeen: 'now',
    tags: ['code-review', 'pr-automation', 'ast-diff'],
  },
  {
    id: 'agent-005',
    name: 'Deploy-ε',
    role: 'Deployment Orchestration',
    status: 'active',
    capability: 'Helm chart validation and zero-downtime rollout management',
    tasksCompleted: 0,
    currentTask: 'Monitoring deployment health and canary status',
    successRate: 100.0,
    lastSeen: 'now',
    tags: ['helm', 'kubernetes', 'rollout', 'groq'],
  },
  {
    id: 'agent-006',
    name: 'Scanner-ζ',
    role: 'Security Scanning',
    status: 'active',
    capability: 'CVE detection, SAST analysis, and container image scanning',
    tasksCompleted: 0,
    currentTask: 'Scanning dependencies and container images',
    successRate: 100.0,
    lastSeen: 'now',
    tags: ['cve', 'sast', 'trivy', 'groq'],
  },
  {
    id: 'agent-007',
    name: 'Validator-Beta',
    role: 'Autonomous CI Validation',
    status: 'active',
    capability: 'Real-time GitHub Actions CI validation polling, log inspection & fix effectiveness evaluation',
    tasksCompleted: 0,
    currentTask: 'Ready to validate patches in ephemeral test runners',
    successRate: 100.0,
    lastSeen: 'now',
    tags: ['ci-validation', 'github-actions', 'regression-check', 'groq'],
  },
  {
    id: 'agent-008',
    name: 'MergeGuard-Zero',
    role: 'Autonomous Merge Safety Boundary',
    status: 'active',
    capability: 'Enforces 7-point strict safety policy before authorizing autonomous merges',
    tasksCompleted: 0,
    currentTask: 'Auditing safety gates and deployment policies',
    successRate: 100.0,
    lastSeen: 'now',
    tags: ['auto-merge', 'safety-gate', 'zero-downtime', 'sentinelguard'],
  },
];

// ─── Pull Requests ────────────────────────────────────────────────────────────
export const pullRequests: PullRequest[] = [];

// ─── Logs ─────────────────────────────────────────────────────────────────────
export const logEntries: LogEntry[] = [];
