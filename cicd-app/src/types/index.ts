
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
  | 'Validating'
  | 'Validating CI'
  | 'Needs Approval'
  | 'Deploying'
  | 'Verifying Health'
  | 'Rolling Back'
  | 'Verifying Rollback'
  | 'Rolled Back'
  | 'Resolved'
  | 'Remediated'
  | 'Blocked'
  | 'Escalated';

export interface RemediationAttempt {
  attempt_number: number;
  commit_sha?: string;
  patch_strategy?: string;
  patch_summary?: string;
  files_changed?: string[];
  diff?: string;
  confidence?: number;
  ci_validation?: {
    status: 'PASSED' | 'FAILED' | 'TIMEOUT' | 'SKIPPED' | 'RUNNING';
    workflow_id?: number;
    duration_seconds?: number;
    html_url?: string;
    failure_reason?: string;
    conclusion?: string;
  };
  evaluation?: {
    is_valid_fix: boolean;
    regression_detected: boolean;
    recommendation: 'MERGE' | 'RETRY' | 'ESCALATE';
    reasoning: string;
  };
  merge_guard?: {
    allowed: boolean;
    reasons: string[];
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    policy_checks?: Record<string, boolean>;
  };
  outcome: 'AUTO_MERGED' | 'RESOLVED' | 'RETRY_NEEDED' | 'ESCALATED' | 'BLOCKED';
  timestamp?: string;
}

export interface IncidentTimelineEvent {
  time: string;
  title: string;
  description: string;
  icon: string;
  status: 'done' | 'running' | 'failed' | 'pending';
}

export interface MttrMetrics {
  time_to_diagnosis: string;
  time_to_patch: string;
  time_to_validation: string;
  time_to_merge: string;
  time_to_deploy?: string;
  time_to_health_check?: string;
  time_to_rollback?: string;
  total_mttr: string;
  total_mttr_seconds: number;
}

export interface DeploymentRecord {
  deployment_id: string;
  incident_id: string;
  repo: string;
  branch: string;
  commit_sha: string;
  provider: string;
  target_environment: string;
  status: 'QUEUED' | 'DEPLOYING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'CANCELLED';
  workflow_id?: number;
  deployment_url?: string;
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
  error_message?: string;
  logs_tail?: string;
}

export interface HealthCheckProbe {
  probe_number: number;
  timestamp: string;
  status_code?: number;
  latency_ms: number;
  is_healthy: boolean;
  error?: string;
}

export interface HealthCheckResult {
  incident_id?: string;
  url: string;
  status: 'HEALTHY' | 'UNHEALTHY' | 'TIMEOUT' | 'UNKNOWN';
  consecutive_successes: number;
  success_threshold: number;
  total_probes: number;
  probes: HealthCheckProbe[];
  average_latency_ms: number;
  verified_at?: string;
  reason?: string;
}

export interface RollbackRecord {
  rollback_id: string;
  incident_id: string;
  repo: string;
  branch: string;
  failed_commit_sha: string;
  rollback_commit_sha: string;
  status: 'PENDING' | 'ROLLING_BACK' | 'SUCCESS' | 'FAILED' | 'HEALTH_VERIFIED';
  strategy: string;
  revert_pr_number?: number;
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
  health_status?: string;
  audit_events: Array<{
    timestamp: string;
    action: string;
    details: string;
  }>;
  error_message?: string;
}

