import React from 'react';
import type { Incident } from '../../types';

interface IncidentRcaCardProps {
  selectedIncident: Incident;
}

export const IncidentRcaCard: React.FC<IncidentRcaCardProps> = ({ selectedIncident }) => {
  const affectedFiles: string[] = selectedIncident.targetFile
    ? [selectedIncident.targetFile]
    : [];

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
        {/* Failure + Root Cause */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
          <div className="p-space-md rounded-lg bg-[#FDF0F0] border border-[#C34A4A]/20 space-y-1">
            <span className="font-label-caps text-xs text-[#C34A4A] uppercase tracking-wider font-semibold">
              Detected Failure
            </span>
            <p className="font-body-sm text-sm text-[#2D2926] leading-relaxed">
              {selectedIncident.failure || 'Workflow step failure detected'}
            </p>
          </div>

          <div className="p-space-md rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-1">
            <span className="font-label-caps text-xs text-[#6B625B] uppercase tracking-wider font-semibold">
              Identified Root Cause
            </span>
            <p className="font-body-sm text-sm text-[#2D2926] leading-relaxed">
              {selectedIncident.rootCause || 'Under investigation'}
            </p>
          </div>
        </div>

        {/* Impacted Files */}
        {affectedFiles.length > 0 && (
          <div className="p-space-md rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-2">
            <span className="font-label-caps text-xs text-[#6B625B] uppercase tracking-wider font-semibold">
              Impacted Files
            </span>
            <div className="flex flex-wrap gap-2">
              {affectedFiles.map((file) => (
                <span
                  key={file}
                  className="font-mono text-xs px-2 py-1 rounded bg-white border border-[#E5DED6] text-[#2D2926] flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-xs text-[#D97757]">description</span>
                  {file}
                </span>
              ))}
              {selectedIncident.files_changed && selectedIncident.files_changed > affectedFiles.length && (
                <span className="font-mono text-xs px-2 py-1 rounded bg-white border border-[#E5DED6] text-[#6B625B]">
                  +{selectedIncident.files_changed - affectedFiles.length} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Explanation / Strategy */}
        {selectedIncident.explanation && (
          <div className="p-space-md rounded-lg bg-[#F9ECE7] border border-[#D97757]/30 space-y-1">
            <div className="flex items-center gap-1.5 text-[#99462A]">
              <span className="material-symbols-outlined text-base text-[#D97757]">lightbulb</span>
              <span className="font-label-caps text-xs uppercase tracking-wider font-semibold">
                Automated Solution Strategy
              </span>
            </div>
            <p className="font-body-sm text-sm text-[#2D2926] leading-relaxed">
              {selectedIncident.explanation}
            </p>
          </div>
        )}

        {/* Metadata ribbon */}
        <div className="flex items-center justify-between flex-wrap gap-space-sm pt-space-xs">
          <div className="flex items-center gap-space-xs flex-wrap">
            {/* Guard status */}
            {selectedIncident.guard_status && (
              <span
                className={`px-3 py-1.5 rounded-lg font-mono text-xs font-semibold flex items-center gap-1 border ${
                  selectedIncident.guard_status === 'PASSED'
                    ? 'bg-[#EAF3E7] border-[#5B7C4B]/30 text-[#5B7C4B]'
                    : 'bg-[#FDF0F0] border-[#C34A4A]/30 text-[#C34A4A]'
                }`}
              >
                <span className="material-symbols-outlined text-xs">
                  {selectedIncident.guard_status === 'PASSED' ? 'verified' : 'shield'}
                </span>
                SentinelGuard: {selectedIncident.guard_status}
              </span>
            )}
            {/* Risk level */}
            {selectedIncident.risk_level && (
              <span
                className={`px-3 py-1.5 rounded-lg font-mono text-xs font-semibold border ${
                  selectedIncident.risk_level === 'LOW'
                    ? 'bg-[#EAF3E7] border-[#5B7C4B]/30 text-[#5B7C4B]'
                    : selectedIncident.risk_level === 'MEDIUM'
                    ? 'bg-[#F6EFE6] border-[#B87A36]/30 text-[#B87A36]'
                    : 'bg-[#FDF0F0] border-[#C34A4A]/30 text-[#C34A4A]'
                }`}
              >
                Risk: {selectedIncident.risk_level}
              </span>
            )}
            {/* PR link */}
            {(selectedIncident.prUrl || selectedIncident.prNumber) && (
              <a
                href={
                  selectedIncident.prUrl
                    ? selectedIncident.prUrl.replace('https://github.com/testingrepo/', 'https://github.com/naveenkumar030/testingrepo/')
                    : `https://github.com/naveenkumar030/testingrepo/pull/${selectedIncident.prNumber}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#F2EDE6] border border-[#E5DED6] text-[#2D2926] font-body-sm text-xs flex items-center gap-1.5 transition-all shadow-sm font-semibold"
              >
                <span className="material-symbols-outlined text-base text-[#D97757]">call_merge</span>
                <span>PR #{selectedIncident.prNumber}</span>
              </a>
            )}
            {/* Diff link */}
            {selectedIncident.diff && (
              <a
                href="#unified-diff"
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#F2EDE6] border border-[#E5DED6] text-[#2D2926] font-body-sm text-xs flex items-center gap-1.5 transition-all shadow-sm font-semibold"
              >
                <span className="material-symbols-outlined text-base text-[#D97757]">difference</span>
                <span>Review Unified Diff</span>
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-[#6B625B]">
            {selectedIncident.branch && (
              <span className="font-mono px-2 py-0.5 bg-[#FAF7F3] border border-[#E5DED6] rounded">
                {selectedIncident.branch}
              </span>
            )}
            {selectedIncident.commit && (
              <span className="font-mono px-2 py-0.5 bg-[#FAF7F3] border border-[#E5DED6] rounded">
                {selectedIncident.commit}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
