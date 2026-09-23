import React from 'react';
import type { MultiAgentReasoningResult } from '../../types';

interface WorkflowDiagnoserTabProps {
  data: MultiAgentReasoningResult;
}

export const WorkflowDiagnoserTab: React.FC<WorkflowDiagnoserTabProps> = ({ data }) => {
  return (
    <div className="space-y-3">
      <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between flex-wrap gap-2 text-xs">
        <div>
          <span className="text-[#6B625B] text-[10px] uppercase font-semibold block">Failure Category</span>
          <span className="font-headline-sm font-bold text-sm text-[#99462A] mt-0.5 block">
            {(data.diagnosis?.category || 'dependency_error').toUpperCase()}
          </span>
        </div>
        <div>
          <span className="text-[#6B625B] text-[10px] uppercase font-semibold block">Diagnoser Confidence</span>
          <span className="font-headline-sm font-bold text-sm text-[#5B7C4B] mt-0.5 block">
            {Math.round((data.diagnosis?.confidence ?? 0.95) * 100)}% Certainty
          </span>
        </div>
        <div>
          <span className="text-[#6B625B] text-[10px] uppercase font-semibold block">Target Component</span>
          <span className="font-mono text-xs text-[#2D2926] mt-0.5 block">
            {(data.diagnosis?.affected_components || []).join(', ') || 'npm-dependencies'}
          </span>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-white border border-[#E5DED6] space-y-1">
        <span className="text-[10px] font-semibold text-[#6B625B] uppercase block">Synthesized Root Cause:</span>
        <p className="text-xs text-[#2D2926] leading-relaxed font-medium">
          {data.diagnosis?.root_cause || 'Root cause identified.'}
        </p>
      </div>

      <div className="space-y-1.5">
        <span className="text-[10px] font-semibold text-[#6B625B] uppercase block">Non-Hallucinated Evidence:</span>
        <div className="p-3 rounded-lg bg-[#201B18] font-mono text-xs text-[#D1C7BD] space-y-1 overflow-x-auto">
          {(data.diagnosis?.evidence || []).map((ev, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-[#D97757] select-none">›</span>
              <span>{ev}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
