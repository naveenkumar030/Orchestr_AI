import React, { useState } from 'react';
import type { Incident } from '../../types';

interface IncidentTerminalCardProps {
  selectedIncident: Incident;
}

export const IncidentTerminalCard: React.FC<IncidentTerminalCardProps> = ({ selectedIncident }) => {
  const [logFilter, setLogFilter] = useState('');
  const [copied, setCopied] = useState(false);

  const rawLogs = selectedIncident.failure
    ? [
        { line: '01', time: '[LIVE]', type: 'error', text: `${selectedIncident.failure}: ${selectedIncident.rootCause || 'Workflow failure detected'}` },
        { line: '02', time: '[AGENT]', type: 'info', text: `Repository: ${selectedIncident.repo} on branch '${selectedIncident.branch || 'main'}'` },
        { line: '03', time: '[AGENT]', type: 'agent', text: `Confidence score: ${selectedIncident.confidence}% (${selectedIncident.status})` },
      ]
    : [];

  const filteredLogs = rawLogs.filter((l) =>
    l.text.toLowerCase().includes(logFilter.toLowerCase())
  );

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(rawLogs.map((l) => `${l.time} ${l.text}`).join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="rounded-xl bg-white border border-[#E5DED6] shadow-card overflow-hidden flex flex-col">
      <div className="px-space-md py-2.5 bg-[#F2EDE6] border-b border-[#E5DED6] flex items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-md">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#C34A4A]/50"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#B87A36]/50"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#5B7C4B]/50"></div>
          </div>
          <div className="flex items-center gap-1 text-[#6B625B] font-mono text-xs">
            <span className="material-symbols-outlined text-sm">terminal</span>
            <span>build-ci.us-east-1.internal // stdout</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter logs (e.g. ERESOLVE)..."
            value={logFilter}
            onChange={(e) => setLogFilter(e.target.value)}
            className="h-7 px-2.5 rounded bg-white border border-[#E5DED6] text-xs font-mono placeholder:text-[#6B625B] focus:outline-none focus:border-[#D97757]"
          />
          <button
            onClick={handleCopyLogs}
            title="Copy Raw Logs"
            className="p-1 rounded hover:bg-white text-[#6B625B] hover:text-[#2D2926] transition-colors"
          >
            <span className="material-symbols-outlined text-sm">
              {copied ? 'check' : 'content_copy'}
            </span>
          </button>
        </div>
      </div>

      <div className="p-space-md bg-[#201B18] font-mono text-xs max-h-72 overflow-y-auto space-y-1.5">
        {filteredLogs.map((log) => (
          <div
            key={log.line}
            className={`flex items-start gap-2.5 px-2 py-1 rounded ${
              log.type === 'error'
                ? 'bg-[#ba1a1a]/20 text-[#fca5a5] border-l-2 border-[#ba1a1a]'
                : log.type === 'agent'
                ? 'bg-[#D97757]/20 text-[#fed7aa] border-l-2 border-[#D97757]'
                : 'text-[#D1C7BD]'
            }`}
          >
            <span className="text-[#8F857D] select-none">{log.line}</span>
            <span className="text-[#D97757]">{log.time}</span>
            <span>{log.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
};
