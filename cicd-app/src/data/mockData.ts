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
    name: 'Diagnoser Agent',
    role: 'Root Cause Analysis',
    status: 'active',
    capability: 'Semantic log parsing, stack trace isolation & failure triage',
    tasksCompleted: 0,
    currentTask: 'Listening for workflow failures & analyzing root causes',
    successRate: 100.0,
    lastSeen: 'now',
    tags: ['rca', 'log-analysis', 'groq', 'diagnoser'],
  },
  {
    id: 'agent-002',
    name: 'Fix Suggester Agent',
    role: 'Autonomous Remediation',
    status: 'active',
    capability: 'Deterministic code patch synthesis & automated PR generation',
    tasksCompleted: 0,
    currentTask: 'Synthesizing unified code diffs & candidate pull requests',
    successRate: 100.0,
    lastSeen: 'now',
    tags: ['patching', 'auto-fix', 'diff-engine', 'github-api'],
  },
  {
    id: 'agent-003',
    name: 'Critic / Verifier Agent',
    role: 'Quality & Confidence Gate',
    status: 'active',
    capability: 'AST validation, confidence scoring (0-100%) & iterative patch refinement',
    tasksCompleted: 0,
    currentTask: 'Evaluating proposed patches against security and syntax policies',
    successRate: 100.0,
    lastSeen: 'now',
    tags: ['critic', 'confidence-gate', 'refinement', 'groq'],
  },
  {
    id: 'agent-004',
    name: 'MergeGuard-Zero',
    role: 'Autonomous Merge Safety Boundary',
    status: 'active',
    capability: 'Enforces 7-point strict safety policy before authorizing autonomous merges',
    tasksCompleted: 0,
    currentTask: 'Auditing PR safety conditions, secret scans, confidence & CI status for auto-merge',
    successRate: 100.0,
    lastSeen: 'now',
    tags: ['auto-merge', 'safety-gate', 'zero-downtime', 'sentinelguard'],
  },
  {
    id: 'agent-005',
    name: 'CanaryGuard',
    role: 'Progressive Delivery & Rollback',
    status: 'active',
    capability: 'Consecutive HTTP probe verification & automated zero-downtime rollback',
    tasksCompleted: 0,
    currentTask: 'Monitoring progressive delivery canary health & deployment stability',
    successRate: 100.0,
    lastSeen: 'now',
    tags: ['canary', 'rollout', 'health-checks', 'rollback'],
  },
];

// ─── Pull Requests ────────────────────────────────────────────────────────────
export const pullRequests: PullRequest[] = [];

// ─── Logs ─────────────────────────────────────────────────────────────────────
export const logEntries: LogEntry[] = [];

