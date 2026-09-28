import { useState, useEffect } from 'react';
import { api, type SettingsData, type GitHubStatusResponse } from '../services/api';
import { useBackend } from '../context/useBackend';

export default function SettingsPage() {
  const { isMockMode, setMockMode } = useBackend();

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

  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
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
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings: Backend offline or unreachable.');
      setTimeout(() => setSaveError(null), 5000);
    } finally {
      setIsSaving(false);
    }
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
    setSimulationResult(null);
    try {
      if (gitHubStatus?.relay?.running) {
        await api.stopRelay();
        setSimulationResult({ success: true, message: 'Smee webhook relay stopped.' });
      } else {
        const res = await api.startRelay(gitHubStatus?.relay?.channelId);
        setSimulationResult({ success: true, message: res.message || 'Smee webhook relay started.' });
      }
      const updated = await api.getGitHubStatus();
      setGitHubStatus(updated);
    } catch (err) {
      console.error('Failed to toggle relay:', err);
      setSimulationResult({
        success: false,
        message: `Failed to toggle Smee relay: ${err instanceof Error ? err.message : 'Backend offline or unreachable.'}`,
      });
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
    setSimulationResult(null);
    try {
      if (gitHubStatus?.ngrok?.running) {
        await api.stopNgrok();
        setSimulationResult({ success: true, message: 'ngrok public webhook tunnel stopped.' });
      } else {
        const res = await api.startNgrok(5000);
        setSimulationResult({ success: true, message: res.message || 'ngrok public webhook tunnel started.' });
      }
      const updated = await api.getGitHubStatus();
      setGitHubStatus(updated);
    } catch (err) {
      console.error('Failed to toggle ngrok:', err);
      setSimulationResult({
        success: false,
        message: `Failed to toggle ngrok tunnel: ${err instanceof Error ? err.message : 'Backend offline or unreachable.'}`,
      });
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

      {saveError && (
        <div className="p-3 rounded-lg bg-[#FDF0F0] border border-[#C34A4A]/40 text-[#C34A4A] text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-base">error</span>
          {saveError}
        </div>
      )}

      {/* ── System Operation Mode (Production vs Demo Sandbox) ───────────── */}
      <section className="rounded-2xl bg-white border border-[#E5DED6] p-space-lg shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5DED6] pb-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isMockMode
                ? 'bg-[#F2EDFB] border border-[#7C65C1]/40 text-[#7C65C1]'
                : 'bg-[#EDF4EA] border border-[#5B7C4B]/40 text-[#5B7C4B]'
            }`}>
              <span className="material-symbols-outlined text-lg">
                {isMockMode ? 'science' : 'verified_user'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-headline-sm text-base font-bold text-[#2D2926]">
                  System Operation Mode
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono border ${
                    isMockMode
                      ? 'bg-[#F2EDFB] border-[#7C65C1]/30 text-[#7C65C1]'
                      : 'bg-[#EDF4EA] border-[#5B7C4B]/30 text-[#5B7C4B]'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isMockMode ? 'bg-[#7C65C1]' : 'bg-[#5B7C4B]'
                    }`}
                  />
                  {isMockMode ? 'DEMO SANDBOX MODE' : 'LIVE PRODUCTION MODE'}
                </span>
              </div>
              <p className="text-xs text-[#6B625B]">
                Configure how the SentinelOps web client executes mutations, verifications, and external workflows
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#F6F2EC] p-1 rounded-xl border border-[#E5DED6]">
            <button
              type="button"
              onClick={() => setMockMode(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                !isMockMode
                  ? 'bg-white text-[#2D2926] shadow-sm border border-[#E5DED6]'
                  : 'text-[#6B625B] hover:text-[#2D2926]'
              }`}
            >
              <span className={`material-symbols-outlined text-sm ${!isMockMode ? 'text-[#5B7C4B]' : ''}`}>
                bolt
              </span>
              <span>Live Production</span>
            </button>
            <button
              type="button"
              onClick={() => setMockMode(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                isMockMode
                  ? 'bg-[#7C65C1] text-white shadow-sm'
                  : 'text-[#6B625B] hover:text-[#2D2926]'
              }`}
            >
              <span className="material-symbols-outlined text-sm">science</span>
              <span>Demo Sandbox</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div
            onClick={() => setMockMode(false)}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              !isMockMode
                ? 'bg-[#FAF8F5] border-[#5B7C4B] ring-1 ring-[#5B7C4B]/30'
                : 'bg-white border-[#E5DED6] hover:border-[#D5CDC5]'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-[#5B7C4B]">security</span>
                <span className="font-bold text-[#2D2926]">Live Production Mode (Default)</span>
              </div>
              {!isMockMode && (
                <span className="text-[10px] uppercase font-bold text-[#5B7C4B] bg-[#EDF4EA] px-2 py-0.5 rounded-full border border-[#5B7C4B]/20">
                  Active
                </span>
              )}
            </div>
            <p className="text-[#6B625B] font-body-sm leading-relaxed">
              Every operation contacts Flask (<code className="font-mono text-[#2D2926]">:5000</code>). Failures fast on unreachable backends; never fakes repository verifications, webhooks, PR merges, or workflow dispatches.
            </p>
          </div>

          <div
            onClick={() => setMockMode(true)}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              isMockMode
                ? 'bg-[#FDFCFA] border-[#7C65C1] ring-1 ring-[#7C65C1]/30'
                : 'bg-white border-[#E5DED6] hover:border-[#D5CDC5]'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-[#7C65C1]">science</span>
                <span className="font-bold text-[#2D2926]">Demo / Sandbox Mode</span>
              </div>
              {isMockMode && (
                <span className="text-[10px] uppercase font-bold text-[#7C65C1] bg-[#F2EDFB] px-2 py-0.5 rounded-full border border-[#7C65C1]/20">
                  Active
                </span>
              )}
            </div>
            <p className="text-[#6B625B] font-body-sm leading-relaxed">
              Safe simulated responses for UI evaluation, offline walkthroughs, and automated interface previews. Responses are tagged <code className="font-mono text-[#7C65C1]">[Demo Mode]</code>.
            </p>
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

      {/* Main Grid: Policies */}
      <div className="space-y-space-lg">
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


      </div>
    </div>
  );
}
