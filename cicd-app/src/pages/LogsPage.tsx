import { useState, useEffect, useCallback, useRef } from 'react';
import { logEntries as initialLogs } from '../data/mockData';
import { api } from '../services/api';
import type { LogEntry, LogLevel } from '../types';

export default function LogsPage() {
  const [logsList, setLogsList] = useState<LogEntry[]>(initialLogs);
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLive, setIsLive] = useState(true);
  const [sseActive, setSseActive] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<number>(3000);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportScope, setExportScope] = useState<'filtered' | 'all'>('filtered');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const filteredLogs = logsList.filter((log) => {
    if (selectedService !== 'all' && log.service !== selectedService) return false;
    if (selectedLevel !== 'ALL' && log.level !== selectedLevel) return false;
    if (
      searchQuery &&
      !(log.message || '').toLowerCase().includes(searchQuery.toLowerCase()) &&
      !(log.service || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    return true;
  });

  const getTargetLogs = () => (exportScope === 'filtered' ? filteredLogs : logsList);

  const handleCopyLogs = (asJson = false) => {
    const logs = getTargetLogs();
    if (logs.length === 0) {
      showToast('No logs available to copy');
      return;
    }

    let text: string;
    if (asJson) {
      text = JSON.stringify(logs, null, 2);
    } else {
      text = logs
        .map((l) => `[${l.timestamp}] [${l.level}] [${l.service}]${l.traceId ? ` [trace:${l.traceId}]` : ''}: ${l.message}`)
        .join('\n');
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast(`✓ Copied ${logs.length} logs (${asJson ? 'JSON' : 'Plaintext'}) to clipboard!`);
    setTimeout(() => setCopied(false), 2000);
    setShowExportMenu(false);
  };

  const handleDownloadLogs = (format: 'log' | 'json' | 'csv') => {
    const logs = getTargetLogs();
    if (logs.length === 0) {
      showToast('No logs available to export');
      return;
    }

    let content: string;
    let mimeType: string;
    let extension: string;

    if (format === 'json') {
      content = JSON.stringify(logs, null, 2);
      mimeType = 'application/json';
      extension = 'json';
    } else if (format === 'csv') {
      const headers = ['Timestamp', 'Level', 'Service', 'Message', 'TraceId'];
      const rows = logs.map((l) => [
        `"${l.timestamp || ''}"`,
        `"${l.level || ''}"`,
        `"${l.service || ''}"`,
        `"${(l.message || '').replace(/"/g, '""')}"`,
        `"${l.traceId || ''}"`,
      ]);
      content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      mimeType = 'text/csv';
      extension = 'csv';
    } else {
      const headerMeta = `# SentinelOps Log Export\n# Exported: ${new Date().toISOString()}\n# Total Records: ${logs.length}\n# Scope: ${exportScope}\n\n`;
      content = headerMeta + logs
        .map((l) => `[${l.timestamp}] [${l.level}] [${l.service}]${l.traceId ? ` [trace:${l.traceId}]` : ''}: ${l.message}`)
        .join('\n');
      mimeType = 'text/plain';
      extension = 'log';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sentinelops-logs-${exportScope}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
    showToast(`✓ Downloaded ${logs.length} logs as .${extension}!`);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchLogs();
    showToast('✓ Logs refreshed from backend');
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const fetchLogs = useCallback(async () => {
    try {
      const data = await api.getLogs({
        service: selectedService,
        level: selectedLevel,
        query: searchQuery,
      });
      if (data) {
        setLogsList(data);
      }
    } catch (err) {
      console.warn('Failed to fetch logs:', err);
    }
  }, [selectedService, selectedLevel, searchQuery]);

  // Initial load
  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      if (isMounted) {
        await fetchLogs();
      }
    };
    void run();
    return () => {
      isMounted = false;
    };
  }, [fetchLogs]);

  // Server-Sent Events (SSE) stream for sub-second log delivery
  useEffect(() => {
    if (!isLive) {
      return;
    }

    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/logs/stream');

      es.addEventListener('log', (e: MessageEvent) => {
        try {
          const newEntry = JSON.parse(e.data) as LogEntry;
          setLogsList((prev) => {
            if (prev.some((l) => l.id === newEntry.id)) return prev;
            return [newEntry, ...prev];
          });
        } catch (err) {
          console.error('Failed to parse incoming log stream event:', err);
        }
      });

      es.onopen = () => setSseActive(true);
      es.onerror = () => {
        setSseActive(false);
        es?.close();
      };
    } catch {
      // Stream failed to initialize
    }

    // Fallback polling if SSE is disconnected
    const interval = setInterval(() => {
      if (!sseActive) {
        fetchLogs();
      }
    }, pollingInterval);

    return () => {
      es?.close();
      clearInterval(interval);
      setSseActive(false);
    };
  }, [isLive, sseActive, pollingInterval, fetchLogs]);

  // Terminal auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);




  return (
    <div className="space-y-space-lg">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-space-sm">
        <div>
          <div className="flex items-center gap-space-xs text-[#6B625B] font-label-code-sm text-xs">
            <span>Control Center</span>
            <span>/</span>
            <span className="text-[#99462A] font-semibold">Observability</span>
          </div>
          <h1 className="font-headline-lg text-xl sm:text-2xl font-bold text-[#2D2926] tracking-tight mt-1">
            Real-Time Logs &amp; Trace Observability
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Live Polling & Stream Cluster */}
          <div className="flex items-center bg-white border border-[#E5DED6] rounded-lg p-0.5 shadow-xs">
            {/* Live Toggle */}
            <button
              onClick={() => setIsLive(!isLive)}
              title={isLive ? 'Click to pause stream' : 'Click to resume live stream'}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isLive
                  ? 'bg-[#EBF3E8] text-[#2D5A27]'
                  : 'bg-[#FAF7F3] text-[#6B625B] hover:bg-[#F2EDE6]'
              }`}
            >
              <span className="relative flex h-2 w-2 shrink-0">
                {isLive && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5B7C4B] opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isLive ? 'bg-[#5B7C4B]' : 'bg-[#A89F99]'
                  }`}
                />
              </span>
              <span>{isLive ? (sseActive ? 'SSE Stream' : 'Live Polling') : 'Paused'}</span>
              <span className="material-symbols-outlined text-xs leading-none opacity-60">
                {isLive ? 'pause' : 'play_arrow'}
              </span>
            </button>

            {/* Polling Interval Selector */}
            <div className="h-4 w-px bg-[#E5DED6] mx-1" />
            <select
              value={pollingInterval}
              onChange={(e) => setPollingInterval(Number(e.target.value))}
              title="Polling / Refresh Cadence"
              aria-label="Polling interval"
              className="bg-transparent text-[11px] font-mono font-medium text-[#6B625B] px-1.5 py-1 rounded cursor-pointer focus:outline-none hover:text-[#2D2926]"
            >
              <option value={1000}>1s (Turbo)</option>
              <option value={3000}>3s (Normal)</option>
              <option value={5000}>5s (Eco)</option>
              <option value={10000}>10s (Slow)</option>
            </select>

            {/* Manual Refresh Button */}
            <div className="h-4 w-px bg-[#E5DED6] mx-1" />
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Manual Fetch: Fetch latest logs from backend now"
              className="p-1 rounded text-[#6B625B] hover:text-[#D97757] hover:bg-[#FAF7F3] transition-colors cursor-pointer disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-sm block ${isRefreshing ? 'animate-spin text-[#D97757]' : ''}`}>
                refresh
              </span>
            </button>
          </div>

          {/* Export Dropdown with Rich Options */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="px-3 py-1.5 rounded-lg bg-white border border-[#E5DED6] hover:bg-[#FAF7F3] hover:border-[#D97757]/40 text-xs font-semibold text-[#2D2926] flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-[#D97757]">
                {copied ? 'check' : 'ios_share'}
              </span>
              <span>{copied ? 'Copied!' : 'Export'}</span>
              <span className="material-symbols-outlined text-xs text-[#6B625B]">expand_more</span>
            </button>

            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white border border-[#E5DED6] shadow-xl py-2 z-40 animate-in fade-in zoom-in-95 duration-100">
                  {/* Scope Selector */}
                  <div className="px-3 pb-2 border-b border-[#E5DED6]">
                    <div className="text-[10px] font-semibold text-[#8F857D] uppercase tracking-wider mb-1.5">
                      Export Target
                    </div>
                    <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
                      <button
                        onClick={() => setExportScope('filtered')}
                        className={`px-2 py-1 text-[11px] font-medium rounded transition-all cursor-pointer ${
                          exportScope === 'filtered'
                            ? 'bg-white text-[#2D2926] shadow-xs font-semibold'
                            : 'text-[#6B625B] hover:text-[#2D2926]'
                        }`}
                      >
                        Filtered ({filteredLogs.length})
                      </button>
                      <button
                        onClick={() => setExportScope('all')}
                        className={`px-2 py-1 text-[11px] font-medium rounded transition-all cursor-pointer ${
                          exportScope === 'all'
                            ? 'bg-white text-[#2D2926] shadow-xs font-semibold'
                            : 'text-[#6B625B] hover:text-[#2D2926]'
                        }`}
                      >
                        All ({logsList.length})
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-1">
                    <button
                      onClick={() => handleCopyLogs(false)}
                      className="w-full text-left px-3 py-1.5 text-xs font-medium text-[#2D2926] hover:bg-[#FAF7F3] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-base text-[#D97757]">content_copy</span>
                      <div className="flex-1">
                        <div>Copy Plaintext</div>
                        <div className="text-[10px] text-[#8F857D]">System log line format</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleCopyLogs(true)}
                      className="w-full text-left px-3 py-1.5 text-xs font-medium text-[#2D2926] hover:bg-[#FAF7F3] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-base text-[#D97757]">data_object</span>
                      <div className="flex-1">
                        <div>Copy JSON</div>
                        <div className="text-[10px] text-[#8F857D]">Structured array</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleDownloadLogs('log')}
                      className="w-full text-left px-3 py-1.5 text-xs font-medium text-[#2D2926] hover:bg-[#FAF7F3] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-base text-[#5B7C4B]">description</span>
                      <div className="flex-1">
                        <div>Download .log File</div>
                        <div className="text-[10px] text-[#8F857D]">Standard UNIX log format</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleDownloadLogs('csv')}
                      className="w-full text-left px-3 py-1.5 text-xs font-medium text-[#2D2926] hover:bg-[#FAF7F3] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-base text-[#B87A36]">table_view</span>
                      <div className="flex-1">
                        <div>Download CSV (.csv)</div>
                        <div className="text-[10px] text-[#8F857D]">For Excel &amp; data analysis</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleDownloadLogs('json')}
                      className="w-full text-left px-3 py-1.5 text-xs font-medium text-[#2D2926] hover:bg-[#FAF7F3] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-base text-[#4A7299]">download</span>
                      <div className="flex-1">
                        <div>Download JSON (.json)</div>
                        <div className="text-[10px] text-[#8F857D]">Full structured telemetry</div>
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Global Toast Feedback */}
        {toastMsg && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2D2926] text-white text-xs shadow-2xl border border-[#D97757]/40 animate-in fade-in slide-in-from-bottom-2">
            <span className="material-symbols-outlined text-[#5B7C4B] text-base">check_circle</span>
            <span>{toastMsg}</span>
          </div>
        )}
      </div>

      {/* Filter and Control Bar */}
      <div className="p-3 rounded-xl bg-[#F2EDE6] border border-[#E5DED6] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Level Filter Tabs */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#E5DED6] overflow-x-auto max-w-full">
            {(['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setSelectedLevel(lvl)}
                className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${
                  selectedLevel === lvl
                    ? 'bg-[#D97757] text-white shadow-xs'
                    : 'text-[#6B625B] hover:text-[#2D2926]'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Service Dropdown */}
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            aria-label="Filter logs by service"
            className="h-8 px-2.5 rounded-lg bg-white border border-[#E5DED6] text-xs font-semibold text-[#2D2926] focus:outline-none focus:border-[#D97757]"
          >
            <option value="all">All Repositories & Services</option>
            <option value="naveenkumar030/testingrepo">naveenkumar030/testingrepo (Primary)</option>
            <option value="naveenkumar030/SentinelOps">naveenkumar030/SentinelOps</option>
            <option value="ai-kernel">ai-kernel</option>
            <option value="healer-alpha">healer-alpha</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <span className="material-symbols-outlined absolute left-2.5 top-2 text-[#6B625B] text-base">
            search
          </span>
          <input
            type="text"
            placeholder="Search regex / keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-white border border-[#E5DED6] text-xs placeholder:text-[#6B625B] focus:outline-none focus:border-[#D97757]"
          />
        </div>
      </div>

      {/* 2-Column Split Console + Anomaly Correlation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* Terminal Console (8 cols) */}
        <div className="lg:col-span-8 rounded-2xl bg-white border border-[#E5DED6] shadow-card overflow-hidden flex flex-col">
          {/* Terminal Title Bar */}
          <div className="px-4 py-2.5 bg-[#F2EDE6] border-b border-[#E5DED6] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#C34A4A]"></span>
              <span className="h-2.5 w-2.5 rounded-full bg-[#B87A36]"></span>
              <span className="h-2.5 w-2.5 rounded-full bg-[#5B7C4B]"></span>
              <span className="font-mono text-xs font-bold text-[#2D2926] ml-2">
                stdout.stream.session // {selectedService}
              </span>
            </div>

            <div className="flex items-center gap-3 font-mono text-xs text-[#6B625B]">
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                title={autoScroll ? 'Disable Auto-scroll' : 'Enable Auto-scroll to bottom'}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  autoScroll
                    ? 'bg-[#EBF3E8] text-[#2D5A27] border border-[#5B7C4B]/30'
                    : 'bg-white text-[#6B625B] border border-[#E5DED6]'
                }`}
              >
                <span className="material-symbols-outlined text-xs">
                  {autoScroll ? 'vertical_align_bottom' : 'pause_circle'}
                </span>
                <span>Scroll: {autoScroll ? 'ON' : 'OFF'}</span>
              </button>
              <span>Lines: <strong className="text-[#2D2926]">{filteredLogs.length}</strong></span>
            </div>
          </div>

          {/* Log Stream Body */}
          <div
            ref={logContainerRef}
            className="p-4 bg-[#201B18] font-mono text-xs space-y-1.5 min-h-[480px] max-h-[640px] overflow-y-auto scroll-smooth"
          >
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center text-[#8F857D] space-y-3">
                <span className="material-symbols-outlined text-4xl text-[#3E3835]">terminal</span>
                <p className="text-[#EDE7E3] font-semibold text-sm">No Log Entries Recorded</p>
                <p className="text-xs text-[#8F857D] max-w-sm">
                  {isLive
                    ? 'Listening for incoming operational telemetry events and SSE log stream...'
                    : 'Log stream is paused. Resume live stream or trigger a pipeline run to stream telemetry.'}
                </p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isError = log.level === 'ERROR';
                const isWarn = log.level === 'WARN';
                const isDebug = log.level === 'DEBUG' || log.level === 'TRACE';

                return (
                  <div
                    key={log.id}
                    className={`flex items-start gap-3 p-1.5 rounded transition-colors ${
                      isError
                        ? 'bg-[#ba1a1a]/20 border border-[#ba1a1a]/40 text-[#fca5a5]'
                        : isWarn
                        ? 'bg-[#B87A36]/15 border border-[#B87A36]/30 text-[#fde047]'
                        : isDebug
                        ? 'text-[#8F857D]'
                        : 'text-[#EDE7E3]'
                    }`}
                  >
                    <span className="text-[#8F857D] select-none shrink-0 w-20">{log.timestamp}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        isError
                          ? 'bg-[#ba1a1a] text-white'
                          : isWarn
                          ? 'bg-[#B87A36] text-white'
                          : isDebug
                          ? 'bg-[#3E3835] text-[#D1C7BD]'
                          : 'bg-[#D97757] text-white'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span className="text-[#D97757] shrink-0 font-medium">[{log.service}]</span>
                    <span className="break-all">{log.message}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Observability & Anomaly Panel (4 cols) */}
        <div className="lg:col-span-4 space-y-space-md">
          <div className="rounded-2xl bg-white border border-[#E5DED6] p-space-md shadow-card space-y-3">
            <div className="flex items-center justify-between border-b border-[#E5DED6] pb-2">
              <h3 className="font-headline-sm font-bold text-sm text-[#2D2926]">Anomaly Fingerprint</h3>
              <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                filteredLogs.some(l => l.level === 'ERROR') ? 'bg-[#F9ECE7] text-[#99462A]' : 'bg-[#F2EDE6] text-[#6B625B]'
              }`}>
                {filteredLogs.some(l => l.level === 'ERROR') ? 'ACTIVE_CLUSTER' : 'ALL_CLEAR'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {filteredLogs.some(l => l.level === 'ERROR') ? (
                <>
                  <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-1">
                    <span className="text-[#8F857D] uppercase text-[10px] font-bold block">Fingerprint Hash</span>
                    <span className="font-mono font-bold text-[#2D2926]">HASH_LIVE_STREAM</span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-1">
                    <span className="text-[#8F857D] uppercase text-[10px] font-bold block">Correlated Exception</span>
                    <p className="text-[#2D2926] line-clamp-2">{filteredLogs.find(l => l.level === 'ERROR')?.message}</p>
                  </div>
                </>
              ) : (
                <div className="p-4 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] text-center space-y-1 text-[#6B625B]">
                  <span className="material-symbols-outlined text-2xl text-[#5B7C4B]">check_circle</span>
                  <p className="font-semibold text-xs text-[#2D2926]">Zero Active Anomalies</p>
                  <p className="text-[11px] text-[#6B625B]">Cluster signatures nominal. No error patterns detected.</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-[#E5DED6] p-space-md shadow-card space-y-3">
            <h3 className="font-headline-sm font-bold text-sm text-[#2D2926] border-b border-[#E5DED6] pb-2">
              Trace Propagation
            </h3>
            {filteredLogs.length === 0 ? (
              <div className="p-4 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] text-center text-[#6B625B] text-xs">
                <p className="font-semibold text-[#2D2926]">No Active Spans</p>
                <p className="text-[11px] text-[#6B625B] mt-1">Distributed trace context is waiting for requests.</p>
              </div>
            ) : (
              <div className="space-y-2 font-mono text-xs">
                {Array.from(new Set(filteredLogs.map(l => l.service))).slice(0, 3).map((svc) => (
                  <div key={svc} className="p-2.5 rounded bg-[#FAF7F3] border border-[#E5DED6] flex justify-between">
                    <span className="text-[#2D2926]">span-{svc}</span>
                    <span className="text-[#D97757] font-bold">{filteredLogs.filter(l => l.service === svc).length} events</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
