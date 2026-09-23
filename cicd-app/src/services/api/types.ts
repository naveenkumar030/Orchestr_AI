import type {
  KpiMetric,
  RemediationStep,
  Incident,
  Pipeline,
} from '../../types';

export interface HealthResponse {
  status: string;
  backend: string;
  version: string;
  pythonVersion?: string;
  pid?: number;
  aiKernel?: string;
  uptimeSeconds?: number;
  activePipelines?: number;
  activeIncidents?: number;
  activeAgents?: number;
  totalAgents?: number;
  timestamp?: string;
  database?: string;
  mongo_connected?: boolean;
  mongo_db?: string;
  mongo_latency_ms?: number;
  mongo_stats?: Record<string, unknown>;
}

export interface DatabaseStatusResponse {
  status: string;
  provider: string;
  database: string;
  connected: boolean;
  configured: boolean;
  latency_ms: number;
  last_ping_time: number;
  collections: Record<string, number>;
}

export interface OverviewResponse {
  kpiMetrics: KpiMetric[];
  remediationSteps: RemediationStep[];
  incidents: Incident[];
  pipelines: Pipeline[];
  stats: {
    successRate: string;
    failureRate: string;
    avgRecovery: string;
    autoResolution: string;
  };
}

export interface IncidentExplanation {
  incidentId: string;
  repo: string;
  pipeline: string;
  confidence: number;
  rootCause: string;
  explanation: string;
  suggestedAction: string;
  policyCheck: string;
  aiModel?: string;
  errorType?: string;
  targetFile?: string;
  diff?: string;
  fixedContent?: string;
  riskLevel?: string;
  guardStatus?: string;
  blastRadius?: string;
  linesAdded?: number;
  linesDeleted?: number;
  steps?: string[];
  rawLogsSnippet?: string;
}

export interface SettingsData {
  confidenceThreshold: number;
  autoMergeActive: boolean;
  ciSuccessRequired: boolean;
  zeroCveRequired: boolean;
  humanApprovalRequired: boolean;
  killSwitchEngaged: boolean;
  [key: string]: unknown;
}

export interface GitHubWebhookEvent {
  id: string;
  event: string;
  status: string;
  summary: string;
  timestamp: string;
  deliveryId: string;
  repo: string;
  sender: string;
}

export interface SmeeRelayStatus {
  running: boolean;
  connected: boolean;
  channelId: string;
  smeeUrl: string;
  targetUrl: string;
  eventsForwarded: number;
  lastEventTime?: string;
  lastError?: string;
}

export interface NgrokStatus {
  running: boolean;
  publicUrl?: string;
  webhookUrl?: string;
  port?: number;
  tokenConfigured?: boolean;
  lastError?: string;
}

export interface GitHubStatusResponse {
  status: string;
  repository: string;
  webhookEndpoint: string;
  secretConfigured: boolean;
  tokenConfigured: boolean;
  mode: string;
  relay?: SmeeRelayStatus;
  ngrok?: NgrokStatus;
  recentEvents: GitHubWebhookEvent[];
  totalEventsReceived: number;
}

export interface RemediationResult {
  status?: string;
  incidentId?: string;
  agent?: string;
  rootCause?: string;
  confidence?: number;
  targetFile?: string;
  remediationBranch?: string;
  prNumber?: number;
  prUrl?: string;
  diff?: string;
  explanation?: string;
  data?: {
    status?: string;
    pr_number?: number;
    deployment?: { status?: string };
    health_check?: { status?: string };
  };
  [key: string]: unknown;
}

export interface ValidationResult {
  status?: string;
  conclusion?: string;
  duration_seconds?: number;
  workflow_id?: number;
  message?: string;
  [key: string]: unknown;
}
