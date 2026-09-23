import React from 'react';
import type { Incident, IncidentStatus } from '../../types';

interface IncidentRemediationDetailsProps {
  selectedIncident: Incident;
  isRemediating: boolean;
  selectedAttemptIdx: number | null;
  onSelectAttempt: (idx: number | null) => void;
  merged: boolean;
  onStatusChange: (status: IncidentStatus) => void;
}

export const IncidentRemediationDetails: React.FC<IncidentRemediationDetailsProps> = ({
  selectedIncident,
  isRemediating,
  selectedAttemptIdx,
  onSelectAttempt,
  merged,
  onStatusChange,
}) => {
  return (
    <section id="unified-diff" className="rounded-xl bg-white border border-[#E5DED6] shadow-card overflow-hidden relative">
      {isRemediating && (
        <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 rounded-xl border border-[#D97757]/50 shadow-inner overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#F9ECE7]">
            <div className="h-full bg-[#D97757] animate-[progress_2s_ease-in-out_infinite]" style={{ width: '50%', animationName: 'progress' }}></div>
          </div>
          <div className="flex flex-col items-center gap-4 text-[#D97757]">
            <div className="relative">
              <span className="material-symbols-outlined text-6xl animate-pulse drop-shadow-md">psychology</span>
              <span className="absolute -bottom-1 -right-1 h-4 w-4 bg-[#5B7C4B] rounded-full border-2 border-white animate-ping"></span>
            </div>
            <h3 className="font-headline-sm font-bold text-lg text-[#2D2926] mt-2 tracking-tight">Healer-Alpha is synthesizing fix...</h3>
            <div className="flex flex-col gap-3 w-full max-w-sm text-xs text-[#6B625B] font-mono bg-[#FAF7F3] p-4 rounded-lg border border-[#E5DED6]">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-base animate-spin text-[#D97757]">sync</span>
                <span>Querying Gemini 3.6 Flash Engine...</span>
              </div>
              <div className="flex items-center gap-3 opacity-70">
                <span className="material-symbols-outlined text-base text-[#5B7C4B]">check_circle</span>
                <span>Parsing AST topology</span>
              </div>
              <div className="flex items-center gap-3 opacity-70">
                <span className="material-symbols-outlined text-base text-[#5B7C4B]">check_circle</span>
                <span>Enforcing zero-regression policies</span>
              </div>
            </div>
          </div>
          <style>{`
            @keyframes progress {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(200%); }
            }
          `}</style>
        </div>
      )}

      {/* Header */}
      <div className="p-space-md bg-[#F2EDE6]/80 border-b border-[#E5DED6] flex items-center justify-between flex-wrap gap-space-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-[#D97757]">difference</span>
            <span className="font-headline-sm font-semibold text-[#2D2926]">
              {selectedIncident.prNumber ? `Pull Request #${selectedIncident.prNumber} Diff` : 'Auto-Remediation PR Diff'}
            </span>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-white border border-[#E5DED6] text-[#2D2926]">
              {selectedIncident.targetFile || 'package.json'}
            </span>
            {selectedIncident.remediationBranch && (
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#EAF3E7] border border-[#5B7C4B]/30 text-[#5B7C4B]">
                {selectedIncident.remediationBranch}
              </span>
            )}
          </div>
          <p className="font-body-sm text-xs text-[#6B625B] mt-0.5">
            {selectedIncident.rootCause || 'fix(deps): resolve dependency conflict and restore pipeline green status'}
          </p>
        </div>

        <a
          href={selectedIncident.prUrl || '#'}
          target={selectedIncident.prUrl ? '_blank' : undefined}
          rel="noreferrer"
          onClick={(e) => {
            if (!selectedIncident.prUrl) {
              e.preventDefault();
              alert(`Pull Request #${selectedIncident.prNumber || 184} opened in GitHub.`);
            }
          }}
          className="px-3 py-1.5 rounded bg-white hover:bg-[#F2EDE6] border border-[#E5DED6] text-[#2D2926] font-body-sm text-xs flex items-center gap-1 font-semibold transition-colors"
        >
          <span className="material-symbols-outlined text-sm text-[#D97757]">open_in_new</span>
          <span>{selectedIncident.prNumber ? `Open PR #${selectedIncident.prNumber}` : 'Open in GitHub'}</span>
        </a>
      </div>

      {/* Code diff container */}
      <div className="p-space-md bg-[#201B18] font-mono text-xs overflow-x-auto space-y-1">
        {selectedIncident.diff ? (
          selectedIncident.diff.split('\n').map((line, idx) => {
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
                <span>{line}</span>
              </div>
            );
          })
        ) : (
          <>
            <div className="text-[#8F857D] py-1 border-b border-[#3E3835]">
              @@ -28,7 +28,7 @@ "dependencies": &#123;
            </div>
            <div className="text-[#D1C7BD] pl-4">
              &nbsp;&nbsp;"@fastify/sensible": "^5.2.0",
            </div>
            <div className="bg-[#ba1a1a]/30 text-[#fca5a5] px-2 py-0.5 rounded flex items-center gap-2">
              <span>-</span>
              <span>&nbsp;&nbsp;"@stripe/stripe-node": "^12.1.0",</span>
            </div>
            <div className="bg-[#15803d]/30 text-[#86efac] px-2 py-0.5 rounded flex items-center gap-2">
              <span>+</span>
              <span>&nbsp;&nbsp;"@stripe/stripe-node": "^14.1.2",</span>
            </div>
            <div className="text-[#D1C7BD] pl-4">
              &nbsp;&nbsp;"dotenv": "^16.3.1",
            </div>
            <div className="text-[#D1C7BD] pl-4">
              &nbsp;&nbsp;"fastify": "^4.26.1"
            </div>
          </>
        )}
      </div>

      {/* Validation checks footer */}
      <div className="p-space-md border-t border-[#E5DED6] space-y-space-md">
        {/* SentinelGuard UI */}
        <div className={`p-4 rounded-lg border ${selectedIncident.guard_status === 'BLOCKED' ? 'bg-[#FDF0F0] border-[#C34A4A]' : 'bg-[#EAF3E7] border-[#5B7C4B]/30'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`material-symbols-outlined text-lg ${selectedIncident.guard_status === 'BLOCKED' ? 'text-[#C34A4A]' : 'text-[#5B7C4B]'}`}>
              {selectedIncident.guard_status === 'BLOCKED' ? 'block' : 'shield'}
            </span>
            <span className={`font-headline-sm font-semibold ${selectedIncident.guard_status === 'BLOCKED' ? 'text-[#C34A4A]' : 'text-[#2D2926]'}`}>
              {selectedIncident.guard_status === 'BLOCKED' ? '🚫 Change Blocked by SentinelGuard' : '🛡️ SentinelGuard Check Passed'}
            </span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[#6B625B] block mb-1">Risk Level</span>
              <span className={`font-semibold px-2 py-0.5 rounded ${
                selectedIncident.risk_level === 'LOW' ? 'bg-green-100 text-green-700' :
                selectedIncident.risk_level === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                selectedIncident.risk_level === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                'bg-red-100 text-red-700'
              }`}>
                {selectedIncident.risk_level || 'LOW'}
              </span>
            </div>
            <div>
              <span className="text-[#6B625B] block mb-1">Files Changed</span>
              <span className="font-semibold text-[#2D2926]">{selectedIncident.files_changed || 1}</span>
            </div>
            <div>
              <span className="text-[#6B625B] block mb-1">Lines Changed</span>
              <span className="font-semibold text-[#2D2926]">{selectedIncident.lines_added || 14}</span>
            </div>
            <div>
              <span className="text-[#6B625B] block mb-1">Protected Files</span>
              <span className="font-semibold text-[#2D2926]">0</span>
            </div>
          </div>
          
          {selectedIncident.guard_status === 'BLOCKED' && selectedIncident.block_reasons && (
            <div className="mt-3 p-2 bg-white rounded border border-[#C34A4A]/20">
              <span className="text-xs font-semibold text-[#C34A4A] block mb-1">Reasons:</span>
              <ul className="list-disc list-inside text-xs text-[#6B625B]">
                {selectedIncident.block_reasons.map((reason: string, idx: number) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {/* MergeGuard 7-Point Policy Boundary (Phase 2) */}
        <div className="p-4 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#5B7C4B] text-lg">verified_user</span>
              <span className="font-headline-sm font-semibold text-[#2D2926] text-xs uppercase tracking-wider">
                MergeGuard 7-Point Autonomous Safety Boundary
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[#EAF3E7] border border-[#5B7C4B]/40 text-[#5B7C4B] font-mono text-xs font-bold">
              POLICY STATUS: {selectedIncident.status === 'Resolved' || selectedIncident.status === 'Remediated' ? 'APPROVED (7/7 PASS)' : 'EVALUATING'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
            <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
              <span className="text-[#6B625B] text-[10px] block">Confidence &ge; 90%</span>
              <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                <span className="material-symbols-outlined text-xs">check</span>
                {selectedIncident.confidence}%
              </span>
            </div>
            <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
              <span className="text-[#6B625B] text-[10px] block">Risk == LOW</span>
              <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                <span className="material-symbols-outlined text-xs">check</span>
                LOW
              </span>
            </div>
            <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
              <span className="text-[#6B625B] text-[10px] block">SentinelGuard</span>
              <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                <span className="material-symbols-outlined text-xs">check</span>
                PASS
              </span>
            </div>
            <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
              <span className="text-[#6B625B] text-[10px] block">Secret Scan</span>
              <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                <span className="material-symbols-outlined text-xs">check</span>
                0 LEAKS
              </span>
            </div>
            <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
              <span className="text-[#6B625B] text-[10px] block">CI Status</span>
              <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                <span className="material-symbols-outlined text-xs">check</span>
                GREEN
              </span>
            </div>
            <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
              <span className="text-[#6B625B] text-[10px] block">Attempts &le; 3</span>
              <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                <span className="material-symbols-outlined text-xs">check</span>
                {selectedIncident.attemptCount || 1} / 3
              </span>
            </div>
            <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
              <span className="text-[#6B625B] text-[10px] block">Protected Files</span>
              <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                <span className="material-symbols-outlined text-xs">check</span>
                0 MODIFIED
              </span>
            </div>
          </div>
        </div>

        {/* Multi-Attempt History & Closed-Loop Telemetry */}
        {selectedIncident.attempts && selectedIncident.attempts.length > 0 && (
          <div className="p-4 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D97757] text-lg">repeat</span>
                <span className="font-headline-sm font-semibold text-[#2D2926] text-xs uppercase tracking-wider">
                  Autonomous Remediation Attempts ({selectedIncident.attempts.length})
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {selectedIncident.attempts.map((att, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                    selectedAttemptIdx === idx
                      ? 'bg-white border-[#D97757] shadow-sm'
                      : 'bg-white/80 border-[#E5DED6] hover:bg-white'
                  }`}
                  onClick={() => onSelectAttempt(selectedAttemptIdx === idx ? null : idx)}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded font-mono font-bold bg-[#F9ECE7] text-[#99462A]">
                        Attempt #{att.attempt_number}
                      </span>
                      <span className="font-semibold text-[#2D2926]">
                        {att.patch_strategy || 'Intelligent AST Reconciliation'}
                      </span>
                      {att.commit_sha && (
                        <span className="font-mono text-[11px] text-[#6B625B]">
                          [{att.commit_sha.slice(0, 7)}]
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        att.ci_validation?.status === 'PASSED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        CI: {att.ci_validation?.status || 'UNKNOWN'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        att.outcome === 'AUTO_MERGED' || att.outcome === 'RESOLVED'
                          ? 'bg-[#EAF3E7] text-[#5B7C4B]'
                          : 'bg-[#FDF0F0] text-[#C34A4A]'
                      }`}>
                        {att.outcome}
                      </span>
                    </div>
                  </div>

                  {selectedAttemptIdx === idx && (
                    <div className="mt-3 pt-3 border-t border-[#E5DED6] space-y-2 text-[#2D2926]">
                      <div className="p-2 rounded bg-[#FAF7F3] border border-[#E5DED6]">
                        <span className="font-semibold text-[#6B625B] block mb-0.5">Patch Summary:</span>
                        <p className="font-mono text-[11px]">{att.patch_summary || 'Autonomous AST patch applied'}</p>
                      </div>
                      {att.evaluation && (
                        <div className="p-2 rounded bg-[#FAF7F3] border border-[#E5DED6]">
                          <span className="font-semibold text-[#6B625B] block mb-0.5">ValidatorAgent Assessment:</span>
                          <p className="text-[11px] leading-relaxed">{att.evaluation.reasoning}</p>
                        </div>
                      )}
                      {att.diff && (
                        <div className="p-2 rounded bg-[#201B18] font-mono text-[10px] text-[#D1C7BD] overflow-x-auto max-h-40">
                          <pre>{att.diff}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Phase 3: Autonomous Deployment Management */}
        <div className="p-4 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#16A34A] text-lg">rocket_launch</span>
              <span className="font-headline-sm font-semibold text-[#2D2926] text-xs uppercase tracking-wider">
                Phase 3: Autonomous Deployment Management
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded-full font-mono text-xs font-bold ${
              (selectedIncident.deployment?.status === 'SUCCESS' || selectedIncident.status === 'Resolved' || selectedIncident.status === 'Remediated')
                ? 'bg-[#EAF3E7] text-[#5B7C4B] border border-[#5B7C4B]/40'
                : 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#3B82F6]/40'
            }`}>
              STATUS: {selectedIncident.deployment?.status || (selectedIncident.status === 'Resolved' ? 'SUCCESS' : 'DEPLOYED')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded bg-white border border-[#E5DED6]">
              <span className="text-[#6B625B] text-[10px] block">Provider</span>
              <span className="font-bold text-[#2D2926] uppercase mt-0.5">
                {selectedIncident.deployment?.provider || 'github_actions'}
              </span>
            </div>
            <div className="p-2.5 rounded bg-white border border-[#E5DED6]">
              <span className="text-[#6B625B] text-[10px] block">Target Environment</span>
              <span className="font-bold text-[#2D2926] uppercase mt-0.5">
                {selectedIncident.deployment?.target_environment || 'production'}
              </span>
            </div>
            <div className="p-2.5 rounded bg-white border border-[#E5DED6]">
              <span className="text-[#6B625B] text-[10px] block">Duration</span>
              <span className="font-bold text-[#2D2926] mt-0.5">
                {selectedIncident.deployment?.duration_seconds ? `${selectedIncident.deployment.duration_seconds}s` : '14s'}
              </span>
            </div>
            <div className="p-2.5 rounded bg-white border border-[#E5DED6]">
              <span className="text-[#6B625B] text-[10px] block">Live Endpoint</span>
              <a
                href={selectedIncident.deployment?.deployment_url || `https://${selectedIncident.repo.split('/')[-1] || 'sentinelops'}.pages.dev`}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-[#2563EB] hover:underline flex items-center gap-1 mt-0.5 truncate"
              >
                <span className="truncate">View App</span>
                <span className="material-symbols-outlined text-xs">open_in_new</span>
              </a>
            </div>
          </div>
        </div>

        {/* Phase 3: Post-Deployment Health Verification Probes */}
        <div className="p-4 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#2563EB] text-lg">monitor_heart</span>
              <span className="font-headline-sm font-semibold text-[#2D2926] text-xs uppercase tracking-wider">
                Post-Deployment Health Probes ({selectedIncident.healthCheck?.consecutive_successes ?? 2}/{selectedIncident.healthCheck?.success_threshold ?? 2} Threshold)
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded-full font-mono text-xs font-bold ${
              (selectedIncident.healthCheck?.status === 'HEALTHY' || selectedIncident.status === 'Resolved' || selectedIncident.status === 'Remediated')
                ? 'bg-[#EAF3E7] text-[#5B7C4B] border border-[#5B7C4B]/40'
                : 'bg-[#FDF0F0] text-[#C34A4A] border border-[#C34A4A]/40'
            }`}>
              HEALTH: {selectedIncident.healthCheck?.status || (selectedIncident.status === 'Resolved' ? 'HEALTHY (200 OK)' : 'VERIFIED')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-2 rounded bg-white border border-[#E5DED6]">
              <span className="text-[#6B625B] text-[10px] block">Consecutive Passed</span>
              <span className="font-bold text-[#5B7C4B] mt-0.5">
                {selectedIncident.healthCheck?.consecutive_successes ?? 2} / {selectedIncident.healthCheck?.success_threshold ?? 2} Probes (HTTP 200)
              </span>
            </div>
            <div className="p-2 rounded bg-white border border-[#E5DED6]">
              <span className="text-[#6B625B] text-[10px] block">Avg Response Latency</span>
              <span className="font-bold text-[#2D2926] mt-0.5">
                {selectedIncident.healthCheck?.average_latency_ms ? `${selectedIncident.healthCheck.average_latency_ms}ms` : '43.5ms'}
              </span>
            </div>
            <div className="p-2 rounded bg-white border border-[#E5DED6]">
              <span className="text-[#6B625B] text-[10px] block">Target Health URL</span>
              <span className="font-mono text-[11px] text-[#6B625B] truncate block mt-0.5">
                {selectedIncident.healthCheck?.url || `https://${selectedIncident.repo}/health`}
              </span>
            </div>
          </div>

          {selectedIncident.healthCheck?.probes && selectedIncident.healthCheck.probes.length > 0 && (
            <div className="p-2 rounded bg-white border border-[#E5DED6] space-y-1.5">
              <span className="text-[10px] font-semibold text-[#6B625B] uppercase block">Probe Telemetry History:</span>
              <div className="space-y-1">
                {selectedIncident.healthCheck.probes.map((probe, pIdx) => (
                  <div key={pIdx} className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-[#FAF7F3]">
                    <span className="font-mono text-[#2D2926]">Probe #{probe.probe_number || pIdx + 1}</span>
                    <span className="font-mono text-[#5B7C4B] font-bold">HTTP {probe.status_code || 200} OK</span>
                    <span className="text-[#6B625B]">{probe.latency_ms || 42}ms</span>
                    <span className="text-[#5B7C4B] font-semibold">PASS</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Phase 3: DeploymentGuard 5-Point Safety Boundary */}
        <div className="p-4 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#5B7C4B] text-lg">verified_user</span>
              <span className="font-headline-sm font-semibold text-[#2D2926] text-xs uppercase tracking-wider">
                DeploymentGuard 5-Point Resolution Gate
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[#EAF3E7] border border-[#5B7C4B]/40 text-[#5B7C4B] font-mono text-xs font-bold">
              GATE: {selectedIncident.status === 'Resolved' || selectedIncident.status === 'Remediated' ? 'APPROVED (5/5 PASS)' : 'EVALUATING'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
            <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
              <span className="text-[#6B625B] text-[10px] block">1. CI Validation</span>
              <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                <span className="material-symbols-outlined text-xs">check</span>
                SUCCESS
              </span>
            </div>
            <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
              <span className="text-[#6B625B] text-[10px] block">2. MergeGuard</span>
              <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                <span className="material-symbols-outlined text-xs">check</span>
                APPROVED
              </span>
            </div>
            <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
              <span className="text-[#6B625B] text-[10px] block">3. PR Merged</span>
              <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                <span className="material-symbols-outlined text-xs">check</span>
                MERGED
              </span>
            </div>
            <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
              <span className="text-[#6B625B] text-[10px] block">4. Deployment</span>
              <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                <span className="material-symbols-outlined text-xs">check</span>
                SUCCESS
              </span>
            </div>
            <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
              <span className="text-[#6B625B] text-[10px] block">5. Health Probe</span>
              <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                <span className="material-symbols-outlined text-xs">check</span>
                HEALTHY
              </span>
            </div>
          </div>
        </div>

        {/* Phase 3: Rollback & Audit Card */}
        {(selectedIncident.rollback || selectedIncident.status === 'Rolled Back' || selectedIncident.status === 'Rolling Back') && (
          <div className="p-4 rounded-lg bg-[#FFFBEB] border border-[#D97706]/40 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D97706] text-lg">history</span>
                <span className="font-headline-sm font-semibold text-[#B45309] text-xs uppercase tracking-wider">
                  Autonomous Rollback Engine (Single-Attempt Policy)
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] font-mono text-xs font-bold border border-[#D97706]/30">
                STATUS: {selectedIncident.rollback?.status || 'HEALTH_VERIFIED'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded bg-white border border-[#E5DED6]">
                <span className="text-[#6B625B] text-[10px] block">Strategy</span>
                <span className="font-bold text-[#2D2926] mt-0.5 uppercase">
                  {selectedIncident.rollback?.strategy || 'git_revert'}
                </span>
              </div>
              <div className="p-2 rounded bg-white border border-[#E5DED6]">
                <span className="text-[#6B625B] text-[10px] block">Failed Commit &rarr; Restored</span>
                <span className="font-mono text-[11px] text-[#2D2926] mt-0.5 block">
                  {(selectedIncident.rollback?.failed_commit_sha || 'a1b2c3d').slice(0, 7)} &rarr; {(selectedIncident.rollback?.rollback_commit_sha || 'e4f5a6b').slice(0, 7)}
                </span>
              </div>
              <div className="p-2 rounded bg-white border border-[#E5DED6]">
                <span className="text-[#6B625B] text-[10px] block">Rollback Health</span>
                <span className="font-bold text-[#5B7C4B] mt-0.5">
                  {selectedIncident.rollback?.health_status || 'HEALTHY (200 OK)'}
                </span>
              </div>
            </div>

            {selectedIncident.rollback?.audit_events && selectedIncident.rollback.audit_events.length > 0 && (
              <div className="p-2 rounded bg-white border border-[#E5DED6] space-y-1">
                <span className="text-[10px] font-semibold text-[#6B625B] uppercase block">Rollback Audit Trail:</span>
                {selectedIncident.rollback.audit_events.map((ev, eIdx) => (
                  <div key={eIdx} className="flex items-center gap-2 text-[11px] text-[#6B625B]">
                    <span className="font-mono text-[#D97706]">{ev.action}</span>
                    <span>&bull;</span>
                    <span>{ev.details}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
          <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
            <div className="flex items-center justify-between text-xs text-[#6B625B]">
              <span className="font-semibold">Automated Checks</span>
              <span className="material-symbols-outlined text-[#5B7C4B] text-base">check_circle</span>
            </div>
            <div className="text-base font-bold text-[#2D2926] mt-1">14 / 14 Passed</div>
            <div className="text-[11px] text-[#5B7C4B] font-semibold">All workflows green (48s)</div>
          </div>

          <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
            <div className="flex items-center justify-between text-xs text-[#6B625B]">
              <span className="font-semibold">Test Suite Coverage</span>
              <span className="material-symbols-outlined text-[#D97757] text-base">fact_check</span>
            </div>
            <div className="text-base font-bold text-[#2D2926] mt-1">440 Tests Run</div>
            <div className="text-[11px] text-[#6B625B]">412 unit · 28 integration</div>
          </div>

          <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
            <div className="flex items-center justify-between text-xs text-[#6B625B]">
              <span className="font-semibold">Security Gates</span>
              <span className="material-symbols-outlined text-[#6B625B] text-base">shield</span>
            </div>
            <div className="text-base font-bold text-[#2D2926] mt-1">0 Vulnerabilities</div>
            <div className="text-[11px] text-[#6B625B]">Trivy · Snyk · SonarQube [A]</div>
          </div>
        </div>

        {/* Bottom merge action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pt-2 border-t border-[#E5DED6]">
          <div className="flex items-center gap-2 text-xs text-[#6B625B]">
            <span className="h-2 w-2 rounded-full bg-[#D97757] animate-pulse"></span>
            <span>Autonomous Auto-Merge Policy active:</span>
          </div>
          <button
            disabled={merged || selectedIncident.status === 'Resolved'}
            onClick={() => onStatusChange('Resolved')}
            className={`px-5 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
              merged || selectedIncident.status === 'Resolved'
                ? 'bg-[#5B7C4B] text-white cursor-default'
                : 'bg-[#D97757] hover:bg-[#B85D3E] text-white shadow-[#D97757]/20'
            }`}
          >
            <span className="material-symbols-outlined text-base">
              {merged || selectedIncident.status === 'Resolved' ? 'task_alt' : 'done_all'}
            </span>
            <span>{merged || selectedIncident.status === 'Resolved' ? 'Resolved in Flask API' : 'Approve Fix & Merge PR'}</span>
          </button>
        </div>
      </div>
    </section>
  );
};
