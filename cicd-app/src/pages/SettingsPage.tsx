import { useState, useEffect } from 'react';
import { api, type SettingsData, type HealthResponse, type GitHubStatusResponse } from '../services/api';
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

  // GitHub Integration & Webhook State
  const [gitHubStatus, setGitHubStatus] = useState<GitHubStatusResponse | null>(null);
  const [simulatingEvent, setSimulatingEvent] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSmeeUrl, setCopiedSmeeUrl] = useState(false);
  const [copiedNgrokUrl, setCopiedNgrokUrl] = useState(false);
  const [isTogglingRelay, setIsTogglingRelay] = useState(false);
  const [isTogglingNgrok, setIsTogglingNgrok] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);



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
    { path: '/github/status', name: 'GitHub Integration', status: 'idle' },
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

    api.getGitHubStatus().then((status) => {
      if (!mounted) return;
      setGitHubStatus(status);
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

  const handleTestWebhook = async (eventType: string) => {
    setSimulatingEvent(eventType);
    setSimulationResult(null);
    try {
      await api.sendTestWebhook(eventType);
      setSimulationResult({
        success: true,
        message: `Successfully simulated '${eventType}' event. Handled and recorded by Flask backend!`,
      });
      const updated = await api.getGitHubStatus();
      setGitHubStatus(updated);
    } catch (err) {
      setSimulationResult({
        success: false,
        message: `Failed to simulate '${eventType}': ${(err as Error).message}`,
      });
    } finally {
      setSimulatingEvent(null);
    }
  };

  const handleCopyWebhookUrl = () => {
    const fullUrl = `${window.location.protocol}//${window.location.host}/api/webhooks/github`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleCopySmeeUrl = () => {
    const smee = gitHubStatus?.relay?.smeeUrl || 'https://smee.io/sentinelops-dev-channel';
    navigator.clipboard.writeText(smee);
    setCopiedSmeeUrl(true);
    setTimeout(() => setCopiedSmeeUrl(false), 2500);
  };

  const handleToggleRelay = async () => {
    setIsTogglingRelay(true);
    try {
      if (gitHubStatus?.relay?.running) {
        await api.stopRelay();
      } else {
        await api.startRelay(gitHubStatus?.relay?.channelId);
      }
      const updated = await api.getGitHubStatus();
      setGitHubStatus(updated);
    } catch (err) {
      console.error('Failed to toggle relay:', err);
    } finally {
      setIsTogglingRelay(false);
    }
  };

  const handleCopyNgrokUrl = () => {
    const url = gitHubStatus?.ngrok?.webhookUrl || (gitHubStatus?.ngrok?.publicUrl ? `${gitHubStatus.ngrok.publicUrl}/api/webhooks/github` : '');
    if (url) {
      navigator.clipboard.writeText(url);
      setCopiedNgrokUrl(true);
      setTimeout(() => setCopiedNgrokUrl(false), 2500);
    }
  };

  const handleToggleNgrok = async () => {
    setIsTogglingNgrok(true);
    try {
      if (gitHubStatus?.ngrok?.running) {
        await api.stopNgrok();
      } else {
        await api.startNgrok(5000);
      }
      const updated = await api.getGitHubStatus();
      setGitHubStatus(updated);
    } catch (err) {
      console.error('Failed to toggle ngrok:', err);
    } finally {
      setIsTogglingNgrok(false);
    }
  };



  const handleDispatchWorkflow = async () => {
    setIsDispatching(true);
    try {
      const res = await api.dispatchGitHubWorkflow('main', 'deploy.yml');
      if (res.success) {
        setSimulationResult({
          success: true,
          message: res.live
            ? `Live GitHub Actions workflow dispatch sent to ${res.repo}@${res.branch}!`
            : `Autonomous simulation pipeline dispatched for ${res.repo}@${res.branch}.`,
        });
        const updated = await api.getGitHubStatus();
        setGitHubStatus(updated);
      } else {
        setSimulationResult({
          success: false,
          message: res.error || 'Failed to dispatch workflow',
        });
      }
    } catch (err) {
      setSimulationResult({
        success: false,
        message: `Dispatch failed: ${(err as Error).message}`,
      });
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div className="space-y-space-lg">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-space-sm">
        <div>
          <div className="flex items-center gap-space-xs text-[#6B625B] font-label-code-sm text-xs">
            <span>Control Center</span>
            <span>/</span>
            <span className="text-[#99462A] font-semibold">Governance &amp; Autopilot</span>
          </div>
          <h1 className="font-headline-lg text-xl sm:text-2xl font-bold text-[#2D2926] tracking-tight mt-1">
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

      {/* ── GitHub Webhook & Actions Integration Hub ──────────────────────── */}
      <section className="rounded-2xl bg-white border border-[#E5DED6] p-space-lg shadow-card space-y-space-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5DED6] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#24292F] text-white flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">alt_route</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-headline-sm text-base font-bold text-[#2D2926]">
                  GitHub Webhook &amp; Actions End-to-End Hub
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono bg-[#EAF3E7] border border-[#5B7C4B]/30 text-[#5B7C4B]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#5B7C4B] animate-pulse" />
                  {gitHubStatus?.mode === 'production-verified' ? 'SECRET VERIFIED' : 'DEV INGESTION ACTIVE'}
                </span>
              </div>
              <p className="text-xs text-[#6B625B]">
                Bidirectional integration between GitHub Actions workflows, repository push/PR events, and SentinelOps
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`https://github.com/${gitHubStatus?.repository || 'naveenkumar030/SentinelOps'}/settings/hooks`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] hover:bg-[#F2EDE6] text-xs font-semibold text-[#2D2926] shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-xs text-[#D97757]">open_in_new</span>
              <span>Open GitHub Webhooks</span>
            </a>
          </div>
        </div>

        {/* Webhook Endpoint & Smee Relay Info Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
          <div className="lg:col-span-2 p-3.5 rounded-xl bg-[#FAF7F3] border border-[#E5DED6] space-y-3">
            {/* Smee Live Relay Forwarder */}
            <div className="p-3 rounded-lg bg-white border border-[#E5DED6] space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-[#D97757]">cell_tower</span>
                  <span className="font-bold text-[#2D2926]">Live Smee.io Webhook Relay</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      gitHubStatus?.relay?.connected
                        ? 'bg-[#EAF3E7] border-[#5B7C4B]/40 text-[#5B7C4B]'
                        : gitHubStatus?.relay?.running
                        ? 'bg-[#FEF7EC] border-[#B87A36]/40 text-[#B87A36]'
                        : 'bg-[#F2EDE6] border-[#E5DED6] text-[#6B625B]'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        gitHubStatus?.relay?.connected
                          ? 'bg-[#5B7C4B] animate-pulse'
                          : gitHubStatus?.relay?.running
                          ? 'bg-[#B87A36]'
                          : 'bg-[#8F857D]'
                      }`}
                    />
                    {gitHubStatus?.relay?.connected
                      ? `Connected (${gitHubStatus.relay.eventsForwarded} forwarded)`
                      : gitHubStatus?.relay?.running
                      ? 'Connecting...'
                      : 'Relay Idle'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleCopySmeeUrl}
                    className="px-2 py-1 rounded bg-[#FAF7F3] border border-[#E5DED6] hover:bg-[#F2EDE6] text-[11px] font-semibold text-[#99462A] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-xs">{copiedSmeeUrl ? 'check' : 'content_copy'}</span>
                    <span>{copiedSmeeUrl ? 'Copied Smee URL!' : 'Copy Smee URL'}</span>
                  </button>
                  <button
                    disabled={isTogglingRelay}
                    onClick={handleToggleRelay}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold text-white flex items-center gap-1 transition-all cursor-pointer ${
                      gitHubStatus?.relay?.running
                        ? 'bg-[#C34A4A] hover:bg-[#A33838]'
                        : 'bg-[#5B7C4B] hover:bg-[#476239]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs">
                      {gitHubStatus?.relay?.running ? 'stop_circle' : 'play_circle'}
                    </span>
                    <span>{gitHubStatus?.relay?.running ? 'Stop Relay' : 'Start Relay'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <code className="font-mono text-[11px] text-[#D97757] font-semibold bg-[#FAF7F3] px-2.5 py-1 rounded border border-[#E5DED6] flex-1 truncate select-all">
                  {gitHubStatus?.relay?.smeeUrl || 'https://smee.io/sentinelops-dev-channel'}
                </code>
              </div>

              <div className="text-[11px] text-[#6B625B] bg-[#FAF7F3] p-2.5 rounded border border-[#E5DED6]/80 space-y-1">
                <div className="font-semibold text-[#2D2926] flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs text-[#D97757]">help</span>
                  <span>GitHub Repository Setup:</span>
                </div>
                <ol className="list-decimal list-inside space-y-0.5 text-[10px] pl-1">
                  <li>Go to your GitHub repo <strong>Settings → Webhooks → Add webhook</strong></li>
                  <li>Paste the Smee URL above into <strong>Payload URL</strong></li>
                  <li>Set Content type to <strong>application/json</strong></li>
                  <li>Select <strong>Workflow runs</strong>, <strong>Pushes</strong>, and <strong>Pull requests</strong></li>
                  <li>Click <strong>Add webhook</strong> — webhooks forward instantly to your local SentinelOps!</li>
                </ol>
              </div>
            </div>

            {/* ngrok Live Public Tunnel */}
            <div className="p-3 rounded-lg bg-white border border-[#E5DED6] space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-[#2563eb]">hub</span>
                  <span className="font-bold text-[#2D2926]">Live ngrok HTTPS Tunnel</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      gitHubStatus?.ngrok?.running
                        ? 'bg-[#EFF6FF] border-[#3B82F6]/40 text-[#2563eb]'
                        : 'bg-[#F2EDE6] border-[#E5DED6] text-[#6B625B]'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        gitHubStatus?.ngrok?.running ? 'bg-[#2563eb] animate-pulse' : 'bg-[#8F857D]'
                      }`}
                    />
                    {gitHubStatus?.ngrok?.running
                      ? `Active (Port ${gitHubStatus.ngrok.port || 5000})`
                      : 'Tunnel Disconnected'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {gitHubStatus?.ngrok?.webhookUrl && (
                    <button
                      onClick={handleCopyNgrokUrl}
                      className="px-2 py-1 rounded bg-[#FAF7F3] border border-[#E5DED6] hover:bg-[#F2EDE6] text-[11px] font-semibold text-[#2563eb] flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-xs">
                        {copiedNgrokUrl ? 'check' : 'content_copy'}
                      </span>
                      <span>{copiedNgrokUrl ? 'Copied ngrok URL!' : 'Copy ngrok Webhook'}</span>
                    </button>
                  )}
                  <button
                    disabled={isTogglingNgrok}
                    onClick={handleToggleNgrok}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold text-white flex items-center gap-1 transition-all cursor-pointer ${
                      gitHubStatus?.ngrok?.running
                        ? 'bg-[#C34A4A] hover:bg-[#A33838]'
                        : 'bg-[#2563eb] hover:bg-[#1d4ed8]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs">
                      {gitHubStatus?.ngrok?.running ? 'stop_circle' : 'cloud_sync'}
                    </span>
                    <span>{gitHubStatus?.ngrok?.running ? 'Stop ngrok' : 'Start ngrok Tunnel'}</span>
                  </button>
                </div>
              </div>

              {gitHubStatus?.ngrok?.webhookUrl ? (
                <div className="space-y-1">
                  <div className="text-[10px] text-[#8F857D] font-semibold uppercase tracking-wider">
                    Direct Public Webhook URL:
                  </div>
                  <code className="font-mono text-[11px] text-[#2563eb] font-semibold bg-[#FAF7F3] px-2.5 py-1 rounded border border-[#E5DED6] block truncate select-all">
                    {gitHubStatus.ngrok.webhookUrl}
                  </code>
                </div>
              ) : (
                <p className="text-[10px] text-[#6B625B]">
                  Authtoken configured. Click &ldquo;Start ngrok Tunnel&rdquo; or run <code className="font-mono text-[#99462A]">start_ngrok.bat</code> to open a direct public HTTPS endpoint for GitHub webhooks.
                </p>
              )}
            </div>

            {/* Local Fallback Endpoint */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-[#8F857D] uppercase font-bold tracking-wider">
                Direct Local Endpoint (Internal)
              </span>
              <button
                onClick={handleCopyWebhookUrl}
                className="px-2 py-0.5 rounded bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] text-[10px] font-semibold text-[#6B625B] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-xs">{copiedUrl ? 'check' : 'content_copy'}</span>
                <span>{copiedUrl ? 'Copied!' : 'Copy Local'}</span>
              </button>
            </div>
            <code className="font-mono text-xs text-[#2D2926] bg-white px-2 py-1 rounded border border-[#E5DED6] block truncate select-all">
              {window.location.origin}/api/webhooks/github
            </code>
          </div>

          <div className="p-3 rounded-xl bg-[#FAF7F3] border border-[#E5DED6] space-y-1.5">
            <span className="text-[10px] text-[#8F857D] uppercase font-bold tracking-wider block">
              Repository &amp; Events Target
            </span>
            <div className="font-semibold text-xs text-[#2D2926] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-[#D97757]">source</span>
              <span>{gitHubStatus?.repository || 'naveenkumar030/SentinelOps'}</span>
            </div>
            <div className="flex flex-wrap gap-1 pt-1">
              {['workflow_run', 'push', 'pull_request', 'ping'].map((evt) => (
                <span key={evt} className="px-1.5 py-0.5 rounded bg-white border border-[#E5DED6] text-[10px] font-mono text-[#6B625B]">
                  {evt}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Simulation Feedback Alert */}
        {simulationResult && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
              simulationResult.success
                ? 'bg-[#EAF3E7] border-[#5B7C4B]/40 text-[#2D2926]'
                : 'bg-[#FDF0F0] border-[#C34A4A]/40 text-[#C34A4A]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-[#5B7C4B]">
                {simulationResult.success ? 'check_circle' : 'error'}
              </span>
              <span>{simulationResult.message}</span>
            </div>
            <button
              onClick={() => setSimulationResult(null)}
              className="text-[#6B625B] hover:text-[#2D2926] cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}

        {/* Interactive Webhook Simulator & Actions Dispatch Buttons */}
        <div className="space-y-2 pt-1 border-t border-[#E5DED6]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#2D2926] flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-[#D97757]">play_arrow</span>
              <span>Instant Webhook Simulator &amp; GitHub Actions Dispatch</span>
            </span>
            <span className="text-[11px] text-[#6B625B]">Trigger live payload ingestion to Flask backend</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <button
              disabled={simulatingEvent !== null}
              onClick={() => handleTestWebhook('ping')}
              className="p-2.5 rounded-xl bg-[#FAF7F3] border border-[#E5DED6] hover:bg-[#F2EDE6] text-left text-xs cursor-pointer transition-all disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#2D2926] text-[11px]">Send Ping</span>
                <span className="material-symbols-outlined text-xs text-[#D97757]">sensors</span>
              </div>
              <div className="text-[10px] text-[#6B625B]">Verify Pong status</div>
            </button>

            <button
              disabled={simulatingEvent !== null}
              onClick={() => handleTestWebhook('push')}
              className="p-2.5 rounded-xl bg-[#FAF7F3] border border-[#E5DED6] hover:bg-[#F2EDE6] text-left text-xs cursor-pointer transition-all disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#2D2926] text-[11px]">Simulate Push</span>
                <span className="material-symbols-outlined text-xs text-[#5B7C4B]">upload</span>
              </div>
              <div className="text-[10px] text-[#6B625B]">Trigger build pipeline</div>
            </button>

            <button
              disabled={simulatingEvent !== null}
              onClick={() => handleTestWebhook('workflow_run')}
              className="p-2.5 rounded-xl bg-[#FAF7F3] border border-[#E5DED6] hover:bg-[#F2EDE6] text-left text-xs cursor-pointer transition-all disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#2D2926] text-[11px]">Workflow (Success)</span>
                <span className="material-symbols-outlined text-xs text-[#5B7C4B]">task_alt</span>
              </div>
              <div className="text-[10px] text-[#6B625B]">Sync completed build</div>
            </button>

            <button
              disabled={simulatingEvent !== null}
              onClick={() =>
                handleTestWebhook(
                  JSON.stringify({
                    action: 'completed',
                    workflow_run: {
                      name: 'Deploy Production',
                      head_branch: 'main',
                      head_sha: 'c9f8a7b',
                      status: 'completed',
                      conclusion: 'failure',
                      actor: { login: 'ci-runner' },
                    },
                    repository: { name: 'billing-engine' },
                  })
                )
              }
              className="p-2.5 rounded-xl bg-[#FAF7F3] border border-[#E5DED6] hover:bg-[#FDF0F0] text-left text-xs cursor-pointer transition-all disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#C34A4A] text-[11px]">Workflow (Failed)</span>
                <span className="material-symbols-outlined text-xs text-[#C34A4A]">error</span>
              </div>
              <div className="text-[10px] text-[#6B625B]">Trigger AI remediation</div>
            </button>

            <button
              disabled={simulatingEvent !== null}
              onClick={() => handleTestWebhook('pull_request')}
              className="p-2.5 rounded-xl bg-[#FAF7F3] border border-[#E5DED6] hover:bg-[#F2EDE6] text-left text-xs cursor-pointer transition-all disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#2D2926] text-[11px]">Simulate PR Open</span>
                <span className="material-symbols-outlined text-xs text-[#99462A]">call_merge</span>
              </div>
              <div className="text-[10px] text-[#6B625B]">Run AI AST Audit</div>
            </button>

            <button
              disabled={isDispatching}
              onClick={handleDispatchWorkflow}
              className="p-2.5 rounded-xl bg-[#F9ECE7] border border-[#D97757]/40 hover:bg-[#D97757] hover:text-white group text-left text-xs cursor-pointer transition-all disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#99462A] group-hover:text-white text-[11px]">Dispatch Actions</span>
                <span className="material-symbols-outlined text-xs text-[#D97757] group-hover:text-white">send</span>
              </div>
              <div className="text-[10px] text-[#6B625B] group-hover:text-white/90">Run deploy.yml</div>
            </button>
          </div>
        </div>

        {/* Live Webhook Ingestion Log */}
        <div className="space-y-2 pt-2 border-t border-[#E5DED6]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#2D2926] flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-[#5B7C4B]">receipt_long</span>
              <span>Recent Ingested Webhook Events ({gitHubStatus?.recentEvents?.length || 0})</span>
            </span>
            <button
              onClick={() => api.getGitHubStatus().then(setGitHubStatus)}
              className="text-[11px] text-[#99462A] hover:underline flex items-center gap-1 cursor-pointer font-semibold"
            >
              <span className="material-symbols-outlined text-xs">refresh</span>
              <span>Refresh Events</span>
            </button>
          </div>

          {gitHubStatus?.recentEvents && gitHubStatus.recentEvents.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {gitHubStatus.recentEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-2 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                        ev.event === 'workflow_run'
                          ? 'bg-[#EAF3E7] text-[#5B7C4B]'
                          : ev.event === 'push'
                          ? 'bg-[#F9ECE7] text-[#99462A]'
                          : ev.event === 'pull_request'
                          ? 'bg-[#EFF6FF] text-[#2563EB]'
                          : 'bg-[#FAF7F3] text-[#6B625B] border border-[#E5DED6]'
                      }`}
                    >
                      {ev.event}
                    </span>
                    <span className="font-medium text-[#2D2926] text-[11px] truncate max-w-md">{ev.summary}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-[#6B625B] font-mono shrink-0">
                    <span>@{ev.sender}</span>
                    <span>{ev.timestamp.substring(11, 19)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] text-center text-xs text-[#6B625B]">
              No webhooks received yet this session. Click any simulation button above or configure the webhook URL in GitHub Settings to see live incoming events!
            </div>
          )}
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
