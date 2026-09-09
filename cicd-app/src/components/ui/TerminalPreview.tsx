import { useState } from 'react';

interface TerminalLine {
  line?: string | number;
  time?: string;
  type?: 'info' | 'error' | 'warn' | 'agent' | 'success';
  text: string;
}

interface TerminalPreviewProps {
  title?: string;
  lines?: TerminalLine[];
  code?: string;
  statusText?: string;
  maxHeight?: string;
  className?: string;
}

export default function TerminalPreview({
  title = 'agent-remediation.log',
  lines,
  code,
  statusText,
  maxHeight = 'max-h-72',
  className = '',
}: TerminalPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    let contentToCopy = '';
    if (code) {
      contentToCopy = code;
    } else if (lines) {
      contentToCopy = lines.map(l => `${l.time ? l.time + ' ' : ''}${l.text}`).join('\n');
    }
    navigator.clipboard.writeText(contentToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTypeStyle = (type?: string) => {
    switch (type) {
      case 'error':
        return 'text-[#E06C75] font-semibold';
      case 'warn':
        return 'text-[#E5C07B]';
      case 'agent':
        return 'text-[#98C379] font-medium';
      case 'success':
        return 'text-[#98C379] font-semibold';
      default:
        return 'text-[#ABB2BF]';
    }
  };

  return (
    <div className={`rounded-xl overflow-hidden bg-[#1E1E1E] border border-[#333333] shadow-lg font-mono text-xs ${className}`}>
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#252526] border-b border-[#333333] select-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#FF5F56] inline-block" />
            <span className="w-3 h-3 rounded-full bg-[#FFBD2E] inline-block" />
            <span className="w-3 h-3 rounded-full bg-[#27C93F] inline-block" />
          </div>
          <span className="text-[#858585] text-[11px] ml-2 font-medium font-sans flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-[#858585]">terminal</span>
            {title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {statusText && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-[#333333] text-[#98C379] font-sans">
              {statusText}
            </span>
          )}
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-[#383838] text-[#858585] hover:text-[#D4D4D4] transition-colors"
            title="Copy content"
          >
            <span className="material-symbols-outlined text-sm">
              {copied ? 'check' : 'content_copy'}
            </span>
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div className={`p-3 overflow-y-auto font-mono text-[11px] leading-5 text-[#D4D4D4] ${maxHeight}`}>
        {code ? (
          <pre className="whitespace-pre overflow-x-auto font-mono">
            <code>{code}</code>
          </pre>
        ) : lines && lines.length > 0 ? (
          <div className="space-y-0.5">
            {lines.map((l, i) => (
              <div key={i} className="flex items-start gap-2 hover:bg-white/[0.03] px-1 rounded">
                {l.line !== undefined && (
                  <span className="text-[#5C6370] select-none min-w-[20px] text-right font-label-code-sm">
                    {l.line}
                  </span>
                )}
                {l.time && (
                  <span className="text-[#5C6370] select-none text-[10px]">
                    {l.time}
                  </span>
                )}
                <span className={`flex-1 break-all ${getTypeStyle(l.type)}`}>
                  {l.text}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[#5C6370] italic">No output stream active</div>
        )}
      </div>
    </div>
  );
}
