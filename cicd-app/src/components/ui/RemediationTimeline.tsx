import type { RemediationStep } from '../../types';

interface RemediationTimelineProps {
  steps: RemediationStep[];
}

export default function RemediationTimeline({ steps }: RemediationTimelineProps) {
  return (
    <div className="flex-1 overflow-y-auto pr-space-xs space-y-space-sm max-h-[310px]">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <div key={step.id} className={`flex items-start gap-space-sm group ${step.status === 'pending' ? 'opacity-60' : ''}`}>
            <div className="flex flex-col items-center mt-1">
              {step.status === 'done' && (
                <span className="w-5 h-5 rounded-full bg-[#F9ECE7] text-[#D97757] border border-[#D97757]/40 flex items-center justify-center font-label-code-sm text-[10px] font-bold">✓</span>
              )}
              {step.status === 'running' && (
                <div className="w-5 h-5 rounded-full bg-[#F6EFE6] border border-[#B87A36]/40 text-[#B87A36] flex items-center justify-center animate-spin">
                  <span className="material-symbols-outlined text-sm">sync</span>
                </div>
              )}
              {step.status === 'pending' && (
                <span className="w-5 h-5 rounded-full bg-[#F2EDE6] border border-[#E5DED6] text-[#6B625B] flex items-center justify-center font-label-code-sm text-xs">○</span>
              )}
              {!isLast && (
                <span className={`w-0.5 h-6 mt-1 ${step.status === 'done' ? (steps[i + 1]?.status === 'running' ? 'bg-[#B87A36]/40' : 'bg-[#D97757]/30') : 'bg-[#E5DED6]'}`} />
              )}
            </div>
            <div className="flex-1 pb-space-2xs">
              <div className="flex items-center justify-between">
                <span className={`font-headline-sm text-body-md font-medium ${step.status === 'running' ? 'text-[#B87A36] font-semibold' : step.status === 'pending' ? 'text-[#6B625B]' : 'text-[#2D2926]'}`}>
                  {step.label}
                </span>
                {step.time && (
                  <span className="font-label-code-sm text-label-code-sm text-[#6B625B]">{step.time}</span>
                )}
                {step.status === 'running' && !step.time && (
                  <span className="font-label-code-sm text-label-code-sm text-[#B87A36] animate-pulse font-medium">Running (18s)</span>
                )}
                {step.status === 'pending' && (
                  <span className="font-label-code-sm text-label-code-sm text-[#6B625B]">Pending</span>
                )}
              </div>
              {step.description && (
                <p className="font-body-sm text-body-sm text-[#6B625B]">{step.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