export interface Incident {
  id: string;
  repo: string;
  pipeline: string;
  failure: string;
  rootCause: string;
  confidence: number;          // 0-100
  confidenceColor: 'primary' | 'error' | 'tertiary' | 'secondary';
  status: IncidentStatus;
  time: string;
  actionLabel?: string;
  actionVariant?: 'default' | 'primary' | 'secondary' | 'error';
  runId?: number;
  branch?: string;
  commit?: string;
  prNumber?: number | string;
  prUrl?: string;
  remediationBranch?: string;
  targetFile?: string;
  diff?: string;
  explanation?: string;
  guard_status?: string;
  risk_level?: string;
  files_changed?: number;
  lines_added?: number;
  lines_deleted?: number;
  block_reasons?: string[];
  attempts?: RemediationAttempt[];
  attemptCount?: number;
  timeline?: IncidentTimelineEvent[];
  mttrMetrics?: MttrMetrics;
  deployment?: DeploymentRecord;
  healthCheck?: HealthCheckResult;
  rollback?: RollbackRecord;
  agent_reasoning?: MultiAgentReasoningResult;
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
  guard_status?: string;
  risk_level?: string;
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

// ─── Phase 3: Multi-Agent Reasoning Types ────────────────────────────────────
export type DiagnoserCategory =
  | 'dependency_error'
  | 'flaky_test'
  | 'syntax_or_lint_error'
  | 'timeout_or_infrastructure'
  | 'missing_secret_or_config'
  | 'build_error'
  | 'test_failure'
  | 'unknown';

export interface DiagnoserResult {
  category: DiagnoserCategory;
  root_cause: string;
  confidence: number;
  evidence: string[];
  affected_files: string[];
  affected_components: string[];
  suggested_fix_direction: string;
}

export type FixType = 'code' | 'dependency' | 'configuration' | 'workflow' | 'test' | 'unknown';

export interface FixSuggesterResult {
  fix_type: FixType;
  description: string;
  affected_files: string[];
  patch: string;
  reason: string;
  confidence: number;
}

export interface CriticResult {
  approved: boolean;
  score: number;
  issues: string[];
  reason: string;
  recommended_changes: string[];
  security_concerns: string[];
  requires_human_review: boolean;
}

export interface AgentExecutionStep {
  agent: string;
  role?: string;
  status: 'completed' | 'active' | 'running' | 'error' | 'pending';
  duration_ms: number;
  confidence?: number;
  score?: number;
  approved?: boolean;
  final_status?: string;
  input_summary: string;
  output_summary: string;
  error?: string | null;
}

export interface RefinementHistoryItem {
  attempt_number: number;
  fix: FixSuggesterResult;
  critic: CriticResult;
  approved: boolean;
  duration_ms: number;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type ApprovalStatus =
  | 'auto_approved'
  | 'auto_rejected'
  | 'pending_review'
  | 'approved_by_human'
  | 'rejected_by_human'
  | 'expired';

export interface RiskAssessment {
  risk_level: RiskLevel;
  factors: string[];
  file_risks: Record<string, string>;
  diff_stats: {
    lines_added: number;
    lines_deleted: number;
    total_lines: number;
  };
  security_concerns: string[];
  destructive_patterns_detected: boolean;
  requires_human_review: boolean;
}

export interface SafetyGateResult {
  decision: 'approved' | 'rejected' | 'human_review_required';
  approval_status: ApprovalStatus;
  risk_level: RiskLevel;
  diagnosis_confidence: number;
  fix_confidence: number;
  critic_score: number;
  critic_approved: boolean;
  security_findings: string[];
  reasons: string[];
  requires_human_review: boolean;
  thresholds: {
    diagnosis: number;
    fix: number;
    critic: number;
    max_auto_approval_risk: string;
  };
}

export interface HumanApprovalRecord {
  incident_id: string;
  approval_status: ApprovalStatus;
  automated_decision: string;
  risk_level: RiskLevel;
  diagnosis_confidence?: number;
  fix_confidence?: number;
  critic_score?: number;
  critic_approved?: boolean;
  security_findings?: string[];
  reasons?: string[];
  approved_by?: string | null;
  approval_comment?: string | null;
  decided_at?: string | null;
  created_at?: string;
  updated_at?: string;
  audit_trail?: Array<{
    action: string;
    status: string;
    actor?: string;
    comment?: string;
    decision?: string;
    timestamp: string;
    details?: string;
  }>;
}

export interface MultiAgentReasoningResult {
  status: 'approved' | 'rejected' | 'human_review_required';
  approval_status?: ApprovalStatus;
  incident_id?: string;
  repository?: string;
  workflow_name?: string;
  commit_sha?: string;
  timestamp?: string;
  diagnosis: DiagnoserResult;
  fix: FixSuggesterResult;
  critic: CriticResult;
  risk_assessment?: RiskAssessment;
  safety_gate?: SafetyGateResult;
  human_approval?: HumanApprovalRecord;
  attempts: number;
  refinement_history: RefinementHistoryItem[];
  agent_timeline: AgentExecutionStep[];
  execution_metrics: {
    total_duration_ms: number;
    attempts_count: number;
    final_critic_score: number;
    is_approved: boolean;
    requires_human_review: boolean;
    risk_level?: RiskLevel;
    approval_status?: ApprovalStatus;
  };
}

// ==========================================
// PHASE 5: NOTIFICATION & SAFE ACTION TYPES
// ==========================================

export type NotificationStatus = 'SENT' | 'FAILED' | 'SKIPPED_DUPLICATE' | 'SKIPPED_DISABLED' | 'CONFIG_ERROR';
export type SafeActionStatus = 'success' | 'blocked' | 'skipped' | 'failed';

export interface SafeActionRecord {
  action_id: string;
  incident_id: string;
  action_type: 'CREATE_DRAFT_PR' | 'SLACK_NOTIFY' | string;
  status: SafeActionStatus;
  pr_number?: number | null;
  pr_url?: string | null;
  branch_name?: string | null;
  target_branch?: string | null;
  patch_summary?: {
    files_changed: number;
    additions: number;
    deletions: number;
    files: string[];
  };
  preconditions_checked?: Record<string, boolean>;
  blocking_reasons?: string[];
  details?: Record<string, unknown>;
  created_at: string;
}

export interface SlackNotificationRecord {
  notification_id?: string;
  incident_id: string;
  event_type: string;
  status: NotificationStatus;
  channel?: string;
  timestamp: string;
  details?: string;
  error?: string;
}

export interface IncidentActionsResponse {
  incident_id: string;
  actions: SafeActionRecord[];
  total: number;
}

export interface CreateDraftPrRequest {
  target_branch?: string;
  title_prefix?: string;
  custom_body_notes?: string;
  actor?: string;
}

export interface SendNotificationRequest {
  event_type?: string;
  channel_override?: string;
  actor?: string;
}

// ── Phase 6 Reliability & Resilience Types ────────────────────────────────────

export interface CircuitBreakerStatus {
  provider: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  is_available: boolean;
  consecutive_failures: number;
  failure_threshold: number;
  cooldown_seconds: number;
  remaining_cooldown_seconds: number;
  total_requests: number;
  total_successes: number;
  total_failures: number;
  last_failure_time?: number | null;
  last_state_change_time?: number;
}

export interface DiagnosisCacheStats {
  active_entries_count: number;
  total_stored: number;
  hits: number;
  misses: number;
  hit_rate_pct: number;
  evictions: number;
  invalidations: number;
  default_ttl_seconds: number;
  entries?: Array<Record<string, unknown>>;
}

export interface ReliabilityTelemetrySummary {
  uptime_seconds: number;
  llm_requests_total: number;
  llm_success_rate_pct: number;
  provider_invocations: Record<string, number>;
  retries_total: number;
  retries_by_reason: Record<string, number>;
  fallbacks_total: number;
  circuit_breaker_trips: number;
  cache_hits: number;
  cache_misses: number;
  cache_hit_rate_pct: number;
  deduplications_blocked: number;
  tokens_consumed: number;
  tokens_saved_by_caching: number;
  estimated_cost_saved_usd: number;
  recent_fallback_routes?: Array<Record<string, unknown>>;
  recent_events?: Array<{
    type: string;
    detail: string;
    timestamp: number;
    iso_time: string;
  }>;
}

export interface ReliabilityStatusResponse {
  status: string;
  timestamp: number;
  telemetry: ReliabilityTelemetrySummary;
  cache: DiagnosisCacheStats;
  providers: Record<string, CircuitBreakerStatus>;
  config: {
    primary_llm: string;
    fallback_llm: string;
    ollama_enabled: boolean;
    max_retries: number;
    diagnosis_cache_ttl_seconds: number;
    circuit_failure_threshold: number;
    circuit_cooldown_seconds: number;
    llm_timeout_seconds: number;
    agent_timeout_seconds: number;
  };
}

export interface RemediationResult {
  success: boolean;
  status: string;
  incidentId: string;
  prNumber?: number | string;
  remediationBranch?: string;
  patchApplied?: boolean;
  message?: string;
  checks?: Record<string, unknown>;
  data?: any;
}

export interface IncidentAttempt {
  attempt_number: number;
  strategy: string;
  status: 'PENDING' | 'PASSED' | 'FAILED' | 'REVERTED' | string;
  created_at: string;
  branch?: string;
  pr_number?: number;
  test_passed?: boolean;
  error?: string;
  notes?: string;
}

export interface IncidentTimelineItem {
  id: string;
  timestamp: string;
  actor: string;
  event: string;
  category: 'DETECTION' | 'TRIAGE' | 'FIX' | 'DEPLOY' | 'SAFETY_GATE' | 'VERIFICATION' | string;
  status: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS' | 'NEUTRAL' | string;
  details?: string;
}

export interface ValidationResult {
  success: boolean;
  status: 'PASSED' | 'FAILED' | 'RUNNING' | string;
  testSuite?: string;
  totalTests?: number;
  passedTests?: number;
  failedTests?: number;
  durationMs?: number;
  duration_seconds?: number;
  logs?: string[];
  reportUrl?: string;
}

export interface MergeGuardResult {
  allowed: boolean;
  checks: Record<string, boolean>;
  failingChecks?: string[];
  blockReasons?: string[];
  incidentId: string;
  timestamp?: string;
}

export interface DeploymentGuardResult {
  allowed: boolean;
  canDeploy: boolean;
  healthThresholdMet: boolean;
  riskScore: number;
  checks: Record<string, boolean>;
  blockReasons?: string[];
  message?: string;
}

export interface DatabaseSyncResult {
  success: boolean;
  message: string;
  synced?: Record<string, unknown>;
  stats?: Record<string, unknown>;
  error?: string;
}
