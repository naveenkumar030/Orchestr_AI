import React from 'react';
import type { MultiAgentReasoningResult } from '../../types';

interface WorkflowPipelineTabProps {
  data: MultiAgentReasoningResult;
  criticScore: number;
  riskLevel: string;
}

export const WorkflowPipelineTab: React.FC<WorkflowPipelineTabProps> = ({
  data,
  criticScore,
  riskLevel,
}) => {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
          <span className="text-[#6B625B] text-[10px] uppercase font-semibold block">Total Duration</span>
          <span className="font-headline-sm font-bold text-[#2D2926] text-base mt-0.5 block">
            {data.execution_metrics?.total_duration_ms ?? 450}ms
          </span>
        </div>
        <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
          <span className="text-[#6B625B] text-[10px] uppercase font-semibold block">Refinement Attempts</span>
          <span className="font-headline-sm font-bold text-[#99462A] text-base mt-0.5 block">
            {data.attempts || 1} of 3 (Capped)
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
          <span
            className={`font-headline-sm font-bold text-base mt-0.5 block uppercase ${
              riskLevel === 'low' ? 'text-[#5B7C4B]' : riskLevel === 'medium' ? 'text-[#D97706]' : 'text-[#C34A4A]'
            }`}
          >
            {riskLevel} Risk
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {(data.agent_timeline || []).map((step, idx) => (
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
  );
};
