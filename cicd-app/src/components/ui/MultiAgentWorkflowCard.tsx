import React, { useState } from 'react';
import type { MultiAgentReasoningResult } from '../../types';
import { api } from '../../services/api';
import {
  WorkflowPipelineFlow,
  WorkflowPipelineTab,
  WorkflowSafetyTab,
  WorkflowDiagnoserTab,
  WorkflowFixTab,
  WorkflowCriticTab,
  WorkflowHistoryTab,
  WorkflowActionsTab,
} from '../workflow';

interface MultiAgentWorkflowCardProps {
  reasoningData?: MultiAgentReasoningResult | null;
  isLoading?: boolean;
  onRerun?: () => void;
  onHumanApprove?: (comment?: string) => Promise<void> | void;
  onHumanReject?: (comment?: string) => Promise<void> | void;
  incidentId?: string;
  repo?: string;
}

export const MultiAgentWorkflowCard: React.FC<MultiAgentWorkflowCardProps> = ({
  reasoningData,
  isLoading = false,
  onRerun,
  onHumanApprove,
  onHumanReject,
  incidentId = 'INC-8924',
  repo = 'SentinelOps',
}) => {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'safety' | 'diagnoser' | 'fix' | 'critic' | 'history' | 'actions'>('pipeline');
  const [selectedAttempt, setSelectedAttempt] = useState<number>(0);
  const [copiedPatch, setCopiedPatch] = useState<boolean>(false);

  // Phase 4 Human Approval State
  const [approvalComment, setApprovalComment] = useState<string>('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState<boolean>(false);
  const [localApprovalStatus, setLocalApprovalStatus] = useState<string | null>(null);
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Phase 5 Safe Action & Notification State
  const [isCreatingPr, setIsCreatingPr] = useState<boolean>(false);
  const [targetBranch, setTargetBranch] = useState<string>('main');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [prResult, setPrResult] = useState<{
    success: boolean;
    status: string;
    pr_number?: number;
    pr_url?: string;
    branch_name?: string;
    message?: string;
    blocking_reasons?: string[];
  } | null>(null);
  const [prError, setPrError] = useState<string | null>(null);

  const [isSendingSlack, setIsSendingSlack] = useState<boolean>(false);
  const [slackResult, setSlackResult] = useState<{
    success: boolean;
    status?: string;
    message?: string;
    details?: string;
  } | null>(null);
  const [slackError, setSlackError] = useState<string | null>(null);
  const [notificationHistory, setNotificationHistory] = useState<Array<{
    event: string;
    status: string;
    timestamp: string;
    details: string;
  }>>([]);

  // Default fallback template if data is not yet loaded or missing properties
  const defaultFallbackData: MultiAgentReasoningResult = {
    status: 'approved',
    approval_status: 'auto_approved',
    incident_id: incidentId,
    repository: repo,
    workflow_name: 'CI / Test & Build',
    commit_sha: 'a1b2c3d',
    timestamp: new Date().toISOString(),
    diagnosis: {
      category: 'dependency_error',
      root_cause: 'Conflicting npm peer dependency tree for @stripe/stripe-node',
      confidence: 0.96,
      evidence: [
        'npm ERR! code ERESOLVE',
        'npm ERR! ERESOLVE could not resolve peer dependency tree',
        'npm ERR! While resolving: @stripe/stripe-node@12.1.0',
        'npm ERR! Conflicting peer dependency: @types/node@^18.0.0',
      ],
      affected_files: ['package.json'],
      affected_components: ['npm-packages', 'stripe-integration'],
      suggested_fix_direction: 'Upgrade @stripe/stripe-node version to reconcile peer dependency tree',
    },
    fix: {
      fix_type: 'dependency',
      description: 'Upgrade @stripe/stripe-node to ^14.1.0 in package.json',
      affected_files: ['package.json'],
      patch: `--- a/package.json
+++ b/package.json
@@ -28,3 +28,3 @@
-    "@stripe/stripe-node": "^12.1.0",
+    "@stripe/stripe-node": "^14.1.0",`,
      reason: 'Aligns stripe-node version with node runtime @types/node@20 to satisfy peer dependency bounds',
      confidence: 0.95,
    },
    critic: {
      approved: true,
      score: 0.94,
      issues: [],
      reason: 'Proposed patch is minimal (2 lines changed), directly addresses the root cause, and passes all 10 safety and regression checks.',
      recommended_changes: [],
      security_concerns: [],
      requires_human_review: false,
    },
    risk_assessment: {
      risk_level: 'low',
      factors: ['Minimal dependency manifest pin', 'Single file blast radius'],
      file_risks: { 'package.json': 'medium' },
      diff_stats: { lines_added: 1, lines_deleted: 1, total_lines: 2 },
      security_concerns: [],
      destructive_patterns_detected: false,
      requires_human_review: false,
    },
    safety_gate: {
      decision: 'approved',
      approval_status: 'auto_approved',
      risk_level: 'low',
      diagnosis_confidence: 0.96,
      fix_confidence: 0.95,
      critic_score: 0.94,
      critic_approved: true,
      security_findings: [],
      reasons: ['All confidence thresholds met (>= 85%), risk is low, zero security concerns, SentinelGuard passed.'],
      requires_human_review: false,
      thresholds: {
        diagnosis: 0.85,
        fix: 0.85,
        critic: 0.70,
        max_auto_approval_risk: 'low',
      },
    },
    attempts: 1,
    refinement_history: [
      {
        attempt_number: 1,
        fix: {
          fix_type: 'dependency',
          description: 'Upgrade @stripe/stripe-node to ^14.1.0 in package.json',
          affected_files: ['package.json'],
          patch: `--- a/package.json
+++ b/package.json
@@ -28,3 +28,3 @@
-    "@stripe/stripe-node": "^12.1.0",
+    "@stripe/stripe-node": "^14.1.0",`,
          reason: 'Aligns stripe-node version with node runtime',
          confidence: 0.95,
        },
        critic: {
          approved: true,
          score: 0.94,
          issues: [],
          reason: 'Patch verified minimal with zero regression risk.',
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
        input_summary: `Ingested CI failure runner logs for ${repo}`,
        output_summary: 'Sanitized 1,420 bytes of logs. Masked tokens/secrets and filtered sensitive config files.',
      },
      {
        agent: 'Diagnoser',
        role: 'Root-Cause Analysis',
        status: 'completed',
        duration_ms: 220,
        confidence: 0.96,
        input_summary: 'Clean runner logs + AST topology context',
        output_summary: 'Category: dependency_error | Root Cause: Conflicting npm peer dependency tree (Confidence: 96%)',
      },
      {
        agent: 'FixSuggester (Attempt #1)',
        role: 'Patch Synthesis',
        status: 'completed',
        duration_ms: 190,
        confidence: 0.95,
        input_summary: 'Diagnosis (dependency_error) + package.json context',
        output_summary: 'Synthesized minimal unified diff patch for package.json',
      },
      {
        agent: 'Critic / Verifier (Attempt #1)',
        role: 'Adversarial Review',
        status: 'completed',
        duration_ms: 180,
        score: 0.94,
        approved: true,
        input_summary: 'Proposed patch (2 lines) for package.json',
        output_summary: 'APPROVED (Score: 94%) | Zero regression verified against 10-point checklist',
      },
      {
        agent: 'Risk Assessor',
        role: 'Blast Radius & Safety Analysis',
        status: 'completed',
        duration_ms: 8,
        input_summary: 'Analyzed patch (2 lines) across 1 file',
        output_summary: 'Risk Level: LOW | Zero destructive patterns | Single file manifest pin',
      },
      {
        agent: 'Confidence Gate',
        role: 'Deterministic Threshold & Policy Gate',
        status: 'completed',
        duration_ms: 4,
        input_summary: 'Diag: 96% | Fix: 95% | Critic: 94% | Risk: LOW',
        output_summary: 'Decision: APPROVED | Status: auto_approved | Passed all confidence thresholds',
      },
      {
        agent: 'Final Decision',
        role: 'Pipeline Consensus Gate',
        status: 'completed',
        duration_ms: 1,
        final_status: 'approved',
        input_summary: 'Consensus across 1 attempt',
        output_summary: 'Status: APPROVED | Quality Score: 0.94 | Auto-Approved by Safety Gate',
      },
    ],
    execution_metrics: {
      total_duration_ms: 615,
      attempts_count: 1,
      final_critic_score: 0.94,
      is_approved: true,
      requires_human_review: false,
      risk_level: 'low',
      approval_status: 'auto_approved',
    },
  };

  // Safely parse and normalize reasoningData (handling JSON strings and missing nested keys)
  let rawData: unknown = reasoningData;
  if (typeof rawData === 'string') {
    try {
      rawData = JSON.parse(rawData);
    } catch {
      rawData = null;
    }
  }

  const rawObj = (rawData && typeof rawData === 'object' ? rawData : {}) as Partial<MultiAgentReasoningResult>;

  const data: MultiAgentReasoningResult = rawData && typeof rawData === 'object'
    ? ({
        ...defaultFallbackData,
        ...rawObj,
        diagnosis: {
          ...defaultFallbackData.diagnosis,
          ...(rawObj.diagnosis || {}),
        },
        fix: {
          ...defaultFallbackData.fix,
          ...(rawObj.fix || {}),
        },
        critic: {
          ...defaultFallbackData.critic,
          ...(rawObj.critic || {}),
        },
        risk_assessment: rawObj.risk_assessment || defaultFallbackData.risk_assessment,
        safety_gate: rawObj.safety_gate || defaultFallbackData.safety_gate,
        agent_timeline: Array.isArray(rawObj.agent_timeline) && rawObj.agent_timeline.length > 0
          ? rawObj.agent_timeline
          : defaultFallbackData.agent_timeline,
        refinement_history: Array.isArray(rawObj.refinement_history) && rawObj.refinement_history.length > 0
          ? rawObj.refinement_history
          : defaultFallbackData.refinement_history,
        execution_metrics: {
          ...defaultFallbackData.execution_metrics,
          ...(rawObj.execution_metrics || {}),
        },
      } as MultiAgentReasoningResult)
    : defaultFallbackData;

  const handleCopyDiff = () => {
    if (!data?.fix?.patch) return;
    navigator.clipboard.writeText(data.fix.patch);
    setCopiedPatch(true);
    setTimeout(() => setCopiedPatch(false), 2000);
  };

  // Phase 4 Decision & Status extraction
  const diagConf = data.diagnosis?.confidence ?? 0.94;
  const fixConf = data.fix?.confidence ?? 0.90;
  const criticScore = data.critic?.score ?? 0.88;
  const riskLevel = (data.safety_gate?.risk_level || data.risk_assessment?.risk_level || 'low').toLowerCase();
  const securityFindings = data.safety_gate?.security_findings || data.critic?.security_concerns || [];
  
  const currentApprovalStatus =
    localApprovalStatus ||
    data.approval_status ||
    data.safety_gate?.approval_status ||
    (data.status === 'approved' ? 'auto_approved' : data.status === 'rejected' ? 'auto_rejected' : 'pending_review');

  const isApproved = data.status === 'approved' || currentApprovalStatus === 'approved_by_human' || currentApprovalStatus === 'auto_approved';
  const isHumanReview = data.status === 'human_review_required' || currentApprovalStatus === 'pending_review';
  const isRejected = data.status === 'rejected' || currentApprovalStatus === 'rejected_by_human' || currentApprovalStatus === 'auto_rejected';

  const handleApprove = async () => {
    setIsSubmittingApproval(true);
    setApprovalError(null);
    setApprovalMessage(null);
    try {
      if (onHumanApprove) {
        await onHumanApprove(approvalComment);
      } else {
        const res = await api.submitIncidentApproval(data.incident_id || incidentId, 'approve', approvalComment);
        if (res && res.approval_status) {
          setLocalApprovalStatus(res.approval_status);
        }
      }
      setLocalApprovalStatus('approved_by_human');
      setApprovalMessage('✅ Remediation fix successfully approved by human operator.');
    } catch (err: unknown) {
      setApprovalError(err instanceof Error ? err.message : 'Failed to record human approval.');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const handleReject = async () => {
    setIsSubmittingApproval(true);
    setApprovalError(null);
    setApprovalMessage(null);
    try {
      if (onHumanReject) {
        await onHumanReject(approvalComment);
      } else {
        const res = await api.submitIncidentApproval(data.incident_id || incidentId, 'reject', approvalComment);
        if (res && res.approval_status) {
          setLocalApprovalStatus(res.approval_status);
        }
      }
      setLocalApprovalStatus('rejected_by_human');
      setApprovalMessage('❌ Remediation fix rejected by human operator.');
    } catch (err: unknown) {
      setApprovalError(err instanceof Error ? err.message : 'Failed to record human rejection.');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // Phase 5 Action & Notification Handlers
  const handleCreateDraftPr = async () => {
    setIsCreatingPr(true);
    setPrError(null);
    try {
      const res = await api.createIncidentDraftPr(data.incident_id || incidentId, {
        target_branch: targetBranch,
        custom_body_notes: customNotes || undefined,
        actor: 'operator-ui',
      });
      setPrResult(res);
      if (res.status === 'blocked') {
        setPrError(`Action Blocked: ${res.blocking_reasons?.join(', ') || res.message}`);
      }
    } catch (err: unknown) {
      setPrError(err instanceof Error ? err.message : 'Failed to create Draft PR.');
    } finally {
      setIsCreatingPr(false);
    }
  };

  const handleSendSlackNotification = async (eventType?: string) => {
    setIsSendingSlack(true);
    setSlackError(null);
    try {
      const chosenEvent = eventType || (
        currentApprovalStatus === 'approved_by_human' ? 'APPROVED_BY_HUMAN' :
        currentApprovalStatus === 'rejected_by_human' ? 'REJECTED_BY_HUMAN' :
        currentApprovalStatus === 'auto_approved' ? 'AUTO_APPROVED' :
        currentApprovalStatus === 'pending_review' ? 'HUMAN_REVIEW_REQUIRED' :
        'REJECTED'
      );
      const res = await api.sendIncidentNotification(data.incident_id || incidentId, {
        event_type: chosenEvent,
        actor: 'operator-ui',
      });
      setSlackResult(res);
      if (res.notification) {
        setNotificationHistory(prev => [
          {
            event: res.notification?.event_type || chosenEvent,
            status: res.notification?.status || 'SENT',
            timestamp: new Date().toLocaleTimeString(),
            details: res.message || 'Notification dispatched',
          },
          ...prev,
        ]);
      }
    } catch (err: unknown) {
      setSlackError(err instanceof Error ? err.message : 'Failed to send Slack alert.');
    } finally {
      setIsSendingSlack(false);
    }
  };

  return (
    <div className="rounded-xl bg-white border border-[#E5DED6] shadow-card overflow-hidden transition-all">
      {/* Header Banner */}
      <div className="p-space-md bg-gradient-to-r from-[#FAF7F3] via-white to-[#F9ECE7] border-b border-[#E5DED6] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[#D97757]/15 border border-[#D97757]/30 flex items-center justify-center text-[#D97757]">
            <span className="material-symbols-outlined text-xl">shield_person</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-headline-sm font-bold text-[#2D2926] text-base tracking-tight">
                Multi-Agent Reasoning &amp; Safety Gate
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#D97757] text-white uppercase tracking-wider">
                Phase 4 Safety Gate
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full font-mono text-xs font-bold flex items-center gap-1.5 ${
                  currentApprovalStatus === 'approved_by_human' || currentApprovalStatus === 'auto_approved'
                    ? 'bg-[#EAF3E7] text-[#5B7C4B] border border-[#5B7C4B]/40'
                    : currentApprovalStatus === 'pending_review' || isHumanReview
                    ? 'bg-[#FFFBEB] text-[#D97706] border border-[#D97706]/40'
                    : 'bg-[#FDF0F0] text-[#C34A4A] border border-[#C34A4A]/40'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    currentApprovalStatus === 'approved_by_human' || currentApprovalStatus === 'auto_approved'
                      ? 'bg-[#5B7C4B]'
                      : isHumanReview
                      ? 'bg-[#D97706] animate-ping'
                      : 'bg-[#C34A4A]'
                  }`}
                ></span>
                STATUS: {currentApprovalStatus.toUpperCase().replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-[#6B625B] mt-0.5">
              Pipeline: <span className="font-semibold text-[#2D2926]">Diagnoser</span> →{' '}
              <span className="font-semibold text-[#2D2926]">FixSuggester</span> →{' '}
              <span className="font-semibold text-[#2D2926]">Critic</span> →{' '}
              <span className="font-semibold text-[#2563EB]">Risk Assessor</span> →{' '}
              <span className="font-semibold text-[#5B7C4B]">Confidence Gate</span> →{' '}
              <span className="font-semibold text-[#7C3AED]">Human Authority</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRerun && (
            <button
              onClick={onRerun}
              disabled={isLoading}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                isLoading
                  ? 'bg-gray-100 text-gray-400 cursor-wait'
                  : 'bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] text-[#2D2926]'
              }`}
            >
              <span className={`material-symbols-outlined text-sm text-[#D97757] ${isLoading ? 'animate-spin' : ''}`}>
                {isLoading ? 'progress_activity' : 'refresh'}
              </span>
              <span>{isLoading ? 'Reasoning in Progress...' : 'Re-Run Multi-Agent Pipeline'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Visual Pipeline Flow Ribbon */}
      <WorkflowPipelineFlow
        data={data}
        diagConf={diagConf}
        fixConf={fixConf}
        criticScore={criticScore}
        riskLevel={riskLevel}
        currentApprovalStatus={currentApprovalStatus}
        isApproved={isApproved}
        isHumanReview={isHumanReview}
      />

      {/* Tabs Header */}
      <div className="px-space-md pt-3 bg-[#FAF7F3] border-b border-[#E5DED6] flex items-center gap-1 overflow-x-auto text-xs font-semibold text-[#6B625B]">
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`px-3.5 py-2 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'pipeline'
              ? 'border-[#D97757] text-[#99462A] bg-white rounded-t-lg font-bold'
              : 'border-transparent hover:text-[#2D2926]'
          }`}
        >
          <span className="material-symbols-outlined text-sm text-[#D97757]">account_tree</span>
          <span>Telemetry</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#E5DED6] text-[#2D2926]">
            {data.agent_timeline?.length || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('safety')}
          className={`px-3.5 py-2 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'safety'
              ? 'border-[#2563EB] text-[#2563EB] bg-white rounded-t-lg font-bold'
              : 'border-transparent hover:text-[#2D2926]'
          }`}
        >
          <span className="material-symbols-outlined text-sm text-[#2563EB]">shield_person</span>
          <span>Safety &amp; Approval</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold uppercase ${
              riskLevel === 'low'
                ? 'bg-green-100 text-green-800'
                : riskLevel === 'medium'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {riskLevel}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('diagnoser')}
          className={`px-3.5 py-2 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'diagnoser'
              ? 'border-[#D97757] text-[#99462A] bg-white rounded-t-lg font-bold'
              : 'border-transparent hover:text-[#2D2926]'
          }`}
        >
          <span className="material-symbols-outlined text-sm text-[#D97757]">psychology</span>
          <span>1. Diagnoser RCA</span>
        </button>

        <button
          onClick={() => setActiveTab('fix')}
          className={`px-3.5 py-2 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'fix'
              ? 'border-[#D97757] text-[#99462A] bg-white rounded-t-lg font-bold'
              : 'border-transparent hover:text-[#2D2926]'
          }`}
        >
          <span className="material-symbols-outlined text-sm text-[#5B7C4B]">difference</span>
          <span>2. FixSuggester Patch</span>
        </button>

        <button
          onClick={() => setActiveTab('critic')}
          className={`px-3.5 py-2 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'critic'
              ? 'border-[#D97757] text-[#99462A] bg-white rounded-t-lg font-bold'
              : 'border-transparent hover:text-[#2D2926]'
          }`}
        >
          <span className="material-symbols-outlined text-sm text-[#99462A]">verified_user</span>
          <span>3. Critic / Verifier</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              data.critic?.approved ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {Math.round(criticScore * 100)}%
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-3.5 py-2 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'history'
              ? 'border-[#D97757] text-[#99462A] bg-white rounded-t-lg font-bold'
              : 'border-transparent hover:text-[#2D2926]'
          }`}
        >
          <span className="material-symbols-outlined text-sm text-[#7C3AED]">repeat</span>
          <span>Refinement Loop</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-800 font-bold">
            {data.attempts || 1}/3 Attempts
          </span>
        </button>

        <button
          onClick={() => setActiveTab('actions')}
          className={`px-3.5 py-2 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'actions'
              ? 'border-[#5B7C4B] text-[#2F5224] bg-white rounded-t-lg font-bold'
              : 'border-transparent hover:text-[#2D2926]'
          }`}
        >
          <span className="material-symbols-outlined text-sm text-[#5B7C4B]">call_split</span>
          <span>4. Safe Action &amp; PR</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              prResult?.pr_number
                ? 'bg-purple-100 text-purple-800'
                : isApproved
                ? 'bg-green-100 text-green-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {prResult?.pr_number ? `PR #${prResult.pr_number}` : isApproved ? 'READY' : 'GUARDED'}
          </span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-space-md">
        {activeTab === 'pipeline' && (
          <WorkflowPipelineTab
            data={data}
            criticScore={criticScore}
            riskLevel={riskLevel}
          />
        )}

        {activeTab === 'safety' && (
          <WorkflowSafetyTab
            data={data}
            diagConf={diagConf}
            fixConf={fixConf}
            criticScore={criticScore}
            riskLevel={riskLevel}
            securityFindings={securityFindings}
            approvalMessage={approvalMessage}
            approvalError={approvalError}
            currentApprovalStatus={currentApprovalStatus}
            isApproved={isApproved}
            isHumanReview={isHumanReview}
            isRejected={isRejected}
            approvalComment={approvalComment}
            setApprovalComment={setApprovalComment}
            isSubmittingApproval={isSubmittingApproval}
            handleApprove={handleApprove}
            handleReject={handleReject}
          />
        )}

        {activeTab === 'diagnoser' && <WorkflowDiagnoserTab data={data} />}

        {activeTab === 'fix' && (
          <WorkflowFixTab
            data={data}
            copiedPatch={copiedPatch}
            handleCopyDiff={handleCopyDiff}
          />
        )}

        {activeTab === 'critic' && (
          <WorkflowCriticTab
            data={data}
            isApproved={isApproved}
            securityFindings={securityFindings}
          />
        )}

        {activeTab === 'history' && (
          <WorkflowHistoryTab
            data={data}
            selectedAttempt={selectedAttempt}
            setSelectedAttempt={setSelectedAttempt}
          />
        )}

        {activeTab === 'actions' && (
          <WorkflowActionsTab
            data={data}
            isApproved={isApproved}
            isHumanReview={isHumanReview}
            currentApprovalStatus={currentApprovalStatus}
            criticScore={criticScore}
            securityFindings={securityFindings}
            targetBranch={targetBranch}
            setTargetBranch={setTargetBranch}
            customNotes={customNotes}
            setCustomNotes={setCustomNotes}
            isCreatingPr={isCreatingPr}
            prResult={prResult}
            prError={prError}
            handleCreateDraftPr={handleCreateDraftPr}
            isSendingSlack={isSendingSlack}
            slackResult={slackResult}
            slackError={slackError}
            notificationHistory={notificationHistory}
            handleSendSlackNotification={handleSendSlackNotification}
          />
        )}
      </div>
    </div>
  );
};
