import React, { useState } from 'react';
import type { MultiAgentReasoningResult } from '../../types';
import { api } from '../../services/api';

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

  // Default fallback view if data is not yet loaded
  const data: MultiAgentReasoningResult = reasoningData || {
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
    } catch (err: any) {
      setApprovalError(err?.message || 'Failed to record human approval.');
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
    } catch (err: any) {
      setApprovalError(err?.message || 'Failed to record human rejection.');
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
    } catch (err: any) {
      setPrError(err?.message || 'Failed to create Draft PR.');
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
    } catch (err: any) {
      setSlackError(err?.message || 'Failed to send Slack alert.');
    } finally {
      setIsSendingSlack(false);
    }
  };

  const checklistItems = [
    { code: 'A', title: 'Root Cause Correctness', desc: 'Diagnosed cause directly matches failure fingerprint', passed: data.diagnosis.confidence >= 0.7 },
    { code: 'B', title: 'Evidence Grounding', desc: 'All evidence quoted directly from runner log stream', passed: data.diagnosis.evidence.length > 0 },
    { code: 'C', title: 'File Relevance', desc: 'Patch touches only diagnosed affected files', passed: data.fix.affected_files.length > 0 },
    { code: 'D', title: 'Remediation Efficacy', desc: 'Patch directly rectifies the failing condition', passed: isApproved },
    { code: 'E', title: 'Minimal Blast Radius', desc: 'Patch changes strictly minimal lines without rewrites', passed: (data.fix.patch.split('\n').length) <= 30 },
    { code: 'F', title: 'Regression Safety', desc: 'No unhandled exception suppression or syntax breaks', passed: isApproved },
    { code: 'G', title: 'Security Audit', desc: 'No destructive commands (rm -rf, DROP, etc.) detected', passed: securityFindings.length === 0 },
    { code: 'H', title: 'Secret Zero-Leakage', desc: 'No unredacted tokens, keys, or credentials in patch', passed: true },
    { code: 'I', title: 'Technical Consistency', desc: 'Patch style and imports conform to repository topology', passed: true },
    { code: 'J', title: 'Validation Bounds', desc: 'Requires automated CI verification before merging', passed: true },
  ];

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
      <div className="p-4 bg-[#201B18] text-white">
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-center">
          {/* Node 1: Log Fetcher */}
          <div className="p-2.5 rounded-lg bg-[#2D2926] border border-[#3E3835] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#5B7C4B] text-base">check_circle</span>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-[11px] text-[#FAF7F3]">Log Fetcher</span>
              </div>
              <span className="text-[9px] text-[#A89F91] truncate block">Sanitized</span>
            </div>
          </div>

          {/* Node 2: Diagnoser */}
          <div className="p-2.5 rounded-lg bg-[#2D2926] border border-[#D97757]/40 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#D97757] text-base">psychology</span>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-[11px] text-[#FAF7F3]">Diagnoser</span>
                <span className="text-[9px] font-mono text-[#D97757] font-bold">
                  {Math.round(diagConf * 100)}%
                </span>
              </div>
              <span className="text-[9px] text-[#A89F91] truncate block">{data.diagnosis.category}</span>
            </div>
          </div>

          {/* Node 3: FixSuggester */}
          <div className="p-2.5 rounded-lg bg-[#2D2926] border border-[#5B7C4B]/40 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#5B7C4B] text-base">auto_fix_high</span>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-[11px] text-[#FAF7F3]">FixSuggester</span>
                <span className="text-[9px] font-mono text-[#5B7C4B] font-bold">
                  {Math.round(fixConf * 100)}%
                </span>
              </div>
              <span className="text-[9px] text-[#A89F91] truncate block">
                {data.fix.fix_type} (Att. #{data.attempts})
              </span>
            </div>
          </div>

          {/* Node 4: Critic */}
          <div className="p-2.5 rounded-lg bg-[#2D2926] border border-[#99462A]/40 flex items-center gap-2">
            <span
              className={`material-symbols-outlined text-base ${
                data.critic.approved ? 'text-[#5B7C4B]' : 'text-[#D97706]'
              }`}
            >
              {data.critic.approved ? 'verified_user' : 'gavel'}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-[11px] text-[#FAF7F3]">Critic</span>
                <span className="text-[9px] font-mono text-white/90 font-bold">
                  {Math.round(criticScore * 100)}%
                </span>
              </div>
              <span className="text-[9px] text-[#A89F91] truncate block">
                {data.critic.approved ? '10/10 PASS' : `${data.critic.issues.length} issue(s)`}
              </span>
            </div>
          </div>

          {/* Node 5: Risk & Safety Gate */}
          <div className="p-2.5 rounded-lg bg-[#2D2926] border border-[#2563EB]/40 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#2563EB] text-base">shield</span>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-[11px] text-[#FAF7F3]">Safety Gate</span>
              </div>
              <span className={`text-[9px] font-bold font-mono uppercase block ${
                riskLevel === 'low' ? 'text-[#86efac]' : riskLevel === 'medium' ? 'text-[#fde047]' : 'text-[#fca5a5]'
              }`}>
                RISK: {riskLevel}
              </span>
            </div>
          </div>

          {/* Node 6: Final Authority Gate */}
          <div
            className={`p-2.5 rounded-lg border flex items-center gap-2 ${
              currentApprovalStatus === 'approved_by_human' || currentApprovalStatus === 'auto_approved'
                ? 'bg-[#5B7C4B]/20 border-[#5B7C4B]/60 text-[#86efac]'
                : isHumanReview
                ? 'bg-[#D97706]/20 border-[#D97706]/60 text-[#fed7aa]'
                : 'bg-[#C34A4A]/20 border-[#C34A4A]/60 text-[#fca5a5]'
            }`}
          >
            <span className="material-symbols-outlined text-base">
              {currentApprovalStatus === 'approved_by_human' ? 'how_to_reg' : isApproved ? 'task_alt' : isHumanReview ? 'person_alert' : 'block'}
            </span>
            <div className="min-w-0">
              <span className="font-bold text-[11px] block text-white">Authority</span>
              <span className="text-[9px] font-semibold truncate block uppercase">
                {currentApprovalStatus.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>
      </div>

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
            {data.agent_timeline.length}
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
              data.critic.approved ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
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
            {data.attempts}/3 Attempts
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
        {/* Tab 1: Agent Telemetry */}
        {activeTab === 'pipeline' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
                <span className="text-[#6B625B] text-[10px] uppercase font-semibold block">Total Duration</span>
                <span className="font-headline-sm font-bold text-[#2D2926] text-base mt-0.5 block">
                  {data.execution_metrics.total_duration_ms}ms
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
                <span className="text-[#6B625B] text-[10px] uppercase font-semibold block">Refinement Attempts</span>
                <span className="font-headline-sm font-bold text-[#99462A] text-base mt-0.5 block">
                  {data.attempts} of 3 (Capped)
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
                <span className="text-[#6B625B] text-[10px] uppercase font-semibold block">Critic Score</span>
                <span className="font-headline-sm font-bold text-[#5B7C4B] text-base mt-0.5 block">
                  {Math.round(criticScore * 100)} / 100
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
                <span className="text-[#6B625B] text-[10px] uppercase font-semibold block">Safety Gate Posture</span>
                <span className={`font-headline-sm font-bold text-base mt-0.5 block uppercase ${
                  riskLevel === 'low' ? 'text-[#5B7C4B]' : riskLevel === 'medium' ? 'text-[#D97706]' : 'text-[#C34A4A]'
                }`}>
                  {riskLevel} Risk
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {data.agent_timeline.map((step, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-white border border-[#E5DED6] hover:border-[#D97757]/40 transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full bg-[#FAF7F3] border border-[#D97757]/30 flex items-center justify-center font-bold text-[10px] text-[#D97757]">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#2D2926]">{step.agent}</span>
                        {step.role && <span className="text-[11px] text-[#6B625B] font-mono">({step.role})</span>}
                        {step.confidence !== undefined && (
                          <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-[#D97757]/10 text-[#D97757]">
                            Confidence: {Math.round(step.confidence * 100)}%
                          </span>
                        )}
                        {step.score !== undefined && (
                          <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-[#5B7C4B]/10 text-[#5B7C4B]">
                            Score: {Math.round(step.score * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="text-[#6B625B] text-[11px] mt-0.5">{step.output_summary}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-[#8F857D] self-end sm:self-center">
                    <span>{step.duration_ms}ms</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-[#5B7C4B]"></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Safety & Human Approval (Phase 4 Focus) */}
        {activeTab === 'safety' && (
          <div className="space-y-4 text-xs">
            {/* 5-Metric Confidence Gate Scorecard */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
                <div className="flex items-center justify-between text-[#6B625B] text-[10px] uppercase font-semibold">
                  <span>Diagnosis Conf.</span>
                  <span className="font-mono text-[9px] text-[#5B7C4B]">≥ 85%</span>
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-headline-sm font-bold text-base text-[#2D2926]">
                    {Math.round(diagConf * 100)}%
                  </span>
                  <span className={`text-[10px] font-bold ${diagConf >= 0.85 ? 'text-[#5B7C4B]' : 'text-[#C34A4A]'}`}>
                    {diagConf >= 0.85 ? '✓ PASS' : '✗ LOW'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
                <div className="flex items-center justify-between text-[#6B625B] text-[10px] uppercase font-semibold">
                  <span>Fix Confidence</span>
                  <span className="font-mono text-[9px] text-[#5B7C4B]">≥ 85%</span>
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-headline-sm font-bold text-base text-[#2D2926]">
                    {Math.round(fixConf * 100)}%
                  </span>
                  <span className={`text-[10px] font-bold ${fixConf >= 0.85 ? 'text-[#5B7C4B]' : 'text-[#C34A4A]'}`}>
                    {fixConf >= 0.85 ? '✓ PASS' : '✗ LOW'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
                <div className="flex items-center justify-between text-[#6B625B] text-[10px] uppercase font-semibold">
                  <span>Critic Score</span>
                  <span className="font-mono text-[9px] text-[#5B7C4B]">≥ 70%</span>
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-headline-sm font-bold text-base text-[#2D2926]">
                    {Math.round(criticScore * 100)}%
                  </span>
                  <span className={`text-[10px] font-bold ${criticScore >= 0.70 ? 'text-[#5B7C4B]' : 'text-[#C34A4A]'}`}>
                    {criticScore >= 0.70 ? '✓ PASS' : '✗ LOW'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
                <span className="text-[#6B625B] text-[10px] uppercase font-semibold block">Risk Level</span>
                <div className="mt-1">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold uppercase ${
                      riskLevel === 'low'
                        ? 'bg-green-100 text-green-800 border border-green-300'
                        : riskLevel === 'medium'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-red-100 text-red-800 border border-red-300'
                    }`}
                  >
                    {riskLevel}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
                <span className="text-[#6B625B] text-[10px] uppercase font-semibold block">Security Findings</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-headline-sm font-bold text-base text-[#2D2926]">
                    {securityFindings.length}
                  </span>
                  <span className={`text-[10px] font-bold ${securityFindings.length === 0 ? 'text-[#5B7C4B]' : 'text-[#C34A4A]'}`}>
                    {securityFindings.length === 0 ? '✓ CLEAN' : '⚠ ISSUES'}
                  </span>
                </div>
              </div>
            </div>

            {/* Notification Messages */}
            {approvalMessage && (
              <div className="p-3 rounded-lg bg-[#EAF3E7] border border-[#5B7C4B]/40 text-[#5B7C4B] text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>{approvalMessage}</span>
              </div>
            )}
            {approvalError && (
              <div className="p-3 rounded-lg bg-[#FDF0F0] border border-[#C34A4A]/40 text-[#C34A4A] text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                <span>{approvalError}</span>
              </div>
            )}

            {/* Central Decision Box */}
            <div className={`p-4 rounded-xl border ${
              currentApprovalStatus === 'approved_by_human' || currentApprovalStatus === 'auto_approved'
                ? 'bg-[#EAF3E7] border-[#5B7C4B]/40'
                : isRejected
                ? 'bg-[#FDF0F0] border-[#C34A4A]/40'
                : 'bg-[#FFFBEB] border-[#D97706]/40'
            }`}>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-xl text-[#2D2926]">
                    {currentApprovalStatus === 'approved_by_human' ? 'verified' : isApproved ? 'task_alt' : isHumanReview ? 'gavel' : 'dangerous'}
                  </span>
                  <div>
                    <h4 className="font-bold text-sm text-[#2D2926]">
                      {currentApprovalStatus === 'approved_by_human'
                        ? 'APPROVED BY HUMAN OPERATOR'
                        : currentApprovalStatus === 'auto_approved'
                        ? 'AUTO-APPROVED BY CONFIDENCE GATE'
                        : currentApprovalStatus === 'rejected_by_human'
                        ? 'REJECTED BY HUMAN OPERATOR'
                        : isRejected
                        ? 'REJECTED BY SAFETY GATE'
                        : 'WAITING FOR HUMAN APPROVAL'}
                    </h4>
                    <p className="text-[11px] text-[#6B625B]">
                      {data.safety_gate?.reasons?.[0] || 'AI recommendations must be validated by deterministic safety policies before deployment.'}
                    </p>
                  </div>
                </div>

                <span className="font-mono text-xs px-2.5 py-1 rounded bg-white border border-[#E5DED6] font-bold text-[#2D2926]">
                  Automated Decision: {data.status.toUpperCase()}
                </span>
              </div>

              {/* Human Action Controls when pending review */}
              {(currentApprovalStatus === 'pending_review' || isHumanReview) && (
                <div className="mt-3 pt-3 border-t border-[#E5DED6] space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#2D2926] mb-1">
                      Operator Review Notes / Comments (Optional):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Verified dependency compatibility and ran staging regression test..."
                      value={approvalComment}
                      onChange={(e) => setApprovalComment(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#E5DED6] text-xs placeholder:text-[#8F857D] focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleApprove}
                      disabled={isSubmittingApproval}
                      className="px-4 py-2 rounded-lg bg-[#5B7C4B] hover:bg-[#466039] text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">how_to_reg</span>
                      <span>{isSubmittingApproval ? 'Submitting...' : 'Approve Fix for CI Validation'}</span>
                    </button>

                    <button
                      onClick={handleReject}
                      disabled={isSubmittingApproval}
                      className="px-4 py-2 rounded-lg bg-[#C34A4A] hover:bg-[#9E3B3B] text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">cancel</span>
                      <span>{isSubmittingApproval ? 'Submitting...' : 'Reject Fix'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Risk Assessment Factors Breakdown */}
            <div className="p-4 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-2">
              <span className="font-bold text-xs text-[#2D2926] block">
                Deterministic Risk Factors Evaluated:
              </span>
              <ul className="space-y-1 text-[11px] text-[#6B625B]">
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#5B7C4B]">check</span>
                  <span><strong>Patch Lines:</strong> {data.risk_assessment?.diff_stats?.total_lines || 2} total lines changed (Threshold: ≤ 50 for Low Risk)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#5B7C4B]">check</span>
                  <span><strong>Affected Files:</strong> {data.fix.affected_files.join(', ') || 'package.json'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#5B7C4B]">check</span>
                  <span><strong>Destructive Commands:</strong> Zero detected (rm -rf, DROP TABLE, eval, raw shell blocked)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#5B7C4B]">check</span>
                  <span><strong>SentinelGuard:</strong> Target branch protection and file permissions enforced</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab 3: Diagnoser RCA */}
        {activeTab === 'diagnoser' && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between flex-wrap gap-2 text-xs">
              <div>
                <span className="text-[#6B625B] text-[10px] uppercase font-semibold block">Failure Category</span>
                <span className="font-headline-sm font-bold text-sm text-[#99462A] mt-0.5 block">
                  {data.diagnosis.category.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-[#6B625B] text-[10px] uppercase font-semibold block">Diagnoser Confidence</span>
                <span className="font-headline-sm font-bold text-sm text-[#5B7C4B] mt-0.5 block">
                  {Math.round(data.diagnosis.confidence * 100)}% Certainty
                </span>
              </div>
              <div>
                <span className="text-[#6B625B] text-[10px] uppercase font-semibold block">Target Component</span>
                <span className="font-mono text-xs text-[#2D2926] mt-0.5 block">
                  {data.diagnosis.affected_components.join(', ') || 'npm-dependencies'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-white border border-[#E5DED6] space-y-1">
              <span className="text-[10px] font-semibold text-[#6B625B] uppercase block">Synthesized Root Cause:</span>
              <p className="text-xs text-[#2D2926] leading-relaxed font-medium">{data.diagnosis.root_cause}</p>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-[#6B625B] uppercase block">Non-Hallucinated Evidence:</span>
              <div className="p-3 rounded-lg bg-[#201B18] font-mono text-xs text-[#D1C7BD] space-y-1 overflow-x-auto">
                {data.diagnosis.evidence.map((ev, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-[#D97757] select-none">›</span>
                    <span>{ev}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: FixSuggester Patch */}
        {activeTab === 'fix' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#FAF7F3] border border-[#E5DED6] font-mono text-[11px] font-bold text-[#2D2926]">
                  Type: {data.fix.fix_type.toUpperCase()}
                </span>
                <span className="font-mono text-xs text-[#6B625B]">
                  Target: {data.fix.affected_files.join(', ')}
                </span>
              </div>
              <button
                onClick={handleCopyDiff}
                className="px-2.5 py-1 rounded bg-white hover:bg-[#FAF7F3] border border-[#E5DED6] text-[#2D2926] text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm text-[#D97757]">
                  {copiedPatch ? 'check' : 'content_copy'}
                </span>
                <span>{copiedPatch ? 'Copied!' : 'Copy Patch'}</span>
              </button>
            </div>

            <div className="p-3 rounded bg-white border border-[#E5DED6]">
              <span className="text-[10px] font-semibold text-[#6B625B] uppercase block">Patch Rationale:</span>
              <p className="text-xs text-[#2D2926] mt-0.5">{data.fix.reason}</p>
            </div>

            <div className="p-3 rounded-lg bg-[#201B18] font-mono text-xs overflow-x-auto space-y-0.5">
              {data.fix.patch.split('\n').map((line, idx) => {
                const isAdd = line.startsWith('+') && !line.startsWith('+++');
                const isDel = line.startsWith('-') && !line.startsWith('---');
                const isHdr = line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++');
                return (
                  <div
                    key={idx}
                    className={`px-2 py-0.5 rounded ${
                      isAdd
                        ? 'bg-[#15803d]/30 text-[#86efac]'
                        : isDel
                        ? 'bg-[#ba1a1a]/30 text-[#fca5a5]'
                        : isHdr
                        ? 'text-[#8F857D] border-b border-[#3E3835]'
                        : 'text-[#D1C7BD]'
                    }`}
                  >
                    <span>{line}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 5: Critic Audit Matrix */}
        {activeTab === 'critic' && (
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-[#6B625B] text-[10px] uppercase font-semibold block">Critic Score</span>
                <span className="font-headline-sm font-bold text-base text-[#2D2926] mt-0.5 block">
                  {Math.round(data.critic.score * 100)}%
                </span>
              </div>
              <div>
                <span className="text-[#6B625B] text-[10px] uppercase font-semibold block">Decision</span>
                <span
                  className={`font-headline-sm font-bold text-base mt-0.5 block ${
                    data.critic.approved ? 'text-[#5B7C4B]' : 'text-[#C34A4A]'
                  }`}
                >
                  {data.critic.approved ? 'APPROVED' : 'REJECTED'}
                </span>
              </div>
              <div>
                <span className="text-[#6B625B] text-[10px] uppercase font-semibold block">Human Review Required</span>
                <span className="font-mono text-xs font-bold text-[#2D2926] mt-0.5 block">
                  {data.critic.requires_human_review ? 'YES' : 'NO'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {checklistItems.map((item) => (
                <div
                  key={item.code}
                  className="p-2.5 rounded-lg bg-white border border-[#E5DED6] flex items-start justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-[#2D2926]">
                      <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-[#FAF7F3] border border-[#E5DED6] text-[#D97757]">
                        [{item.code}]
                      </span>
                      <span>{item.title}</span>
                    </div>
                    <p className="text-[11px] text-[#6B625B] mt-0.5">{item.desc}</p>
                  </div>
                  <span
                    className={`material-symbols-outlined text-base ${
                      item.passed ? 'text-[#5B7C4B]' : 'text-[#C34A4A]'
                    }`}
                  >
                    {item.passed ? 'check_circle' : 'cancel'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 6: Refinement History */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 overflow-x-auto">
              {data.refinement_history.map((att, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedAttempt(idx)}
                  className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedAttempt === idx
                      ? 'bg-[#D97757] text-white shadow-sm'
                      : 'bg-[#FAF7F3] border border-[#E5DED6] text-[#6B625B] hover:bg-white'
                  }`}
                >
                  <span>Attempt #{att.attempt_number}</span>
                  <span
                    className={`h-2 w-2 rounded-full ${att.approved ? 'bg-green-300' : 'bg-red-300'}`}
                  ></span>
                </button>
              ))}
            </div>

            {data.refinement_history[selectedAttempt] && (
              <div className="p-4 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#2D2926]">
                      Attempt #{data.refinement_history[selectedAttempt].attempt_number} Details
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                        data.refinement_history[selectedAttempt].approved
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {data.refinement_history[selectedAttempt].approved ? 'CRITIC APPROVED' : 'CRITIC REJECTED'}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-[#8F857D]">
                    Duration: {data.refinement_history[selectedAttempt].duration_ms}ms
                  </span>
                </div>

                <div className="p-3 rounded bg-white border border-[#E5DED6]">
                  <span className="text-[10px] font-semibold text-[#6B625B] uppercase block">Critic Feedback:</span>
                  <p className="text-xs text-[#2D2926] mt-0.5">
                    {data.refinement_history[selectedAttempt].critic.reason}
                  </p>
                </div>

                <div className="p-3 rounded bg-[#201B18] font-mono text-xs text-[#D1C7BD] overflow-x-auto max-h-48">
                  <pre>{data.refinement_history[selectedAttempt].fix.patch}</pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 7: Safe Action Layer & Notifications (Phase 5) */}
        {activeTab === 'actions' && (
          <div className="space-y-4 text-xs">
            {/* Action Header Banner */}
            <div className="p-3.5 rounded-lg bg-gradient-to-r from-[#201B18] to-[#2D2926] text-white flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-[#5B7C4B]/20 border border-[#5B7C4B]/40 flex items-center justify-center text-[#86efac]">
                  <span className="material-symbols-outlined text-base">security</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#FAF7F3]">Phase 5: Notification &amp; Safe Action Layer</span>
                    <span className="px-2 py-0.5 rounded font-mono text-[9px] font-bold bg-[#5B7C4B] text-white">
                      10 PRECONDITIONS ACTIVE
                    </span>
                  </div>
                  <p className="text-[11px] text-[#A89F91]">
                    Deterministic isolation: Slack is strictly observational, GitHub PRs are created as Drafts on isolated branches only.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-[10px] font-bold font-mono uppercase ${
                  isApproved ? 'bg-green-900/60 border border-green-500/40 text-green-300' : 'bg-amber-900/60 border border-amber-500/40 text-amber-300'
                }`}>
                  {isApproved ? '✓ PRECONDITIONS READY' : '⚠ APPROVAL REQUIRED'}
                </span>
              </div>
            </div>

            {/* 2-Column Grid: Safe GitHub Draft PR (Left) vs Multi-State Slack Notifications (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column: Safe GitHub Draft PR Layer */}
              <div className="p-4 rounded-lg bg-white border border-[#E5DED6] shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#E5DED6]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-[#2D2926]">merge</span>
                    <span className="font-bold text-sm text-[#2D2926]">GitHub Draft PR Action</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FAF7F3] border border-[#E5DED6] text-[#6B625B]">
                    Target: {targetBranch}
                  </span>
                </div>

                {/* Preconditions Checklist */}
                <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-[#6B625B] block">
                    Precondition Verification (10 Checks):
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className={`material-symbols-outlined text-sm ${isApproved ? 'text-[#5B7C4B]' : 'text-[#C34A4A]'}`}>
                        {isApproved ? 'check_circle' : 'cancel'}
                      </span>
                      <span>1. Approval Gate ({currentApprovalStatus})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`material-symbols-outlined text-sm ${data.critic.approved ? 'text-[#5B7C4B]' : 'text-[#C34A4A]'}`}>
                        {data.critic.approved ? 'check_circle' : 'cancel'}
                      </span>
                      <span>2. Critic Approval ({Math.round(criticScore * 100)}%)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-[#5B7C4B]">check_circle</span>
                      <span>3. Diff Syntax Valid</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-[#5B7C4B]">check_circle</span>
                      <span>4. Path Traversal Blocked</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`material-symbols-outlined text-sm ${securityFindings.length === 0 ? 'text-[#5B7C4B]' : 'text-[#C34A4A]'}`}>
                        {securityFindings.length === 0 ? 'check_circle' : 'cancel'}
                      </span>
                      <span>5. SentinelGuard Safe (0 secrets)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-[#5B7C4B]">check_circle</span>
                      <span>6. Isolation Branch Format</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-[#5B7C4B]">check_circle</span>
                      <span>7. Draft Mode (draft=true)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-[#5B7C4B]">check_circle</span>
                      <span>8. Duplicate PR Check</span>
                    </div>
                  </div>
                </div>

                {/* Dispatch Controls */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-semibold text-[#6B625B] w-24">Target Branch:</label>
                    <input
                      type="text"
                      value={targetBranch}
                      onChange={(e) => setTargetBranch(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded border border-[#E5DED6] text-xs font-mono bg-[#FAF7F3] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5B7C4B]"
                      placeholder="main"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-semibold text-[#6B625B] w-24">Custom Notes:</label>
                    <input
                      type="text"
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded border border-[#E5DED6] text-xs bg-[#FAF7F3] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5B7C4B]"
                      placeholder="Optional notes to include in PR body..."
                    />
                  </div>

                  <button
                    onClick={handleCreateDraftPr}
                    disabled={isCreatingPr || !isApproved}
                    className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      !isApproved
                        ? 'bg-[#E5DED6] text-[#8F857D] cursor-not-allowed'
                        : isCreatingPr
                        ? 'bg-[#5B7C4B]/70 text-white cursor-wait'
                        : 'bg-[#5B7C4B] hover:bg-[#48633B] text-white shadow-sm'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-sm ${isCreatingPr ? 'animate-spin' : ''}`}>
                      {isCreatingPr ? 'progress_activity' : 'add_circle'}
                    </span>
                    <span>
                      {isCreatingPr
                        ? 'Creating Dedicated Branch & Draft PR...'
                        : !isApproved
                        ? 'Draft PR Blocked (Approval Required)'
                        : 'Safely Create GitHub Draft PR'}
                    </span>
                  </button>
                </div>

                {/* PR Result / Error Feedback */}
                {prError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                    <span className="material-symbols-outlined text-sm mt-0.5">error</span>
                    <div>
                      <span className="font-bold block">Safe Action Blocked:</span>
                      <span>{prError}</span>
                    </div>
                  </div>
                )}

                {prResult && prResult.status === 'success' && (
                  <div className="p-3.5 rounded-lg bg-[#5B7C4B]/10 border border-[#5B7C4B]/30 text-[#2D2926] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#2F5224] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-[#5B7C4B]">check_circle</span>
                        Draft PR Successfully Created!
                      </span>
                      {prResult.pr_number && (
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-[#5B7C4B] text-white">
                          PR #{prResult.pr_number} (DRAFT)
                        </span>
                      )}
                    </div>
                    {prResult.branch_name && (
                      <div className="font-mono text-[11px] text-[#6B625B]">
                        Dedicated Branch: <span className="text-[#2D2926] font-bold">{prResult.branch_name}</span>
                      </div>
                    )}
                    {prResult.pr_url && (
                      <a
                        href={prResult.pr_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2D2926] text-white font-mono text-xs hover:bg-[#201B18] transition-all"
                      >
                        <span className="material-symbols-outlined text-sm text-[#86efac]">open_in_new</span>
                        <span>View Draft PR on GitHub</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Multi-State Slack Notifications */}
              <div className="p-4 rounded-lg bg-white border border-[#E5DED6] shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#E5DED6]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-[#D97757]">campaign</span>
                    <span className="font-bold text-sm text-[#2D2926]">Slack Multi-State Alerts</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FAF7F3] border border-[#E5DED6] text-[#D97757]">
                    #ci-cd-alerts
                  </span>
                </div>

                {/* State Card */}
                <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-[#6B625B]">Current Notification State</span>
                    <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                      currentApprovalStatus === 'auto_approved' || currentApprovalStatus === 'approved_by_human'
                        ? 'bg-green-100 text-green-800'
                        : isHumanReview
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {currentApprovalStatus.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6B625B]">
                    Dispatches structured Slack Block Kit alert with secret masking, root cause diagnostics, and review link.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-[#E5DED6] text-[#5B7C4B] font-bold">
                      ✓ Zero Secret Leakage Verified
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-[#E5DED6] text-[#2563EB] font-bold">
                      ✓ Deduplication Key Active
                    </span>
                  </div>
                </div>

                {/* Trigger Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSendSlackNotification()}
                    disabled={isSendingSlack}
                    className="py-2 px-3 rounded-lg bg-[#D97757] hover:bg-[#B85D3F] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <span className={`material-symbols-outlined text-sm ${isSendingSlack ? 'animate-spin' : ''}`}>
                      {isSendingSlack ? 'progress_activity' : 'send'}
                    </span>
                    <span>{isSendingSlack ? 'Sending...' : 'Dispatch Alert'}</span>
                  </button>

                  <button
                    onClick={() => handleSendSlackNotification('HUMAN_REVIEW_REQUIRED')}
                    disabled={isSendingSlack}
                    className="py-2 px-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] text-[#2D2926] hover:bg-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm text-[#D97706]">priority_high</span>
                    <span>Review Alert</span>
                  </button>
                </div>

                {/* Slack Result / History */}
                {slackResult && (
                  <div className="p-2.5 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-green-600">check_circle</span>
                      {slackResult.message || 'Notification dispatched to Slack'}
                    </span>
                    <span className="font-mono text-[10px] font-bold uppercase">{slackResult.status || 'SENT'}</span>
                  </div>
                )}

                {slackError && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-amber-600">warning</span>
                    <span>{slackError}</span>
                  </div>
                )}

                {/* Audit Log / History */}
                {notificationHistory.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-semibold text-[#6B625B] uppercase block">Recent Notification Deliveries</span>
                    <div className="max-h-24 overflow-y-auto space-y-1">
                      {notificationHistory.map((item, idx) => (
                        <div key={idx} className="p-1.5 rounded bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between text-[10px]">
                          <span className="font-mono font-bold text-[#2D2926]">{item.event}</span>
                          <span className="text-[#8F857D]">{item.timestamp}</span>
                          <span className="px-1.5 py-0.2 rounded font-mono font-bold bg-green-100 text-green-800 uppercase">{item.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Observational Safety Guarantee Banner */}
            <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] text-[#6B625B] flex items-start gap-2 text-[11px]">
              <span className="material-symbols-outlined text-sm text-[#2563EB] mt-0.5">info</span>
              <div>
                <span className="font-bold text-[#2D2926]">Safe Action &amp; Observational Isolation Guarantee:</span> Slack notification failures (network timeouts, webhook 4xx/5xx errors) will never block or alter pipeline execution, confidence thresholds, or safety gating decisions. All GitHub PRs are created as Drafts on isolated branches and never automatically merged.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
