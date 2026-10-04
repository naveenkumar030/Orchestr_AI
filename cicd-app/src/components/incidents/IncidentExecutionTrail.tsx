import React from 'react';
import type { Incident, IncidentTimelineEvent } from '../../types';

interface IncidentExecutionTrailProps {
  selectedIncident: Incident;
}

function getStepIcon(event: IncidentTimelineEvent) {
  const s = (event.status || '').toLowerCase();
  const title = (event.title || '').toLowerCase();
  if (s === 'error' || s === 'failed') return { icon: 'close', bg: 'bg-[#FDF0F0] border-[#C34A4A]/40 text-[#C34A4A]' };
  if (s === 'running') return { icon: 'progress_activity', bg: 'bg-[#EEF2FF] border-[#4F46E5]/40 text-[#4F46E5] animate-spin' };
  if (title.includes('escalat')) return { icon: 'warning', bg: 'bg-[#FDF0F0] border-[#C34A4A]/40 text-[#C34A4A]' };
  if (title.includes('resolved') || title.includes('remediated')) return { icon: 'done_all', bg: 'bg-[#5B7C4B] text-white' };
  return { icon: 'check', bg: 'bg-[#D97757] text-white' };
}

function getIconLabel(icon: string): string {
  // Map emoji icons to material symbols
  const map: Record<string, string> = {
    '🔴': 'close',
    '🟠': 'warning',
    '🧠': 'psychology',
    '❌': 'close',
    '🔍': 'search',
    '🛠️': 'build',
    '🛡️': 'shield',
    '🚀': 'rocket_launch',
    '⚙️': 'settings',
    '✅': 'check_circle',
    '🔁': 'sync',
    '📢': 'campaign',
    '🚨': 'error',
    '✔️': 'check',
    '🧪': 'science',
    '📝': 'description',
    '🔀': 'alt_route',
    '📦': 'inventory_2',
    '↩️': 'undo',
    '🟡': 'info',
    '🚫': 'block',
  };
  return map[icon] || 'circle';
}

