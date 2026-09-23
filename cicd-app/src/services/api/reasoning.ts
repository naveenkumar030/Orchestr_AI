import { request, actionRequest } from './client';
import type {
  MultiAgentReasoningResult,
  HumanApprovalRecord,
  SafetyGateResult,
} from '../../types';

export const reasoningApi = {
  /**
   * Phase 3: Multi-Agent Reasoning (Diagnoser -> FixSuggester -> Critic)
   */
  async runMultiAgentReasoning(payload: {
    logs: string;
    repository?: string;
    workflow_name?: string;
    job_name?: string;
    failed_step?: string;
    commit_sha?: string;
    repo_context?: Record<string, string>;
    incident_id?: string;
    max_attempts?: number;
  }): Promise<MultiAgentReasoningResult> {
    const mockHandler = (): MultiAgentReasoningResult => ({
      status: 'approved',
      incident_id: payload.incident_id || 'INC-8924',
      repository: payload.repository || 'SentinelOps',
      workflow_name: payload.workflow_name || 'CI/CD Workflow',
      commit_sha: payload.commit_sha || 'a1b2c3d',
      timestamp: new Date().toISOString(),
      diagnosis: {
        category: 'dependency_error',
        root_cause: 'Conflicting npm peer dependency tree for @stripe/stripe-node',
        confidence: 0.96,
        evidence: ['npm ERR! ERESOLVE could not resolve peer dependency tree'],
        affected_files: ['package.json'],
        affected_components: ['npm-packages'],
        suggested_fix_direction: 'Reconcile peer dependency version in package.json',
      },
      fix: {
        fix_type: 'dependency',
        description: 'Upgrade @stripe/stripe-node dependency in package.json',
        affected_files: ['package.json'],
        patch: '--- a/package.json\n+++ b/package.json\n@@ -28,3 +28,3 @@\n-    "@stripe/stripe-node": "^12.1.0",\n+    "@stripe/stripe-node": "^14.1.0",\n',
        reason: 'Resolves npm peer dependency mismatch with @types/node',
        confidence: 0.95,
      },
      critic: {
        approved: true,
        score: 0.94,
        issues: [],
        reason: 'Proposed patch is minimal, directly addresses the root cause, and passes all 10 safety and regression checks.',
        recommended_changes: [],
        security_concerns: [],
        requires_human_review: false,
      },
      attempts: 1,
      refinement_history: [
        {
          attempt_number: 1,
          fix: {
            fix_type: 'dependency',
            description: 'Upgrade @stripe/stripe-node dependency in package.json',
            affected_files: ['package.json'],
            patch: '--- a/package.json\n+++ b/package.json\n@@ -28,3 +28,3 @@\n-    "@stripe/stripe-node": "^12.1.0",\n+    "@stripe/stripe-node": "^14.1.0",\n',
            reason: 'Resolves npm peer dependency mismatch with @types/node',
            confidence: 0.95,
          },
          critic: {
            approved: true,
            score: 0.94,
            issues: [],
            reason: 'Proposed patch is minimal, directly addresses root cause.',
            recommended_changes: [],
            security_concerns: [],
            requires_human_review: false,
          },
          approved: true,
          duration_ms: 380,
        },
      ],
      agent_timeline: [
        {
          agent: 'Log Fetcher',
          role: 'Telemetry & Sanitizer',
          status: 'completed',
          duration_ms: 12,
          input_summary: 'Ingested runner logs',
          output_summary: 'Sanitized 1,420 bytes of logs. Masked tokens/secrets.',
        },
        {
          agent: 'Diagnoser',
          role: 'Root-Cause Analysis',
          status: 'completed',
          duration_ms: 220,
          confidence: 0.96,
          input_summary: 'Clean logs (1,420 bytes)',
          output_summary: 'Category: dependency_error | Root Cause: Conflicting npm peer dependency tree',
        },
        {
          agent: 'FixSuggester (Attempt #1)',
          role: 'Patch Synthesis',
          status: 'completed',
          duration_ms: 190,
          confidence: 0.95,
          input_summary: 'Diagnosis (dependency_error)',
          output_summary: 'Generated unified diff for package.json',
        },
        {
          agent: 'Critic / Verifier (Attempt #1)',
          role: 'Adversarial Review',
          status: 'completed',
          duration_ms: 180,
          score: 0.94,
          approved: true,
          input_summary: 'Proposed patch for package.json',
          output_summary: 'APPROVED (Score: 94%) | Zero regression verified',
        },
        {
          agent: 'Final Decision',
          role: 'Consensus Gate',
          status: 'completed',
          duration_ms: 1,
          final_status: 'approved',
          input_summary: 'Consensus across 1 attempt',
          output_summary: 'Status: APPROVED | Score: 0.94',
        },
      ],
      execution_metrics: {
        total_duration_ms: 603,
        attempts_count: 1,
        final_critic_score: 0.94,
        is_approved: true,
        requires_human_review: false,
      },
    });

    const { data } = await actionRequest<MultiAgentReasoningResult>(
      '/agents/reason',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      mockHandler
    );
    return data;
  },

  async getIncidentAgentReasoning(incidentId: string): Promise<MultiAgentReasoningResult> {
    return reasoningApi.runMultiAgentReasoning({ logs: `Incident ${incidentId} failure logs`, incident_id: incidentId });
  },

  async triggerIncidentAgentReasoning(
    incidentId: string,
    payload?: { logs?: string; repo_context?: Record<string, string>; max_attempts?: number }
  ): Promise<MultiAgentReasoningResult> {
    const mockHandler = async () =>
      reasoningApi.runMultiAgentReasoning({
        logs: payload?.logs || `Incident ${incidentId} failure logs`,
        incident_id: incidentId,
      });

    const { data } = await actionRequest<MultiAgentReasoningResult>(
      `/incidents/${incidentId}/agent-reasoning`,
      {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      },
      mockHandler
    );
    return data;
  },

  /**
   * Phase 4: Confidence Gate & Human Approval
   */
  async getIncidentApproval(incidentId: string): Promise<HumanApprovalRecord> {
    const fallback: HumanApprovalRecord = {
      incident_id: incidentId,
      approval_status: 'pending_review',
      automated_decision: 'human_review_required',
      risk_level: 'medium',
      diagnosis_confidence: 0.94,
      fix_confidence: 0.90,
      critic_score: 0.88,
      critic_approved: true,
      security_findings: [],
      reasons: ['Risk level MEDIUM requires operator authorization prior to deployment'],
      audit_trail: [
        {
          action: 'SAFETY_GATE_EVALUATED',
          status: 'pending_review',
          decision: 'human_review_required',
          timestamp: new Date().toISOString(),
          details: 'Automated decision: human_review_required (Risk: medium)',
        },
      ],
    };

    const { data } = await request<HumanApprovalRecord>(
      `/incidents/${incidentId}/approval`,
      { method: 'GET' },
      fallback
    );
    return data;
  },

  async submitIncidentApproval(
    incidentId: string,
    decision: 'approve' | 'reject',
    comment?: string,
    approver?: string
  ): Promise<{ success: boolean; approval_status: string; incident_id: string; record?: HumanApprovalRecord; error?: string }> {
    const mockHandler = () => ({
      success: true,
      incident_id: incidentId,
      approval_status: decision === 'approve' ? 'approved_by_human' : 'rejected_by_human',
      approved_by: approver || 'lead-devops',
      comment: comment || `[Demo Mode] Manually ${decision}d via SentinelOps Control Center`,
      timestamp: new Date().toISOString(),
    });

    const { data } = await actionRequest<{
      success: boolean;
      approval_status: string;
      incident_id: string;
      record?: HumanApprovalRecord;
      error?: string;
    }>(
      `/incidents/${incidentId}/approval`,
      {
        method: 'POST',
        body: JSON.stringify({ decision, comment, approver }),
      },
      mockHandler
    );
    return data;
  },

  async evaluateConfidenceGate(payload: {
    diagnosis?: MultiAgentReasoningResult['diagnosis'];
    fix?: MultiAgentReasoningResult['fix'];
    critic?: MultiAgentReasoningResult['critic'];
    risk_assessment?: MultiAgentReasoningResult['risk_assessment'];
    target_branch?: string;
    target_file?: string;
    patch?: string;
  }): Promise<SafetyGateResult> {
    const mockHandler = (): SafetyGateResult => ({
      decision: 'human_review_required',
      approval_status: 'pending_review',
      risk_level: 'medium',
      diagnosis_confidence: payload.diagnosis?.confidence ?? 0.94,
      fix_confidence: payload.fix?.confidence ?? 0.90,
      critic_score: payload.critic?.score ?? 0.88,
      critic_approved: payload.critic?.approved ?? true,
      security_findings: [],
      reasons: ['[Demo Mode] Risk level medium requires operator review'],
      requires_human_review: true,
      thresholds: {
        diagnosis: 0.85,
        fix: 0.85,
        critic: 0.70,
        max_auto_approval_risk: 'low',
      },
    });

    const { data } = await actionRequest<SafetyGateResult>(
      '/confidence-gate/evaluate',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      mockHandler
    );
    return data;
  },
};
