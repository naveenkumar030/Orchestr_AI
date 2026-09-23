import React from 'react';
import type { MultiAgentReasoningResult } from '../../types';

interface WorkflowFixTabProps {
  data: MultiAgentReasoningResult;
  copiedPatch: boolean;
  handleCopyDiff: () => void;
}

export const WorkflowFixTab: React.FC<WorkflowFixTabProps> = ({
  data,
  copiedPatch,
  handleCopyDiff,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-[#FAF7F3] border border-[#E5DED6] font-mono text-[11px] font-bold text-[#2D2926]">
            Type: {(data.fix?.fix_type || 'dependency').toUpperCase()}
          </span>
          <span className="font-mono text-xs text-[#6B625B]">
            Target: {(data.fix?.affected_files || []).join(', ')}
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
        <p className="text-xs text-[#2D2926] mt-0.5">{data.fix?.reason || 'Automated fix applied'}</p>
      </div>

      <div className="p-3 rounded-lg bg-[#201B18] font-mono text-xs overflow-x-auto space-y-0.5">
        {(data.fix?.patch || '').split('\n').map((line, idx) => {
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
  );
};
