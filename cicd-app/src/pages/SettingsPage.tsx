import { useState, useEffect } from 'react';
import { api, type SettingsData, type HealthResponse } from '../services/api';
import { useBackend } from '../context/BackendContext';

interface EndpointStatus {
  path: string;
  name: string;
  status: 'idle' | 'testing' | 'success' | 'failed';
  code?: number;
  latency?: number;
}

export default function SettingsPage() {
  const { isConnected, latency: currentLatency, health, recheck } = useBackend();

  const [confidenceThreshold, setConfidenceThreshold] = useState(95);
  const [autoMergeActive, setAutoMergeActive] = useState(true);
  const [ciSuccessRequired, setCiSuccessRequired] = useState(true);
  const [zeroCveRequired, setZeroCveRequired] = useState(true);
  const [humanApprovalRequired, setHumanApprovalRequired] = useState(false);
  const [killSwitchEngaged, setKillSwitchEngaged] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Diagnostics State
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ success: boolean; latency: number; data?: HealthResponse } | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointStatus[]>([
    { path: '/health', name: 'Health & System', status: 'idle' },
    { path: '/overview', name: 'Dashboard Overview', status: 'idle' },
    { path: '/pipelines', name: 'DAG Pipelines', status: 'idle' },
    { path: '/incidents', name: 'Incident Stream', status: 'idle' },
    { path: '/ai-agents', name: 'AI Fleet Nodes', status: 'idle' },
    { path: '/pull-requests', name: 'PR Auto-Review', status: 'idle' },
    { path: '/logs', name: 'Observability Logs', status: 'idle' },
    { path: '/analytics', name: 'MTTR Analytics', status: 'idle' },
  ]);
  const [isTestingAll, setIsTestingAll] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.getSettings().then((settings: SettingsData) => {
      if (!mounted) return;
      if (settings.confidenceThreshold !== undefined) setConfidenceThreshold(Number(settings.confidenceThreshold));
      if (settings.autoMergeActive !== undefined) setAutoMergeActive(Boolean(settings.autoMergeActive));
      if (settings.ciSuccessRequired !== undefined) setCiSuccessRequired(Boolean(settings.ciSuccessRequired));
      if (settings.zeroCveRequired !== undefined) setZeroCveRequired(Boolean(settings.zeroCveRequired));
      if (settings.humanApprovalRequired !== undefined) setHumanApprovalRequired(Boolean(settings.humanApprovalRequired));
      if (settings.killSwitchEngaged !== undefined) setKillSwitchEngaged(Boolean(settings.killSwitchEngaged));
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.saveSettings({
        confidenceThreshold,
        autoMergeActive,
        ciSuccessRequired,
        zeroCveRequired,
        humanApprovalRequired,
        killSwitchEngaged,
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3500);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKillSwitch = async () => {
    const newState = !killSwitchEngaged;
    setKillSwitchEngaged(newState);
    await api.saveSettings({ killSwitchEngaged: newState });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3500);
  };

  const handlePingBackend = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      const res = await api.checkHealth();
      const lat = Math.round(performance.now() - start);
      setPingResult({
        success: res.isConnected,
        latency: lat,
        data: res.health,
      });
      await recheck();
    } catch {
      setPingResult({
        success: false,
        latency: Math.round(performance.now() - start),
      });
    } finally {
      setIsPinging(false);
    }
  };

  const testAllEndpoints = async () => {
    setIsTestingAll(true);
    const updated = [...endpoints];

    for (let i = 0; i < updated.length; i++) {
      const ep = updated[i];
      ep.status = 'testing';
      setEndpoints([...updated]);

      const start = performance.now();
      try {
        const res = await fetch(`/api${ep.path}`);
        const lat = Math.round(performance.now() - start);
        ep.status = res.ok ? 'success' : 'failed';
        ep.code = res.status;
        ep.latency = lat;
      } catch {
        ep.status = 'failed';
        ep.code = 0;
        ep.latency = Math.round(performance.now() - start);
      }
      setEndpoints([...updated]);
    }
    setIsTestingAll(false);
  };

  return (
    <div className="space-y-space-lg">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
        <div>
          <div className="flex items-center gap-space-xs text-[#6B625B] font-label-code-sm text-xs">
            <span>Control Center</span>
            <span>/</span>
            <span className="text-[#99462A] font-semibold">Governance &amp; Autopilot</span>
          </div>
          <h1 className="font-headline-lg text-2xl font-bold text-[#2D2926] tracking-tight mt-1">
            AI Autopilot Policies &amp; Governance
          </h1>
        </div>

        <div className="flex items-center gap-space-sm">
          <button
            disabled={isSaving}
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-[#D97757] hover:bg-[#B85D3E] text-white font-medium text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-sm ${isSaving ? 'animate-spin' : ''}`}>
              {isSaving ? 'sync' : 'save'}
            </span>
            <span>{isSaving ? 'Saving to Flask...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {savedNotice && (
        <div className="p-3 rounded-lg bg-[#EAF3E7] border border-[#5B7C4B]/40 text-[#5B7C4B] text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-base">check_circle</span>
          Policy configuration updated across all clusters and persisted to Python backend.
        </div>
      )}

      {/* ── Python Backend Diagnostics Hub ────────────────────────────────── */}
      <section className="rounded-2xl bg-white border border-[#E5DED6] p-space-lg shadow-card space-y-space-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5DED6] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#F9ECE7] border border-[#D97757]/40 flex items-center justify-center text-[#D97757]">
              <span className="material-symbols-outlined text-lg">terminal</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-headline-sm text-base font-bold text-[#2D2926]">
                  Python Backend Diagnostics &amp; Telemetry
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono border ${
                    isConnected
                      ? 'bg-[#EAF3E7] border-[#5B7C4B]/30 text-[#5B7C4B]'
                      : 'bg-[#FAF7F3] border-[#E5DED6] text-[#6B625B]'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isConnected ? 'bg-[#5B7C4B] animate-pulse' : 'bg-[#A89F99]'
                    }`}
                  />
                  {isConnected ? 'ONLINE (:5000)' : 'LOCAL CACHE MODE'}
                </span>
              </div>
              <p className="text-xs text-[#6B625B]">
                Python Flask server hosting REST endpoints and enterprise operational data store
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePingBackend}
              disabled={isPinging}
              className="px-3.5 py-1.5 rounded-lg bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] text-xs font-semibold text-[#2D2926] shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-xs text-[#D97757] ${isPinging ? 'animate-spin' : ''}`}>
                network_ping
              </span>
              <span>{isPinging ? 'Pinging...' : 'Ping Backend'}</span>
            </button>
            <button
              onClick={testAllEndpoints}
              disabled={isTestingAll}
              className="px-3.5 py-1.5 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] hover:bg-[#F2EDE6] text-xs font-semibold text-[#2D2926] shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-xs text-[#D97757]">checklist</span>
              <span>{isTestingAll ? 'Testing Routes...' : 'Test All Routes'}</span>
            </button>
          </div>
        </div>

        {/* Runtime Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-space-sm text-xs">
          <div className="p-3 rounded-xl bg-[#FAF7F3] border border-[#E5DED6]">
            <span className="text-[10px] text-[#8F857D] uppercase font-semibold block">Framework</span>
            <span className="font-bold text-[#2D2926]">Flask {health?.version || '3.1.1'}</span>
          </div>

          <div className="p-3 rounded-xl bg-[#FAF7F3] border border-[#E5DED6]">
            <span className="text-[10px] text-[#8F857D] uppercase font-semibold block">Python Runtime</span>
            <span className="font-bold text-[#2D2926]">Python {health?.pythonVersion || '3.13.2'}</span>
          </div>

          <div className="p-3 rounded-xl bg-[#FAF7F3] border border-[#E5DED6]">
            <span className="text-[10px] text-[#8F857D] uppercase font-semibold block">Kernel Engine</span>
            <span className="font-bold text-[#99462A] truncate block">{health?.aiKernel || 'v2.4 Autonomous'}</span>
          </div>

          <div className="p-3 rounded-xl bg-[#FAF7F3] border border-[#E5DED6]">
            <span className="text-[10px] text-[#8F857D] uppercase font-semibold block">Ping Latency</span>
            <span className="font-bold text-[#5B7C4B]">
              {currentLatency !== null ? `${currentLatency}ms` : '—'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#FAF7F3] border border-[#E5DED6]">
            <span className="text-[10px] text-[#8F857D] uppercase font-semibold block">Active Fleet</span>
            <span className="font-bold text-[#2D2926]">
              {health?.activeAgents ?? 6} nodes
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#FAF7F3] border border-[#E5DED6]">
            <span className="text-[10px] text-[#8F857D] uppercase font-semibold block">Server PID</span>
            <span className="font-mono font-bold text-[#2D2926]">
              {health?.pid ? `#${health.pid}` : 'Flask'}
            </span>
          </div>
        </div>

        {/* Live Ping Alert */}
        {pingResult && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
              pingResult.success
                ? 'bg-[#EAF3E7] border-[#5B7C4B]/40 text-[#2D2926]'
                : 'bg-[#FDF0F0] border-[#C34A4A]/40 text-[#C34A4A]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-[#5B7C4B]">
                {pingResult.success ? 'check_circle' : 'error'}
              </span>
              <span>
                {pingResult.success
                  ? `Ping successful! Response received in ${pingResult.latency}ms from Python Flask (:5000)`
                  : `Ping failed (${pingResult.latency}ms). Ensure Python Flask server is running via python run_backend.py`}
              </span>
            </div>
            {pingResult.data?.timestamp && (
              <span className="font-mono text-[11px] text-[#6B625B]">
                {pingResult.data.timestamp.substring(11, 19)}
              </span>
            )}
          </div>
        )}

        {/* Endpoints Status Grid */}
        <div className="space-y-2 pt-2 border-t border-[#E5DED6]">
          <span className="text-xs font-bold text-[#2D2926] block">REST API Endpoints Connectivity</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {endpoints.map((ep) => (
              <div
                key={ep.path}
                className="p-2.5 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-[#2D2926] text-[11px]">{ep.name}</div>
                  <div className="font-mono text-[10px] text-[#6B625B]">/api{ep.path}</div>
                </div>
                <div>
                  {ep.status === 'testing' && (
                    <span className="material-symbols-outlined text-sm text-[#D97757] animate-spin">sync</span>
                  )}
                  {ep.status === 'success' && (
                    <span className="px-1.5 py-0.5 rounded bg-[#EAF3E7] text-[#5B7C4B] font-mono text-[10px] font-bold">
                      200 ({ep.latency}ms)
                    </span>
                  )}
                  {ep.status === 'failed' && (
                    <span className="px-1.5 py-0.5 rounded bg-[#FDF0F0] text-[#C34A4A] font-mono text-[10px] font-bold">
                      {ep.code || 'ERR'}
                    </span>
                  )}
                  {ep.status === 'idle' && (
                    <span className="px-1.5 py-0.5 rounded bg-white border border-[#E5DED6] text-[#8F857D] font-mono text-[10px]">
                      READY
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Grid: Policies + Credentials */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* Left Column: Policies (8 cols) */}
        <div className="lg:col-span-8 space-y-space-lg">
          {/* Auto-Merge Guardrails Card */}
          <section className="rounded-2xl bg-white border border-[#E5DED6] shadow-card overflow-hidden">
            <div className="px-space-lg py-space-md border-b border-[#E5DED6] bg-[#FAF7F3] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D97757]">policy</span>
                <h2 className="font-headline-sm text-base font-bold text-[#2D2926]">
                  Auto-Merge Guardrails
                </h2>
              </div>

              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoMergeActive}
                  onChange={(e) => setAutoMergeActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#E5DED6] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#D97757]"></div>
              </label>
            </div>

            <div className="p-space-lg grid grid-cols-1 md:grid-cols-2 gap-space-xl">
              {/* Slider & Dial */}
              <div className="space-y-space-md">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="font-medium text-xs text-[#2D2926]">
                      Autopilot Confidence Threshold
                    </label>
                    <span className="font-mono text-xs font-bold text-[#99462A] bg-[#F9ECE7] border border-[#D97757]/30 px-2 py-0.5 rounded">
                      {confidenceThreshold}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                    className="w-full accent-[#D97757] h-1.5 bg-[#E5DED6] rounded-lg cursor-pointer"
                  />
                  <p className="text-xs text-[#6B625B] mt-2 leading-relaxed">
                    PRs synthesized by AI will only auto-merge if internal confidence scores exceed this threshold.
                  </p>
                </div>

                <div className="bg-[#FAF7F3] border border-[#E5DED6] p-space-md rounded-xl flex items-center gap-4">
                  <div className="relative w-16 h-16 shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-[#E5DED6]"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      />
                      <path
                        className="text-[#D97757]"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray={`${confidenceThreshold}, 100`}
                        strokeLinecap="round"
                        strokeWidth="3"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold text-[#2D2926]">
                      {confidenceThreshold}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#2D2926]">Safety Score Dial</div>
                    <div className="text-[11px] text-[#6B625B]">Posture: Strict &amp; Deterministic</div>
                  </div>
                </div>
              </div>

              {/* Mandatory Criteria */}
              <div>
                <h3 className="font-bold text-xs text-[#2D2926] mb-3">Mandatory Merge Criteria</h3>
                <ul className="space-y-3 text-xs">
                  <li className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={ciSuccessRequired}
                      onChange={(e) => setCiSuccessRequired(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[#D97757] cursor-pointer"
                    />
                    <div>
                      <div className="font-semibold text-[#2D2926]">100% CI Pipeline Success</div>
                      <div className="text-[#6B625B]">All unit, lint, and integration tests must pass.</div>
                    </div>
                  </li>

                  <li className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={zeroCveRequired}
                      onChange={(e) => setZeroCveRequired(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[#D97757] cursor-pointer"
                    />
                    <div>
                      <div className="font-semibold text-[#2D2926]">Zero High/Critical CVEs</div>
                      <div className="text-[#6B625B]">Trivy &amp; Snyk dependency scanning mandatory.</div>
                    </div>
                  </li>

                  <li className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={humanApprovalRequired}
                      onChange={(e) => setHumanApprovalRequired(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[#D97757] cursor-pointer"
                    />
                    <div>
                      <div className="font-semibold text-[#2D2926]">Human Code Owner Approval</div>
                      <div className="text-[#6B625B]">Requires signoff for core payment &amp; auth modules.</div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Fallback & Kill-Switch Section */}
          <section className="rounded-2xl bg-white border border-[#E5DED6] p-space-lg shadow-card space-y-3">
            <div className="flex items-center gap-2 border-b border-[#E5DED6] pb-2">
              <span className="material-symbols-outlined text-[#C34A4A]">warning</span>
              <h3 className="font-headline-sm text-sm font-bold text-[#2D2926]">Emergency Autopilot Kill-Switch</h3>
            </div>
            <p className="text-xs text-[#6B625B] leading-relaxed">
              In the event of anomalous fleet behavior, engaging this emergency kill-switch will immediately halt all autonomous PR generation, lock active git branches, and revert to purely manual SRE intervention.
            </p>
            <div className="pt-2">
              <button
                onClick={handleKillSwitch}
                className={`px-4 py-2 rounded-lg border font-bold text-xs transition-all shadow-xs cursor-pointer ${
                  killSwitchEngaged
                    ? 'bg-[#C34A4A] text-white border-[#C34A4A]'
                    : 'bg-[#FDF0F0] border-[#C34A4A]/40 text-[#C34A4A] hover:bg-[#C34A4A] hover:text-white'
                }`}
              >
                {killSwitchEngaged ? 'Disengage Emergency Kill-Switch (Engaged)' : 'Engage Emergency Kill-Switch'}
              </button>
            </div>
          </section>
        </div>

        {/* Right Column: Access Credentials & Quick Commands (4 cols) */}
        <div className="lg:col-span-4 space-y-space-md">
          {/* Quick Start Card */}
          <section className="rounded-2xl bg-white border border-[#E5DED6] p-space-md shadow-card space-y-3">
            <div className="flex items-center gap-2 border-b border-[#E5DED6] pb-2">
              <span className="material-symbols-outlined text-[#D97757]">play_circle</span>
              <h3 className="font-headline-sm font-bold text-sm text-[#2D2926]">Backend CLI Commands</h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-[#FAF7F3] border border-[#E5DED6]">
                <div className="text-[11px] text-[#6B625B] mb-1">Start Unified Server:</div>
                <code className="font-mono text-[11px] text-[#99462A] block bg-white p-1.5 rounded border border-[#E5DED6]">
                  python run_backend.py --open
                </code>
              </div>

              <div className="p-2.5 rounded-xl bg-[#FAF7F3] border border-[#E5DED6]">
                <div className="text-[11px] text-[#6B625B] mb-1">Windows One-Click Launcher:</div>
                <code className="font-mono text-[11px] text-[#99462A] block bg-white p-1.5 rounded border border-[#E5DED6]">
                  start_backend.bat
                </code>
              </div>

              <div className="p-2.5 rounded-xl bg-[#FAF7F3] border border-[#E5DED6]">
                <div className="text-[11px] text-[#6B625B] mb-1">Run Automated Test Suite:</div>
                <code className="font-mono text-[11px] text-[#99462A] block bg-white p-1.5 rounded border border-[#E5DED6]">
                  python backend/test_api.py
                </code>
              </div>
            </div>
          </section>

          {/* Access Credentials */}
          <section className="rounded-2xl bg-white border border-[#E5DED6] p-space-md shadow-card space-y-3">
            <div className="flex items-center gap-2 border-b border-[#E5DED6] pb-2">
              <span className="material-symbols-outlined text-[#D97757]">key</span>
              <h3 className="font-headline-sm font-bold text-sm text-[#2D2926]">Access Credentials</h3>
            </div>

            <div className="space-y-3 text-xs">
              {/* GitHub */}
              <div className="p-3 rounded-xl bg-[#FAF7F3] border border-[#E5DED6] space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-[#2D2926]">code</span>
                    <span className="font-bold text-[#2D2926]">GitHub App Token</span>
                  </div>
                  <span className="text-[#5B7C4B] font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">check_circle</span> Connected
                  </span>
                </div>
                <div className="font-mono text-[11px] text-[#6B625B] bg-white p-2 rounded border border-[#E5DED6] truncate">
                  ghp_984f1a287cba90123...
                </div>
              </div>

              {/* Kubernetes */}
              <div className="p-3 rounded-xl bg-[#FAF7F3] border border-[#E5DED6] space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-[#2D2926]">dns</span>
                    <span className="font-bold text-[#2D2926]">Production Cluster</span>
                  </div>
                  <span className="text-[#B87A36] font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">schedule</span> Rotates in 5d
                  </span>
                </div>
                <div className="font-mono text-[11px] text-[#6B625B] bg-white p-2 rounded border border-[#E5DED6] flex justify-between items-center">
                  <span>kubeconfig_prod_v2.yaml</span>
                  <span className="material-symbols-outlined text-xs text-[#D97757] cursor-pointer">download</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
