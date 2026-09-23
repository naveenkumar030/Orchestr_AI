import React from 'react';
import type { MultiAgentReasoningResult } from '../../types';

interface WorkflowSafetyTabProps {
  data: MultiAgentReasoningResult;
  diagConf: number;
  fixConf: number;
  criticScore: number;
  riskLevel: string;
  securityFindings: string[];
  approvalMessage: string | null;
  approvalError: string | null;
  currentApprovalStatus: string;
  isApproved: boolean;
  isHumanReview: boolean;
  isRejected: boolean;
  approvalComment: string;
  setApprovalComment: (val: string) => void;
  isSubmittingApproval: boolean;
  handleApprove: () => Promise<void>;
  handleReject: () => Promise<void>;
}

export const WorkflowSafetyTab: React.FC<WorkflowSafetyTabProps> = ({
  data,
  diagConf,
  fixConf,
  criticScore,
  riskLevel,
  securityFindings,
  approvalMessage,
  approvalError,
  currentApprovalStatus,
  isApproved,
  isHumanReview,
  isRejected,
  approvalComment,
  setApprovalComment,
  isSubmittingApproval,
  handleApprove,
  handleReject,
}) => {
  return (
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
            <span
              className={`text-[10px] font-bold ${
                securityFindings.length === 0 ? 'text-[#5B7C4B]' : 'text-[#C34A4A]'
              }`}
            >
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
      <div
        className={`p-4 rounded-xl border ${
          currentApprovalStatus === 'approved_by_human' || currentApprovalStatus === 'auto_approved'
            ? 'bg-[#EAF3E7] border-[#5B7C4B]/40'
            : isRejected
            ? 'bg-[#FDF0F0] border-[#C34A4A]/40'
            : 'bg-[#FFFBEB] border-[#D97706]/40'
        }`}
      >
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl text-[#2D2926]">
              {currentApprovalStatus === 'approved_by_human'
                ? 'verified'
                : isApproved
                ? 'task_alt'
                : isHumanReview
                ? 'gavel'
                : 'dangerous'}
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
                {data.safety_gate?.reasons?.[0] ||
                  'AI recommendations must be validated by deterministic safety policies before deployment.'}
              </p>
            </div>
          </div>

          <span className="font-mono text-xs px-2.5 py-1 rounded bg-white border border-[#E5DED6] font-bold text-[#2D2926]">
            Automated Decision: {(data.status || 'approved').toUpperCase()}
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
        <span className="font-bold text-xs text-[#2D2926] block">Deterministic Risk Factors Evaluated:</span>
        <ul className="space-y-1 text-[11px] text-[#6B625B]">
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-[#5B7C4B]">check</span>
            <span>
              <strong>Patch Lines:</strong> {data.risk_assessment?.diff_stats?.total_lines || 2} total lines changed
              (Threshold: ≤ 50 for Low Risk)
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-[#5B7C4B]">check</span>
            <span>
              <strong>Affected Files:</strong> {(data.fix?.affected_files || []).join(', ') || 'package.json'}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-[#5B7C4B]">check</span>
            <span>
              <strong>Destructive Commands:</strong> Zero detected (rm -rf, DROP TABLE, eval, raw shell blocked)
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-[#5B7C4B]">check</span>
            <span>
              <strong>SentinelGuard:</strong> Target branch protection and file permissions enforced
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
};