export const IncidentExecutionTrail: React.FC<IncidentExecutionTrailProps> = ({ selectedIncident }) => {
  const timeline: IncidentTimelineEvent[] = selectedIncident.timeline || [];

  return (
    <div className="lg:col-span-4 space-y-space-lg">
      <section className="rounded-xl bg-white border border-[#E5DED6] shadow-card overflow-hidden flex flex-col">
        <div className="p-space-md bg-[#F2EDE6]/80 border-b border-[#E5DED6] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#D97757] text-lg">timeline</span>
            <span className="font-headline-sm font-semibold text-[#2D2926]">Execution Trail</span>
          </div>
          <span className="font-label-code-sm text-xs text-[#99462A] bg-[#F9ECE7] border border-[#D97757]/30 px-2 py-0.5 rounded font-semibold">
            {timeline.length > 0 ? `${timeline.length} events` : 'Live Loop'}
          </span>
        </div>

        <div className="p-space-md overflow-y-auto max-h-[500px]">
          {timeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
              <span className="material-symbols-outlined text-3xl text-[#D97757] opacity-50">timeline</span>
              <p className="text-xs text-[#6B625B]">
                No execution events yet. Trigger remediation to begin the autonomous loop.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-5">
              {/* Vertical connecting line */}
              <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-[#E5DED6]"></div>

              {timeline.map((event, idx) => {
                const stepStyle = getStepIcon(event);
                const iconName = event.icon ? getIconLabel(event.icon) : stepStyle.icon;
                const isError = (event.status || '').toLowerCase() === 'error' ||
                                (event.status || '').toLowerCase() === 'failed';
                const isLast = idx === timeline.length - 1;
                return (
                  <div key={idx} className="relative flex items-start gap-3">
                    <div
                      className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center border ${stepStyle.bg} ${isLast ? 'animate-pulse' : ''}`}
                    >
                      <span className="material-symbols-outlined text-xs">{iconName}</span>
                    </div>
                    <div className="text-xs">
                      <div className="flex items-center gap-1 text-[#6B625B]">
                        {event.time && (
                          <span className="font-mono">{event.time}</span>
                        )}
                        {event.time && <span>·</span>}
                        <span className={`font-semibold ${isError ? 'text-[#C34A4A]' : 'text-[#2D2926]'}`}>
                          {event.title}
                        </span>
                      </div>
                      {event.description && (
                        <p className="text-[#6B625B] mt-0.5 leading-relaxed">{event.description}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Incident Metadata Card */}
      <section className="rounded-xl bg-white border border-[#E5DED6] p-space-md shadow-card space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#6B625B]">
          <span className="material-symbols-outlined text-[#D97757] text-base">info</span>
          <span>INCIDENT DETAILS</span>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="p-2 rounded bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between">
            <span className="text-[#6B625B]">Repository</span>
            <span className="text-[#2D2926] font-mono font-semibold">{selectedIncident.repo}</span>
          </div>
          <div className="p-2 rounded bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between">
            <span className="text-[#6B625B]">Pipeline</span>
            <span className="text-[#2D2926] font-mono font-semibold truncate max-w-[140px]">{selectedIncident.pipeline}</span>
          </div>
          {selectedIncident.branch && (
            <div className="p-2 rounded bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between">
              <span className="text-[#6B625B]">Branch</span>
              <span className="text-[#2D2926] font-mono font-semibold">{selectedIncident.branch}</span>
            </div>
          )}
          {selectedIncident.commit && (
            <div className="p-2 rounded bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between">
              <span className="text-[#6B625B]">Commit</span>
              <span className="text-[#99462A] font-mono font-semibold">{selectedIncident.commit}</span>
            </div>
          )}
          {selectedIncident.remediationBranch && (
            <div className="p-2 rounded bg-[#EAF3E7] border border-[#5B7C4B]/30 flex items-center justify-between">
              <span className="text-[#6B625B]">Fix Branch</span>
              <span className="text-[#5B7C4B] font-mono font-semibold truncate max-w-[140px]">{selectedIncident.remediationBranch}</span>
            </div>
          )}
          {selectedIncident.prNumber && (
            <div className="p-2 rounded bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between">
              <span className="text-[#6B625B]">Pull Request</span>
              {selectedIncident.prUrl || selectedIncident.prNumber ? (
                <a
                  href={
                    selectedIncident.prUrl
                      ? selectedIncident.prUrl.replace('https://github.com/testingrepo/', 'https://github.com/naveenkumar030/testingrepo/')
                      : `https://github.com/naveenkumar030/testingrepo/pull/${selectedIncident.prNumber}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#D97757] font-semibold hover:underline"
                >
                  #{selectedIncident.prNumber}
                </a>
              ) : (
                <span className="text-[#D97757] font-semibold">#{selectedIncident.prNumber}</span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Autonomous Remediation Attempts (Multi-Attempt History) */}
      {selectedIncident.attempts && selectedIncident.attempts.length > 0 && (
        <section className="rounded-xl bg-white border border-[#E5DED6] shadow-card overflow-hidden flex flex-col">
          <div className="p-space-md bg-[#F2EDE6]/80 border-b border-[#E5DED6] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#D97757] text-lg">autorenew</span>
              <span className="font-headline-sm font-semibold text-[#2D2926]">Remediation Attempts</span>
            </div>
            <span className="font-label-code-sm text-xs text-[#99462A] bg-[#F9ECE7] border border-[#D97757]/30 px-2 py-0.5 rounded font-semibold">
              {selectedIncident.attempts.length} / 3 Max
            </span>
          </div>
          <div className="p-space-md space-y-3">
            {selectedIncident.attempts.map((att: any, idx: number) => {
              const num = att.attempt_number || idx + 1;
              const status = att.validation_status || att.ci_validation?.status || 'UNKNOWN';
              const isPass = status === 'SUCCESS' || status === 'PASSED';
              const isUnverified = status === 'UNVERIFIED';
              const reason = att.validation_reason || att.ci_validation?.failure_reason || att.patch_summary;
              return (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border text-xs ${
                    isPass
                      ? 'bg-[#EAF3E7] border-[#5B7C4B]/40'
                      : isUnverified
                      ? 'bg-[#FFFBEB] border-[#F59E0B]/40'
                      : 'bg-[#FAF7F3] border-[#E5DED6]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[#2D2926]">Attempt #{num}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isPass
                          ? 'bg-[#5B7C4B] text-white'
                          : isUnverified
                          ? 'bg-[#F59E0B] text-white'
                          : 'bg-[#C34A4A] text-white'
                      }`}
                    >
                      {isPass ? 'CI PASSED' : isUnverified ? 'UNVERIFIED' : 'CI FAILED'}
                    </span>
                  </div>
                  {att.files_changed && att.files_changed.length > 0 && (
                    <div className="text-[11px] text-[#6B625B] font-mono">
                      Target: {att.files_changed.join(', ')}
                    </div>
                  )}
                  {reason && (
                    <div className="text-[11px] text-[#6B625B] mt-1 font-mono truncate" title={reason}>
                      Reason: {reason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
