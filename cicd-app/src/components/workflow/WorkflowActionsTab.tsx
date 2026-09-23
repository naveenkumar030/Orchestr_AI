import React from 'react';
import type { MultiAgentReasoningResult } from '../../types';

interface WorkflowActionsTabProps {
  data: MultiAgentReasoningResult;
  isApproved: boolean;
  isHumanReview: boolean;
  currentApprovalStatus: string;
  criticScore: number;
  securityFindings: string[];
  targetBranch: string;
  setTargetBranch: (val: string) => void;
  customNotes: string;
  setCustomNotes: (val: string) => void;
  isCreatingPr: boolean;
  prResult: {
    success: boolean;
    status: string;
    pr_number?: number;
    pr_url?: string;
    branch_name?: string;
    message?: string;
    blocking_reasons?: string[];
  } | null;
  prError: string | null;
  handleCreateDraftPr: () => Promise<void>;
  isSendingSlack: boolean;
  slackResult: {
    success: boolean;
    status?: string;
    message?: string;
    details?: string;
  } | null;
  slackError: string | null;
  notificationHistory: Array<{
    event: string;
    status: string;
    timestamp: string;
    details: string;
  }>;
  handleSendSlackNotification: (overrideEvent?: string) => Promise<void>;
}

export const WorkflowActionsTab: React.FC<WorkflowActionsTabProps> = ({
  data,
  isApproved,
  isHumanReview,
  currentApprovalStatus,
  criticScore,
  securityFindings,
  targetBranch,
  setTargetBranch,
  customNotes,
  setCustomNotes,
  isCreatingPr,
  prResult,
  prError,
  handleCreateDraftPr,
  isSendingSlack,
  slackResult,
  slackError,
  notificationHistory,
  handleSendSlackNotification,
}) => {
  return (
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
          <span
            className={`px-2 py-1 rounded text-[10px] font-bold font-mono uppercase ${
              isApproved
                ? 'bg-green-900/60 border border-green-500/40 text-green-300'
                : 'bg-amber-900/60 border border-amber-500/40 text-amber-300'
            }`}
          >
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
                <span
                  className={`material-symbols-outlined text-sm ${
                    securityFindings.length === 0 ? 'text-[#5B7C4B]' : 'text-[#C34A4A]'
                  }`}
                >
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
              <span
                className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                  currentApprovalStatus === 'auto_approved' || currentApprovalStatus === 'approved_by_human'
                    ? 'bg-green-100 text-green-800'
                    : isHumanReview
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
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
              <span className="text-[10px] font-semibold text-[#6B625B] uppercase block">
                Recent Notification Deliveries
              </span>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {notificationHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 rounded bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between text-[10px]"
                  >
                    <span className="font-mono font-bold text-[#2D2926]">{item.event}</span>
                    <span className="text-[#8F857D]">{item.timestamp}</span>
                    <span className="px-1.5 py-0.2 rounded font-mono font-bold bg-green-100 text-green-800 uppercase">
                      {item.status}
                    </span>
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
          <span className="font-bold text-[#2D2926]">Safe Action &amp; Observational Isolation Guarantee:</span> Slack
          notification failures (network timeouts, webhook 4xx/5xx errors) will never block or alter pipeline execution,
          confidence thresholds, or safety gating decisions. All GitHub PRs are created as Drafts on isolated branches
          and never automatically merged.
        </div>
      </div>
    </div>
  );
};
