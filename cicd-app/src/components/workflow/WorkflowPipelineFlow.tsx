import React from 'react';
import type { MultiAgentReasoningResult } from '../../types';

interface WorkflowPipelineFlowProps {
  data: MultiAgentReasoningResult;
  diagConf: number;
  fixConf: number;
  criticScore: number;
  riskLevel: string;
  currentApprovalStatus: string;
  isApproved: boolean;
  isHumanReview: boolean;
}

export const WorkflowPipelineFlow: React.FC<WorkflowPipelineFlowProps> = ({
  data,
  diagConf,
  fixConf,
  criticScore,
  riskLevel,
  currentApprovalStatus,
  isApproved,
  isHumanReview,
}) => {
  return (
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
            <span className="text-[9px] text-[#A89F91] truncate block">
              {data.diagnosis?.category || 'General'}
            </span>
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
              {data.fix?.fix_type || 'Patch'} (Att. #{data.attempts || 1})
            </span>
          </div>
        </div>

        {/* Node 4: Critic */}
        <div className="p-2.5 rounded-lg bg-[#2D2926] border border-[#99462A]/40 flex items-center gap-2">
          <span
            className={`material-symbols-outlined text-base ${
              data.critic?.approved ? 'text-[#5B7C4B]' : 'text-[#D97706]'
            }`}
          >
            {data.critic?.approved ? 'verified_user' : 'gavel'}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-bold text-[11px] text-[#FAF7F3]">Critic</span>
              <span className="text-[9px] font-mono text-white/90 font-bold">
                {Math.round(criticScore * 100)}%
              </span>
            </div>
            <span className="text-[9px] text-[#A89F91] truncate block">
              {data.critic?.approved ? '10/10 PASS' : `${data.critic?.issues?.length || 0} issue(s)`}
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
            <span
              className={`text-[9px] font-bold font-mono uppercase block ${
                riskLevel === 'low'
                  ? 'text-[#86efac]'
                  : riskLevel === 'medium'
                  ? 'text-[#fde047]'
                  : 'text-[#fca5a5]'
              }`}
            >
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
            {currentApprovalStatus === 'approved_by_human'
              ? 'how_to_reg'
              : isApproved
              ? 'task_alt'
              : isHumanReview
              ? 'person_alert'
              : 'block'}
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
  );
};
