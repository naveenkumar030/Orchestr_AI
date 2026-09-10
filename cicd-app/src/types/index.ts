
export interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge?: { text: string; variant: 'neutral' | 'error' | 'pulse' };
  active?: boolean;
}


export type IncidentStatus =
  | 'Fixed'
  | 'Failed'
  | 'Investigating'
  | 'PR Created'
  | 'Needs Approval'
  | 'Resolved';

export interface Incident {
  id: string;
  repo: string;
  pipeline: string;
  failure: string;
  rootCause: string;
  confidence: number;          // 0-100
  confidenceColor: 'primary' | 'error' | 'tertiary';
  status: IncidentStatus;
  time: string;
  actionLabel?: string;
  actionVariant?: 'default' | 'primary';
}

// ─── Pipelines ────────────────────────────────────────────────────────────────
export type PipelineStatus = 'running' | 'success' | 'failed' | 'queued' | 'cancelled';

export interface PipelineStage {
  name: string;
  status: PipelineStatus;
  duration?: string;
}

export interface Pipeline {
  id: string;
  name: string;
  repo: string;
  branch: string;
  commit: string;
  status: PipelineStatus;
  stages: PipelineStage[];
  duration: string;
  triggeredBy: string;
  time: string;
  aiFixed?: boolean;
}

// ─── AI Agents ────────────────────────────────────────────────────────────────
export type AgentStatus = 'active' | 'idle' | 'processing' | 'standby';

export interface AgentTask {
  label: string;
  status: 'done' | 'running' | 'pending';
}

export interface AIAgent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  capability: string;
  tasksCompleted: number;
  currentTask?: string;
  successRate: number;
  lastSeen: string;
  tags: string[];
  hostRunner?: string;
  modelBackend?: string;
}

// ─── Pull Requests ────────────────────────────────────────────────────────────
export type PRStatus = 'approved' | 'changes_requested' | 'reviewing' | 'merged' | 'draft';

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  repo: string;
  branch: string;
  author: string;
  status: PRStatus;
  aiReviewScore?: number;
  comments: number;
  additions: number;
  deletions: number;
  time: string;
  aiComment?: string;
}

// ─── Logs ─────────────────────────────────────────────────────────────────────
export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  traceId?: string;
}

// ─── Analytics / KPI ──────────────────────────────────────────────────────────
export interface KpiMetric {
  label: string;
  value: string;
  trend: string;
  trendDirection: 'up' | 'down';
  trendPositive: boolean;   // up can be positive (success rate) or negative (failed count)
  sub: string;
  subRight: string;
  progress: number;         // 0-100
  progressColor: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  hoverBorder: string;
}

// ─── Agent Remediation Steps ──────────────────────────────────────────────────
export type StepStatus = 'done' | 'running' | 'pending';

export interface RemediationStep {
  id: string;
  label: string;
  description?: string;
  time?: string;
  status: StepStatus;
}

// ─── Analytics Telemetry ──────────────────────────────────────────────────────
export interface MicroserviceTelemetry {
  name: string;
  cluster: string;
  events: string;
  rate: string;
  saved: string;
  health: string;
}

export interface AnalyticsResponse {
  timeRange?: string;
  dora?: {
    deploymentFrequency: string;
    deploymentFrequencyRating: string;
    leadTimeForChanges: string;
    leadTimeRating: string;
    changeFailureRate: string;
    changeFailureRating: string;
    mttr: string;
    mttrRating: string;
  };
  velocity?: {
    prsProcessed: number;
    avgMergeTime: string;
    autoFixRate: string;
    humanOverrideRate: string;
    hoursSaved: string;
    costSaved: string;
    patchesSynthesized: number;
  };
  mttr?: {
    current: string;
    previous: string;
    reductionPercent: string;
  };
  failureCategories?: Array<{
    name: string;
    percentage: number;
  }>;
  microservices?: MicroserviceTelemetry[];
}
