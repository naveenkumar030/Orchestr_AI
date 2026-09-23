import { useState, useEffect, useCallback } from 'react';
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
    }, 3000);

    return () => {
      es?.close();
      clearInterval(interval);
      setSseActive(false);
    };
  }, [isLive, sseActive, fetchLogs]);

  const filteredLogs = logsList.filter((log) => {
    if (selectedService !== 'all' && log.service !== selectedService) return false;
    if (selectedLevel !== 'ALL' && log.level !== selectedLevel) return false;
    if (
      searchQuery &&
      !log.message.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !log.service.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    return true;
  });


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

        <div className="flex flex-wrap items-center gap-2 sm:gap-space-sm">
          <button
            onClick={() => setIsLive(!isLive)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
              isLive
                ? 'bg-[#F9ECE7] border-[#D97757]/30 text-[#99462A]'
                : 'bg-white border-[#E5DED6] text-[#6B625B]'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isLive ? (sseActive ? 'bg-[#5B7C4B] animate-pulse' : 'bg-[#D97757] animate-pulse') : 'bg-gray-400'
              }`}
            ></span>
            <span>
              {isLive ? (sseActive ? '⚡ SSE Stream Active' : 'Live Polling') : 'Paused'}
            </span>
          </button>

          <button
            onClick={() => {
              navigator.clipboard.writeText(filteredLogs.map(l => `[${l.timestamp}] [${l.level}] [${l.service}]: ${l.message}`).join('\n'));
              alert('Copied all visible logs to clipboard!');
            }}
            className="px-3 py-1.5 rounded-lg bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] text-xs font-semibold text-[#2D2926] flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">content_copy</span>
            <span>Export</span>
          </button>
        </div>
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
            <option value="all">All Services (6)</option>
            <option value="payment-service">payment-service</option>
            <option value="auth-service">auth-service</option>
            <option value="ai-kernel">ai-kernel</option>
            <option value="resolver-beta">resolver-beta</option>
            <option value="order-orchestrator">order-orchestrator</option>
            <option value="inventory-api">inventory-api</option>
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
              <span>48.2 KB/s</span>
              <span>Lines: <strong className="text-[#2D2926]">{filteredLogs.length}</strong></span>
            </div>
          </div>

          {/* Log Stream Body */}
          <div className="p-4 bg-[#201B18] font-mono text-xs space-y-1.5 min-h-[480px] max-h-[640px] overflow-y-auto">
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
