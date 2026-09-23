import { healthApi } from './health';
import { incidentsApi } from './incidents';
import { deploymentsApi } from './deployments';
import { reasoningApi } from './reasoning';
import { actionsApi } from './actions';
import { pipelinesApi } from './pipelines';
import { agentsApi } from './agents';
import { pullRequestsApi } from './pullRequests';
import { logsApi } from './logs';
import { settingsApi } from './settings';
import { analyticsApi } from './analytics';
import { githubApi } from './github';
import { reliabilityApi } from './reliability';

export const api = {
  ...healthApi,
  ...incidentsApi,
  ...deploymentsApi,
  ...reasoningApi,
  ...actionsApi,
  ...pipelinesApi,
  ...agentsApi,
  ...pullRequestsApi,
  ...logsApi,
  ...settingsApi,
  ...analyticsApi,
  ...githubApi,
  ...reliabilityApi,
};

export * from './types';
export * from './client';
export * from './health';
export * from './incidents';
export * from './deployments';
export * from './reasoning';
export * from './actions';
export * from './pipelines';
export * from './agents';
export * from './pullRequests';
export * from './logs';
export * from './settings';
export * from './analytics';
export * from './github';
export * from './reliability';
