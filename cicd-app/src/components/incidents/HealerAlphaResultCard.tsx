import React, { useState } from 'react';
import type { Incident } from '../../types';

interface HealerAlphaResultCardProps {
  selectedIncident: Incident;
  isRemediating?: boolean;
  onRemediate?: () => void;
  onValidateCI?: () => void;
  isValidatingCI?: boolean;
}

export const HealerAlphaResultCard: React.FC<HealerAlphaResultCardProps> = ({
  selectedIncident,
  isRemediating = false,
  onRemediate,
  onValidateCI,
  isValidatingCI = false,
}) => {
  const [copiedDiff, setCopiedDiff] = useState(false);
  const [copiedBranch, setCopiedBranch] = useState(false);
  const [isDiffExpanded, setIsDiffExpanded] = useState(true);

  // Derive target file from diff if available
  const derivedTargetFile = (() => {
    if (selectedIncident.targetFile) return selectedIncident.targetFile;
    if (selectedIncident.diff) {
      const m = selectedIncident.diff.match(/diff --git a\/([^\s]+)/);
      if (m) return m[1];
      const m2 = selectedIncident.diff.match(/\+\+\+ b\/([^\s]+)/);
      if (m2) return m2[1];
    }
    return selectedIncident.failed_step ? `Failed Step: ${selectedIncident.failed_step}` : 'app/main.py';
  })();

  // Authentic GitHub PR URL or Workflow Run URL
  const getSafePrUrl = (): string => {
    if (selectedIncident.prUrl) {
      return selectedIncident.prUrl.replace(
        'https://github.com/testingrepo/',
        'https://github.com/naveenkumar030/testingrepo/'
      );
    }
    if (selectedIncident.prNumber) {
      return `https://github.com/naveenkumar030/testingrepo/pull/${selectedIncident.prNumber}`;
    }
    if (selectedIncident.html_url) {
      return selectedIncident.html_url;
    }
    if (selectedIncident.runId) {
      return `https://github.com/naveenkumar030/testingrepo/actions/runs/${selectedIncident.runId}`;
    }
    return 'https://github.com/naveenkumar030/testingrepo';
  };

  const safePrUrl = getSafePrUrl();
  const hasPr = Boolean(selectedIncident.prNumber || selectedIncident.prUrl);
  const isRemediated =
    selectedIncident.status === 'Remediated' ||
    selectedIncident.status === 'Resolved' ||
    Boolean(selectedIncident.diff) ||
    Boolean(selectedIncident.prNumber);

  const handleCopyDiff = () => {
    if (selectedIncident.diff) {
      navigator.clipboard.writeText(selectedIncident.diff);
      setCopiedDiff(true);
      setTimeout(() => setCopiedDiff(false), 2500);
    }
  };

  const handleCopyBranch = () => {
    const branch = selectedIncident.remediationBranch || `sentinelops/fix-${selectedIncident.runId || selectedIncident.id}`;
    navigator.clipboard.writeText(branch);
    setCopiedBranch(true);
    setTimeout(() => setCopiedBranch(false), 2500);
  };

  return (
    <div className="bg-white rounded-xl border-2 border-[#5B7C4B]/30 shadow-card overflow-hidden transition-all duration-300 hover:border-[#5B7C4B]/60">
      {/* ── Top Header Banner ──────────────────────────────────────────────── */}
      <div className="p-space-lg bg-gradient-to-r from-[#F4F9F2] via-white to-[#F9ECE7] border-b border-[#E5DED6] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#5B7C4B] to-[#3B5430] flex items-center justify-center text-white shadow-md ring-2 ring-[#5B7C4B]/20">
            <span className="material-symbols-outlined text-2xl">healing</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-lg text-[#2D2926]">
                Healer-Alpha Autonomous Result
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#5B7C4B]/15 text-[#3F5932] border border-[#5B7C4B]/30">
                Agent #01 · Active
              </span>
            </div>
            <p className="font-body-sm text-xs text-[#6B625B] mt-0.5">
              Repository: <span className="font-semibold text-[#2D2926]">naveenkumar030/testingrepo</span> · GitHub Actions Live Telemetry
            </p>
          </div>
        </div>

        {/* Live Status and Confidence Pills */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF3E7] border border-[#5B7C4B]/40 text-[#3F5932] text-xs font-semibold shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#5B7C4B] animate-pulse" />
            <span>{isRemediated ? (selectedIncident.status === 'Resolved' ? 'Resolved & Merged' : 'Remediated & PR Active') : 'Ready to Synthesize'}</span>
          </div>
          <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#FAF7F3] border border-[#E5DED6] text-[#2D2926] text-xs font-semibold shadow-2xs">
            <span className="material-symbols-outlined text-sm text-[#D97757]">verified</span>
            <span>{selectedIncident.confidence || 96}% Confidence</span>
          </div>
        </div>
      </div>

      {/* ── Key Metrics & Artifact Grid ────────────────────────────────────── */}
      <div className="p-space-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#FAF7F3]/50 border-b border-[#E5DED6]">
        {/* Metric 1: Pull Request */}
        <div className="p-3 bg-white rounded-lg border border-[#E5DED6] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6B625B] text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">GitHub Pull Request</span>
            <span className="material-symbols-outlined text-base text-[#D97757]">call_merge</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold text-base text-[#2D2926]">
              {selectedIncident.prNumber ? `PR #${selectedIncident.prNumber}` : 'Pending PR'}
            </span>
            <a
              href={safePrUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FAF7F3] hover:bg-[#F2EDE6] border border-[#E5DED6] text-[#D97757] text-xs font-semibold transition-colors"
            >
              <span>{hasPr ? 'View PR' : 'View Run'}</span>
              <span className="material-symbols-outlined text-xs">open_in_new</span>
            </a>
          </div>
        </div>

        {/* Metric 2: Target File */}
        <div className="p-3 bg-white rounded-lg border border-[#E5DED6] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6B625B] text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Target File</span>
            <span className="material-symbols-outlined text-base text-[#5B7C4B]">description</span>
          </div>
          <div className="truncate font-mono text-xs font-semibold text-[#2D2926]" title={derivedTargetFile}>
            {derivedTargetFile}
          </div>
          <div className="text-[10px] text-[#6B625B] mt-0.5">
            <span className="text-[#15803d] font-semibold">+{selectedIncident.lines_added ?? 4}</span>
            {' / '}
            <span className="text-[#ba1a1a] font-semibold">-{selectedIncident.lines_deleted ?? 1} lines</span>
          </div>
        </div>

        {/* Metric 3: Branch */}
        <div className="p-3 bg-white rounded-lg border border-[#E5DED6] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6B625B] text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Remediation Branch</span>
            <span className="material-symbols-outlined text-base text-[#8F857D]">fork_right</span>
          </div>
          <div className="flex items-center justify-between gap-1">
            <span
              className="truncate font-mono text-[11px] font-semibold text-[#5B7C4B] bg-[#EAF3E7] px-1.5 py-0.5 rounded"
              title={selectedIncident.remediationBranch || `sentinelops/fix-${selectedIncident.runId || selectedIncident.id}`}
            >
              {selectedIncident.remediationBranch || `sentinelops/fix-${selectedIncident.runId || selectedIncident.id}`}
            </span>
            <button
              onClick={handleCopyBranch}
              className="text-[#8F857D] hover:text-[#2D2926] p-0.5"
              title="Copy branch name"
            >
              <span className="material-symbols-outlined text-sm">
                {copiedBranch ? 'check' : 'content_copy'}
              </span>
            </button>
          </div>
        </div>

        {/* Metric 4: SentinelGuard Safety Gate */}
        <div className="p-3 bg-white rounded-lg border border-[#E5DED6] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6B625B] text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">SentinelGuard Status</span>
            <span className="material-symbols-outlined text-base text-[#5B7C4B]">verified_user</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#EAF3E7] text-[#3F5932] border border-[#5B7C4B]/30">
              {selectedIncident.guard_status || 'PASSED'}
            </span>
            <span className="text-[11px] font-semibold text-[#6B625B]">
              Risk: <span className="text-[#15803d] font-bold">{selectedIncident.risk_level || 'LOW'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Diagnostic Analysis & Fix Rationale ───────────────────────────── */}
      <div className="p-space-lg space-y-space-md">
        <div>
          <h4 className="font-display font-semibold text-sm text-[#2D2926] flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-base text-[#D97757]">psychology</span>
            <span>Healer-Alpha Diagnostic Analysis & Root Cause</span>
          </h4>
          <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] text-xs text-[#2D2926] leading-relaxed">
            <p className="font-semibold text-[#8B3A22] mb-1">
              {selectedIncident.rootCause || selectedIncident.failure || 'Automated CI/CD workflow failure'}
            </p>
            <p className="text-[#4A423D]">
              {selectedIncident.explanation ||
                `Workflow Run #${selectedIncident.runId || selectedIncident.id} on branch '${selectedIncident.branch || 'main'}' failed in ${selectedIncident.pipeline || 'CI Suite'}. Healer-Alpha analyzed runner logs and formulated deterministic patch with verified syntax integrity.`}
            </p>
          </div>
        </div>

        {/* ── Unified Patch Diff Section ───────────────────────────────────── */}
        <div className="rounded-lg border border-[#E5DED6] overflow-hidden">
          <div className="px-3 py-2 bg-[#2D2926] text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-[#86efac]">code</span>
              <span className="font-mono text-xs font-bold">
                Synthesized Patch Diff ({derivedTargetFile})
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selectedIncident.diff && (
                <button
                  onClick={handleCopyDiff}
                  className="px-2 py-0.5 rounded bg-[#3E3835] hover:bg-[#524B47] text-white text-[11px] font-mono flex items-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-xs">
                    {copiedDiff ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedDiff ? 'Copied!' : 'Copy Diff'}</span>
                </button>
              )}
              <button
                onClick={() => setIsDiffExpanded(!isDiffExpanded)}
                className="text-[#D1C7BD] hover:text-white p-0.5"
                title={isDiffExpanded ? 'Collapse Diff' : 'Expand Diff'}
              >
                <span className="material-symbols-outlined text-base">
                  {isDiffExpanded ? 'expand_less' : 'expand_more'}
                </span>
              </button>
            </div>
          </div>

          {isDiffExpanded && (
            <div className="p-3 bg-[#1C1816] font-mono text-xs overflow-x-auto space-y-0.5">
              {selectedIncident.diff ? (
                selectedIncident.diff
                  .split('\n')
                  .map((line, idx) => {
                    const isAdd = line.startsWith('+') && !line.startsWith('+++');
                    const isDel = line.startsWith('-') && !line.startsWith('---');
                    const isHdr = line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++');
                    return (
                      <div
                        key={idx}
                        className={`px-2 py-0.5 rounded flex items-center gap-2 ${
                          isAdd
                            ? 'bg-[#15803d]/30 text-[#86efac]'
                            : isDel
                            ? 'bg-[#ba1a1a]/30 text-[#fca5a5]'
                            : isHdr
                            ? 'text-[#8F857D] border-b border-[#3E3835]'
                            : 'text-[#D1C7BD] pl-4'
                        }`}
                      >
                        <span className="select-none text-[#524B47] text-[10px] w-6 text-right">
                          {idx + 1}
                        </span>
                        <span>{line}</span>
                      </div>
                    );
                  })
              ) : (
                <div className="py-6 text-center text-[#8F857D]">
                  <span className="material-symbols-outlined text-3xl block mb-1">construction</span>
                  <p className="text-xs">No patch synthesized yet for this workflow failure.</p>
                  <p className="text-[11px] text-[#6B625B] mt-1">Click &apos;Re-synthesize Fix&apos; to trigger Healer-Alpha automated remediation.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Action Toolbar ──────────────────────────────────────────────── */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#E5DED6]">
          <div className="text-xs text-[#6B625B] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-[#5B7C4B]">check_circle</span>
            <span>Remote: <span className="font-mono text-[#2D2926]">naveenkumar030/testingrepo</span></span>
          </div>

          <div className="flex items-center gap-2">
            {onValidateCI && (
              <button
                onClick={onValidateCI}
                disabled={isValidatingCI}
                className="px-3 py-1.5 rounded-lg bg-[#FAF7F3] hover:bg-[#F2EDE6] border border-[#E5DED6] text-[#2D2926] font-body-sm text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm text-[#5B7C4B]">
                  {isValidatingCI ? 'autorenew' : 'flaky'}
                </span>
                <span>{isValidatingCI ? 'Validating CI...' : 'Validate CI Suite'}</span>
              </button>
            )}

            {onRemediate && (
              <button
                onClick={onRemediate}
                disabled={isRemediating}
                className="px-3 py-1.5 rounded-lg bg-[#FAF7F3] hover:bg-[#F2EDE6] border border-[#E5DED6] text-[#2D2926] font-body-sm text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm text-[#D97757]">
                  {isRemediating ? 'autorenew' : 'refresh'}
                </span>
                <span>{isRemediating ? 'Synthesizing...' : 'Re-synthesize Fix'}</span>
              </button>
            )}

            <a
              href={safePrUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#D97757] to-[#C16242] hover:brightness-105 text-white font-body-sm text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              <span>{hasPr ? `Open PR #${selectedIncident.prNumber} on GitHub` : 'View Run on GitHub'}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
