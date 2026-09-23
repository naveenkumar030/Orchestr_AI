import React from 'react';
import type { MultiAgentReasoningResult } from '../../types';

interface WorkflowHistoryTabProps {
  data: MultiAgentReasoningResult;
  selectedAttempt: number;
  setSelectedAttempt: (idx: number) => void;
}

export const WorkflowHistoryTab: React.FC<WorkflowHistoryTabProps> = ({
  data,
  selectedAttempt,
  setSelectedAttempt,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 overflow-x-auto">
        {(data.refinement_history || []).map((att, idx) => (
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

      {data.refinement_history && data.refinement_history[selectedAttempt] && (
        <div className="p-4 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#2D2926]">
                Attempt #{data.refinement_history[selectedAttempt]?.attempt_number || 1} Details
              </span>
              <span
                className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                  data.refinement_history[selectedAttempt]?.approved
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {data.refinement_history[selectedAttempt]?.approved ? 'CRITIC APPROVED' : 'CRITIC REJECTED'}
              </span>
            </div>
            <span className="font-mono text-xs text-[#8F857D]">
              Duration: {data.refinement_history[selectedAttempt]?.duration_ms ?? 350}ms
            </span>
          </div>

          <div className="p-3 rounded bg-white border border-[#E5DED6]">
            <span className="text-[10px] font-semibold text-[#6B625B] uppercase block">Critic Feedback:</span>
            <p className="text-xs text-[#2D2926] mt-0.5">
              {data.refinement_history[selectedAttempt]?.critic?.reason || 'Verified minimal unified diff.'}
            </p>
          </div>

          <div className="p-3 rounded bg-[#201B18] font-mono text-xs text-[#D1C7BD] overflow-x-auto max-h-48">
            <pre>{data.refinement_history[selectedAttempt]?.fix?.patch || ''}</pre>
          </div>
        </div>
      )}
    </div>
  );
};
