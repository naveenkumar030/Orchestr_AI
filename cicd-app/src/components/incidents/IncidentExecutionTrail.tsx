import React from 'react';
import type { Incident } from '../../types';

interface IncidentExecutionTrailProps {
  selectedIncident: Incident;
}

export const IncidentExecutionTrail: React.FC<IncidentExecutionTrailProps> = () => {
  return (
    <div className="lg:col-span-4 space-y-space-lg">
      <section className="rounded-xl bg-white border border-[#E5DED6] shadow-card overflow-hidden flex flex-col">
        <div className="p-space-md bg-[#F2EDE6]/80 border-b border-[#E5DED6] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#D97757] text-lg">timeline</span>
            <span className="font-headline-sm font-semibold text-[#2D2926]">Execution Trail</span>
          </div>
          <span className="font-label-code-sm text-xs text-[#99462A] bg-[#F9ECE7] border border-[#D97757]/30 px-2 py-0.5 rounded font-semibold">
            Live Loop
          </span>
        </div>

        <div className="p-space-md">
          <div className="relative pl-6 space-y-5">
            {/* Vertical connecting line */}
            <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-[#E5DED6]"></div>

            {/* Trail Steps */}
            <div className="relative flex items-start gap-3">
              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#FDF0F0] border border-[#C34A4A]/40 text-[#C34A4A] flex items-center justify-center">
                <span className="material-symbols-outlined text-xs">close</span>
              </div>
              <div className="text-xs">
                <div className="flex items-center gap-1 text-[#6B625B]">
                  <span className="font-mono">14:22:05</span> · <span className="font-semibold text-[#2D2926]">Failure detected</span>
                </div>
                <p className="text-[#6B625B] mt-0.5">GitHub Actions CI pipeline failed with exit code 1</p>
              </div>
            </div>

            <div className="relative flex items-start gap-3">
              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#D97757] text-white flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-xs">check</span>
              </div>
              <div className="text-xs">
                <div className="flex items-center gap-1 text-[#6B625B]">
                  <span className="font-mono">14:22:08</span> · <span className="font-semibold text-[#2D2926]">AST analysis</span>
                </div>
                <p className="text-[#6B625B] mt-0.5">Captured stack trace fingerprint HASH_9a7d</p>
              </div>
            </div>

            <div className="relative flex items-start gap-3">
              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#D97757] text-white flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-xs">check</span>
              </div>
              <div className="text-xs">
                <div className="flex items-center gap-1 text-[#6B625B]">
                  <span className="font-mono">14:22:15</span> · <span className="font-semibold text-[#2D2926]">Conflict isolated</span>
                </div>
                <p className="text-[#6B625B] mt-0.5">Identified @stripe/stripe-node peer dependency constraint</p>
              </div>
            </div>

            <div className="relative flex items-start gap-3">
              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#D97757] text-white flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-xs">check</span>
              </div>
              <div className="text-xs">
                <div className="flex items-center gap-1 text-[#6B625B]">
                  <span className="font-mono">14:22:28</span> · <span className="font-semibold text-[#2D2926]">Synthesized patch</span>
                </div>
                <p className="text-[#6B625B] mt-0.5">Updated package.json and resolved lockfile</p>
              </div>
            </div>

            <div className="relative flex items-start gap-3">
              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#D97757] text-white flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-xs">check</span>
              </div>
              <div className="text-xs">
                <div className="flex items-center gap-1 text-[#6B625B]">
                  <span className="font-mono">14:23:01</span> · <span className="font-semibold text-[#2D2926]">Sandbox verification</span>
                </div>
                <p className="text-[#6B625B] mt-0.5">Ephemeral k8s runner passed 440/440 tests</p>
              </div>
            </div>

            <div className="relative flex items-start gap-3">
              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#5B7C4B] text-white flex items-center justify-center shadow-xs animate-pulse">
                <span className="material-symbols-outlined text-xs">done_all</span>
              </div>
              <div className="text-xs">
                <div className="flex items-center gap-1 text-[#6B625B]">
                  <span className="font-mono">14:24:19</span> · <span className="font-semibold text-[#2D2926]">PR #184 Opened</span>
                </div>
                <p className="text-[#6B625B] mt-0.5">Assigned reviewers: @platform-lead, auto-merge enabled</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Knowledge Base Context Card */}
      <section className="rounded-xl bg-white border border-[#E5DED6] p-space-md shadow-card space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#6B625B]">
          <span className="material-symbols-outlined text-[#D97757] text-base">auto_stories</span>
          <span>KNOWLEDGE REPOSITORIES ACCESSED</span>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="p-2 rounded bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between">
            <span className="text-[#2D2926] font-mono">npm-resolution-recipes.db</span>
            <span className="text-[#99462A] font-semibold">99% match</span>
          </div>
          <div className="p-2 rounded bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between">
            <span className="text-[#2D2926] font-mono">stripe-migration-v14.md</span>
            <span className="text-[#99462A] font-semibold">Verified</span>
          </div>
          <div className="p-2 rounded bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between">
            <span className="text-[#2D2926] font-mono">service-catalog/payment-service</span>
            <span className="text-[#99462A] font-semibold">Policy checked</span>
          </div>
        </div>
      </section>
    </div>
  );
};
