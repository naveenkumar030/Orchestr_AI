import { useState } from 'react';
import { api } from '../../services/api';

interface ConnectRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRepo?: string;
  onConnected?: (repo: string) => void;
}

const PRESET_REPOS = [
  { name: 'naveenkumar030/SentinelOps', label: 'Primary Autonomous CI/CD Repo', defaultBranch: 'main', active: true },
  { name: 'naveenkumar030/payment-service', label: 'Stripe & Ledger Microservice', defaultBranch: 'main', active: false },
  { name: 'naveenkumar030/auth-service', label: 'JWT & OAuth Identity Provider', defaultBranch: 'main', active: false },
  { name: 'naveenkumar030/order-orchestrator', label: 'Redis & Queue Worker Service', defaultBranch: 'main', active: false },
];

function ConnectRepoModalContent({
  onClose,
  currentRepo = 'naveenkumar030/SentinelOps',
  onConnected,
}: Omit<ConnectRepoModalProps, 'isOpen'>) {
  const [activeTab, setActiveTab] = useState<'configure' | 'webhook' | 'dispatch'>('configure');
  const [repoInput, setRepoInput] = useState<string>(currentRepo);
  const [branchInput, setBranchInput] = useState<string>('main');
  const [tokenInput, setTokenInput] = useState<string>('');
  const [showToken, setShowToken] = useState<boolean>(false);

  // Status & Feedback states
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    reachable: boolean;
    stars?: number;
    openIssues?: number;
    isPrivate?: boolean;
    message: string;
  } | null>(null);

  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectedSuccess, setConnectedSuccess] = useState<boolean>(false);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [dispatchResult, setDispatchResult] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!repoInput.trim()) return;
    setIsVerifying(true);
    setVerificationResult(null);
    setActionError(null);
    try {
      const res = await api.verifyRepository({
        repository: repoInput.trim(),
        token: tokenInput.trim() || undefined,
      });
      setVerificationResult(res);
      if (res.defaultBranch) {
        setBranchInput(res.defaultBranch);
      }
    } catch (err) {
      setVerificationResult({
        success: false,
        reachable: false,
        message: err instanceof Error ? err.message : 'Repository verification failed: Backend offline or unreachable.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleConnect = async () => {
    if (!repoInput.trim()) return;
    setIsConnecting(true);
    setActionError(null);
    try {
      const res = await api.connectRepository({
        repository: repoInput.trim(),
        token: tokenInput.trim() || undefined,
        branch: branchInput.trim() || 'main',
      });
      if (res.success) {
        setConnectedSuccess(true);
        if (onConnected) {
          onConnected(res.repository);
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setActionError(res.message || 'Failed to connect repository.');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Connection failed: Backend offline or repository unreachable.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleTriggerDispatch = async () => {
    setIsDispatching(true);
    setDispatchResult(null);
    try {
      const res = await api.dispatchGitHubWorkflow(branchInput, 'deploy.yml');
      if (res.success) {
        setDispatchResult(res.message || `Workflow dispatched successfully to ${repoInput}@${branchInput}!`);
      } else {
        setDispatchResult(res.error || res.message || 'Workflow dispatch rejected.');
      }
    } catch (err) {
      setDispatchResult(err instanceof Error ? `Dispatch error: ${err.message}` : 'Workflow dispatch failed: Backend unreachable.');
    } finally {
      setIsDispatching(false);
    }
  };

  const copyWebhookUrl = () => {
    const url = 'http://127.0.0.1:5000/api/webhooks/github';
    navigator.clipboard.writeText(url);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-[#E5DED6] rounded-2xl p-6 sm:p-7 max-w-xl w-full shadow-2xl relative overflow-hidden">
        
        {/* Glow accent */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-[#D97757]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5DED6] relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F9ECE7] border border-[#D97757]/30 text-[#D97757] flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-2xl">fork_right</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline-md text-lg sm:text-xl text-[#2D2926] font-bold tracking-tight">
                  Connect GitHub Repository
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-[#EDF4EA] text-[#5B7C4B] border border-[#5B7C4B]/30 font-label-code-sm text-[10px] font-semibold uppercase">
                  Telemetry Ready
                </span>
              </div>
              <p className="font-body-sm text-xs text-[#6B625B]">
                Ingest GitHub Actions workflows, automate root-cause triage, and dispatch PR fixes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B625B] hover:text-[#2D2926] hover:bg-[#F2EDE6] transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-[#E5DED6] pt-3 pb-2 text-xs font-label-code-sm">
          <button
            onClick={() => setActiveTab('configure')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'configure'
                ? 'bg-[#F9ECE7] text-[#99462A] border border-[#D97757]/30 shadow-sm'
                : 'text-[#6B625B] hover:text-[#2D2926] hover:bg-[#F2EDE6]'
            }`}
          >
            1. Repository Settings
          </button>
          <button
            onClick={() => setActiveTab('webhook')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'webhook'
                ? 'bg-[#F9ECE7] text-[#99462A] border border-[#D97757]/30 shadow-sm'
                : 'text-[#6B625B] hover:text-[#2D2926] hover:bg-[#F2EDE6]'
            }`}
          >
            2. Webhooks &amp; Relay
          </button>
          <button
            onClick={() => setActiveTab('dispatch')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'dispatch'
                ? 'bg-[#F9ECE7] text-[#99462A] border border-[#D97757]/30 shadow-sm'
                : 'text-[#6B625B] hover:text-[#2D2926] hover:bg-[#F2EDE6]'
            }`}
          >
            3. Test Dispatch
          </button>
        </div>

        {/* Content Body */}
        <div className="py-4 space-y-4">
          
          {/* TAB 1: Repository Settings */}
          {activeTab === 'configure' && (
            <div className="space-y-3.5">
              {/* Preset Repos Quick Select */}
              <div>
                <label className="block font-label-caps text-xs text-[#6B625B] uppercase font-semibold mb-1.5">
                  Quick Select Microservice / Repository
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_REPOS.map((preset) => {
                    const isSelected = repoInput === preset.name;
                    return (
                      <button
                        key={preset.name}
                        onClick={() => {
                          setRepoInput(preset.name);
                          setBranchInput(preset.defaultBranch);
                          setVerificationResult(null);
                        }}
                        className={`p-2 rounded-xl text-left border transition-all text-xs flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#F9ECE7] border-[#D97757] shadow-sm text-[#2D2926]'
                            : 'bg-[#FBF9F5] border-[#E5DED6] hover:bg-[#F2EDE6] text-[#6B625B]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-[#2D2926] truncate">{preset.name.split('/')[1]}</span>
                          {isSelected && <span className="material-symbols-outlined text-xs text-[#D97757]">check_circle</span>}
                        </div>
                        <span className="text-[10px] text-[#8F857D] truncate mt-0.5">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Repository Input & Branch */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block font-label-caps text-xs text-[#6B625B] uppercase font-semibold mb-1">
                    GitHub Repository (owner/repo)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={repoInput}
                      onChange={(e) => {
                        setRepoInput(e.target.value);
                        setVerificationResult(null);
                      }}
                      placeholder="e.g. naveenkumar030/SentinelOps"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#E5DED6] focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] font-mono text-xs text-[#2D2926] placeholder-[#8F857D]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-label-caps text-xs text-[#6B625B] uppercase font-semibold mb-1">
                    Default Branch
                  </label>
                  <input
                    type="text"
                    value={branchInput}
                    onChange={(e) => setBranchInput(e.target.value)}
                    placeholder="main"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#E5DED6] focus:border-[#D97757] font-mono text-xs text-[#2D2926]"
                  />
                </div>
              </div>

              {/* Personal Access Token (PAT) Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-label-caps text-xs text-[#6B625B] uppercase font-semibold">
                    GitHub Personal Access Token (Optional for Public Repos)
                  </label>
                  <span className="text-[10px] text-[#8F857D]">Required for automated PR creation</span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full pl-3 pr-10 py-2 rounded-lg bg-white border border-[#E5DED6] focus:border-[#D97757] font-mono text-xs text-[#2D2926]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 text-[#6B625B] hover:text-[#2D2926] p-1"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {showToken ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Action Error Alert */}
              {actionError && (
                <div className="p-3 rounded-xl border bg-[#FDF0F0] border-[#C34A4A]/40 text-[#C34A4A] flex items-center justify-between text-xs font-body-sm animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">error</span>
                    <span>{actionError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActionError(null)}
                    className="text-[#C34A4A] hover:underline text-[11px] font-semibold"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Verification Info Box */}
              {verificationResult && (
                <div className={`p-3 rounded-xl border flex items-start gap-2 text-xs font-body-sm animate-fade-in ${
                  verificationResult.reachable
                    ? 'bg-[#EDF4EA] border-[#5B7C4B]/40 text-[#2D2926]'
                    : 'bg-[#FDF0F0] border-[#C34A4A]/40 text-[#C34A4A]'
                }`}>
                  <span className={`material-symbols-outlined text-base ${
                    verificationResult.reachable ? 'text-[#5B7C4B]' : 'text-[#C34A4A]'
                  }`}>
                    {verificationResult.reachable ? 'check_circle' : 'cancel'}
                  </span>
                  <div className="flex-1">
                    <span className="font-semibold block">{verificationResult.message}</span>
                    {verificationResult.reachable && (
                      <div className="flex items-center gap-3 mt-1 font-label-code-sm text-[11px] text-[#6B625B]">
                        <span>Branch: <b>{branchInput}</b></span>
                        <span>⭐ Stars: <b>{verificationResult.stars ?? 0}</b></span>
                        <span>Issues: <b>{verificationResult.openIssues ?? 0}</b></span>
                        <span>Visibility: <b>{verificationResult.isPrivate ? 'Private' : 'Public'}</b></span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Webhooks & Relay */}
          {activeTab === 'webhook' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-[#FBF9F5] border border-[#E5DED6] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#2D2926] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-[#D97757]">cell_tower</span>
                    Ingestion Webhook Endpoint
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#EDF4EA] text-[#5B7C4B] font-label-code-sm text-[10px] font-semibold border border-[#5B7C4B]/30">
                    Listening
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value="http://127.0.0.1:5000/api/webhooks/github"
                    className="flex-1 px-3 py-2 rounded-lg bg-[#F2EDE6] border border-[#E5DED6] font-mono text-xs text-[#2D2926]"
                  />
                  <button
                    onClick={copyWebhookUrl}
                    className="px-3 py-2 rounded-lg bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] font-label-code-sm text-xs font-semibold text-[#2D2926] shadow-sm flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">
                      {copiedWebhook ? 'done' : 'content_copy'}
                    </span>
                    <span>{copiedWebhook ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-[#6B625B]">
                  Add this payload URL in your GitHub repository <b>Settings → Webhooks</b> with event types: <code>workflow_run</code>, <code>push</code>, and <code>pull_request</code>.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white border border-[#E5DED6] flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-[#2D2926] block">Smee.io Webhook Relay Forwarder</span>
                  <span className="text-[11px] text-[#6B625B]">Relays public GitHub events into local port 5000 without port forwarding</span>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#F9ECE7] text-[#99462A] border border-[#D97757]/30 font-label-code-sm text-xs font-semibold">
                  Relay Active
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: Test Dispatch */}
          {activeTab === 'dispatch' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-[#FBF9F5] border border-[#E5DED6] space-y-2">
                <span className="font-bold text-xs text-[#2D2926] block">
                  Verify Workflow Dispatch on {repoInput}@{branchInput}
                </span>
                <p className="text-xs text-[#6B625B]">
                  Send a dispatch signal to trigger the automated verification pipeline and test the autonomous self-healing listener.
                </p>

                <button
                  onClick={handleTriggerDispatch}
                  disabled={isDispatching}
                  className="px-4 py-2 rounded-lg bg-[#D97757] hover:bg-[#C66849] text-white font-headline-sm text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                >
                  <span className={`material-symbols-outlined text-sm ${isDispatching ? 'animate-spin' : ''}`}>
                    {isDispatching ? 'sync' : 'rocket_launch'}
                  </span>
                  <span>{isDispatching ? 'Dispatching...' : 'Trigger Workflow Dispatch'}</span>
                </button>

                {dispatchResult && (
                  <div className="p-2.5 rounded-lg bg-[#EDF4EA] border border-[#5B7C4B]/40 text-[#5B7C4B] text-xs font-medium font-body-sm animate-fade-in">
                    ✓ {dispatchResult}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-[#E5DED6] flex items-center justify-between relative z-10">
          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="px-3.5 py-2 rounded-lg bg-[#F2EDE6] hover:bg-[#EBE4DA] border border-[#E5DED6] text-[#2D2926] font-headline-sm text-xs font-medium transition-all flex items-center gap-1.5"
          >
            <span className={`material-symbols-outlined text-sm ${isVerifying ? 'animate-spin' : ''}`}>
              {isVerifying ? 'sync' : 'verified'}
            </span>
            <span>{isVerifying ? 'Verifying...' : 'Verify Access'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] text-[#6B625B] hover:text-[#2D2926] font-headline-sm text-xs font-semibold transition-all"
            >
              Cancel
            </button>

            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="px-5 py-2 rounded-lg bg-[#D97757] hover:bg-[#C66849] text-white font-headline-sm text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
            >
              {isConnecting ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                  <span>Connecting...</span>
                </>
              ) : connectedSuccess ? (
                <>
                  <span className="material-symbols-outlined text-sm">check</span>
                  <span>Connected!</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">link</span>
                  <span>Save &amp; Connect</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConnectRepoModal({
  isOpen,
  onClose,
  currentRepo = 'naveenkumar030/SentinelOps',
  onConnected,
}: ConnectRepoModalProps) {
  if (!isOpen) return null;
  return (
    <ConnectRepoModalContent
      key={currentRepo}
      onClose={onClose}
      currentRepo={currentRepo}
      onConnected={onConnected}
    />
  );
}
