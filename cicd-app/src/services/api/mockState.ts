import type {
  Incident,
  Pipeline,
  AIAgent,
  PullRequest,
  LogEntry,
} from '../../types';
import type { SettingsData } from './types';
import {
  incidents as mockIncidents,
  pipelines as mockPipelines,
  aiAgents as mockAiAgents,
  pullRequests as mockPullRequests,
  logEntries as mockLogs,
} from '../../data/mockData';

export const localIncidents: Incident[] = [...mockIncidents];
export const localPipelines: Pipeline[] = [...mockPipelines];
export const localAgents: AIAgent[] = [...mockAiAgents];
export const localPRs: PullRequest[] = [...mockPullRequests];
export let localLogs: LogEntry[] = [...mockLogs];
export const localSettings: SettingsData = {
  confidenceThreshold: 95,
  autoMergeActive: true,
  ciSuccessRequired: true,
  zeroCveRequired: true,
  humanApprovalRequired: false,
  killSwitchEngaged: false,
};

export function setLocalLogs(updater: (prev: LogEntry[]) => LogEntry[]) {
  localLogs = updater(localLogs);
}
