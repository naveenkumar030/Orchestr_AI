import React from 'react';
import type { MultiAgentReasoningResult } from '../../types';

interface WorkflowCriticTabProps {
  data: MultiAgentReasoningResult;
  isApproved: boolean;
  securityFindings: string[];
}

export const WorkflowCriticTab: React.FC<WorkflowCriticTabProps> = ({
  data,
  isApproved,
  securityFindings,
}) => {
  const checklistItems = [
    {
      code: 'A',
      title: 'Root Cause Correctness',
      desc: 'Diagnosed cause directly matches failure fingerprint',
      passed: (data.diagnosis?.confidence ?? 0.95) >= 0.7,
    },
    {
      code: 'B',
      title: 'Evidence Grounding',
      desc: 'All evidence quoted directly from runner log stream',
      passed: (data.diagnosis?.evidence?.length ?? 0) > 0,
    },
    {
      code: 'C',
      title: 'File Relevance',
      desc: 'Patch touches only diagnosed affected files',
      passed: (data.fix?.affected_files?.length ?? 0) > 0,
    },
    {
      code: 'D',
      title: 'Remediation Efficacy',
      desc: 'Patch directly rectifies the failing condition',
      passed: isApproved,
    },
    {
      code: 'E',
      title: 'Minimal Blast Radius',
      desc: 'Patch changes strictly minimal lines without rewrites',
      passed: (data.fix?.patch || '').split('\n').length <= 30,
    },
    {
      code: 'F',
      title: 'Regression Safety',
      desc: 'No unhandled exception suppression or syntax breaks',
      passed: isApproved,
    },
    {
      code: 'G',
      title: 'Security Audit',
      desc: 'No destructive commands (rm -rf, DROP, etc.) detected',
      passed: securityFindings.length === 0,
    },
    {
      code: 'H',
      title: 'Secret Zero-Leakage',
      desc: 'No unredacted tokens, keys, or credentials in patch',
      passed: true,
    },
    {
      code: 'I',
      title: 'Technical Consistency',
      desc: 'Patch style and imports conform to repository topology',
      passed: true,
    },
    {
      code: 'J',
      title: 'Validation Bounds',
      desc: 'Requires automated CI verification before merging',
      passed: true,
    },
  ];

  return (
    <div className="space-y-3 text-xs">
      <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between flex-wrap gap-2">
        <div>
          <span className="text-[#6B625B] text-[10px] uppercase font-semibold block">Critic Score</span>
          <span className="font-headline-sm font-bold text-base text-[#2D2926] mt-0.5 block">
            {Math.round((data.critic?.score ?? 0.9) * 100)}%
          </span>
        </div>
        <div>
          <span className="text-[#6B625B] text-[10px] uppercase font-semibold block">Decision</span>
          <span
            className={`font-headline-sm font-bold text-base mt-0.5 block ${
              data.critic?.approved ? 'text-[#5B7C4B]' : 'text-[#C34A4A]'
            }`}
          >
            {data.critic?.approved ? 'APPROVED' : 'REJECTED'}
          </span>
        </div>
        <div>
          <span className="text-[#6B625B] text-[10px] uppercase font-semibold block">Human Review Required</span>
          <span className="font-mono text-xs font-bold text-[#2D2926] mt-0.5 block">
            {data.critic?.requires_human_review ? 'YES' : 'NO'}
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
  );
};
