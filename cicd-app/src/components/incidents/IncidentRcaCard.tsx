import React from 'react';
import type { Incident } from '../../types';

interface IncidentRcaCardProps {
  selectedIncident: Incident;
}

export const IncidentRcaCard: React.FC<IncidentRcaCardProps> = ({ selectedIncident }) => {
  return (
    <section className="rounded-xl bg-white border border-[#E5DED6] shadow-card overflow-hidden relative">
      <div className="p-space-md bg-[#F2EDE6]/80 border-b border-[#E5DED6] flex items-center justify-between flex-wrap gap-space-sm">
        <div className="flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-[#D97757] text-xl">auto_fix_high</span>
          <span className="font-headline-sm font-semibold text-[#2D2926] tracking-tight">
            AI Root Cause Identified
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[#F9ECE7] border border-[#D97757]/30 text-[#99462A] font-label-code-sm text-xs font-semibold">
            Deep AST Analysis
          </span>
        </div>
        <div className="flex items-center gap-space-sm">
          <span className="font-label-caps text-xs text-[#6B625B] uppercase tracking-wider font-semibold">
            Agent Confidence
          </span>
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 rounded-full bg-[#E5DED6] overflow-hidden">
              <div className="bg-[#D97757] h-full rounded-full" style={{ width: `${selectedIncident.confidence}%` }}></div>
            </div>
            <span className="font-label-code-sm text-xs text-[#D97757] font-bold">
              {selectedIncident.confidence}%
            </span>
          </div>
        </div>
      </div>

      <div className="p-space-lg space-y-space-md">
        {/* Conflict details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
          <div className="p-space-md rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-1">
            <span className="font-label-caps text-xs text-[#6B625B] uppercase tracking-wider font-semibold">
              Identified Root Conflict
            </span>
            <p className="font-body-sm text-sm text-[#2D2926] leading-relaxed">
              Node dependency version incompatibility:{' '}
              <code className="font-mono text-xs text-[#99462A] font-semibold bg-[#F9ECE7] px-1 py-0.5 rounded">
                @stripe/stripe-node v12.1.0
              </code>{' '}
              requires <code className="font-mono text-xs text-[#6B625B]">@types/node@^18.0.0</code>, which violates workspace spec (
              <code className="font-mono text-xs text-[#D97757] font-semibold">v20.11.0</code>).
            </p>
          </div>

          <div className="p-space-md rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-1">
            <span className="font-label-caps text-xs text-[#6B625B] uppercase tracking-wider font-semibold">
              Impacted Target Manifests
            </span>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="font-mono text-xs px-2 py-1 rounded bg-white border border-[#E5DED6] text-[#2D2926] flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-[#D97757]">description</span>
                package.json
              </span>
              <span className="font-mono text-xs px-2 py-1 rounded bg-white border border-[#E5DED6] text-[#2D2926] flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-[#D97757]">lock</span>
                package-lock.json
              </span>
              <span className="font-mono text-xs px-2 py-1 rounded bg-white border border-[#E5DED6] text-[#6B625B]">
                services/payment-webhook/**
              </span>
            </div>
          </div>
        </div>

        {/* Recommended Solution Banner */}
        <div className="p-space-md rounded-lg bg-[#F9ECE7] border border-[#D97757]/30 space-y-1">
          <div className="flex items-center gap-1.5 text-[#99462A]">
            <span className="material-symbols-outlined text-base text-[#D97757]">lightbulb</span>
            <span className="font-label-caps text-xs uppercase tracking-wider font-semibold">
              Automated Solution Strategy
            </span>
          </div>
          <p className="font-body-sm text-sm text-[#2D2926] leading-relaxed">
            Update <code className="font-mono text-xs text-[#99462A] font-semibold">@stripe/stripe-node</code> to version{' '}
            <code className="font-mono text-xs text-[#D97757] font-bold">14.1.2</code> and regenerate the deterministic lockfile with strict semantic versioning resolution flags to maintain node20 LTS parity.
          </p>
        </div>

        {/* Quick Action Bar */}
        <div className="flex items-center justify-between flex-wrap gap-space-sm pt-space-xs">
          <div className="flex items-center gap-space-xs flex-wrap">
            <button
              onClick={() => alert('Patch deployed to ephemeral staging namespace: staging-payment-pr184')}
              className="px-4 py-2 rounded-lg bg-white hover:bg-[#F2EDE6] border border-[#E5DED6] text-[#2D2926] font-body-sm text-xs flex items-center gap-1.5 transition-all shadow-sm font-semibold"
            >
              <span className="material-symbols-outlined text-base text-[#D97757]">rocket_launch</span>
              <span>Apply Fix to Staging</span>
            </button>
            <a
              href="#unified-diff"
              className="px-4 py-2 rounded-lg bg-white hover:bg-[#F2EDE6] border border-[#E5DED6] text-[#2D2926] font-body-sm text-xs flex items-center gap-1.5 transition-all shadow-sm font-semibold"
            >
              <span className="material-symbols-outlined text-base text-[#D97757]">difference</span>
              <span>Review Unified Diff</span>
            </a>
          </div>
          <span className="font-label-code-sm text-xs text-[#6B625B]">Synthesized in 14.8s</span>
        </div>
      </div>
    </section>
  );
};
