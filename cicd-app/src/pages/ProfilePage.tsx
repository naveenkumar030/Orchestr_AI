import { useState, useEffect } from 'react';
import { operatorApi } from '../services/api/operator';
import type { OperatorProfile, OperatorSignature } from '../services/api/operator';

function formatRelativeTime(dateString: string): string {
  try {
    const timestamp = new Date(dateString).getTime();
    if (isNaN(timestamp)) return dateString;
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 45) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  } catch {
    return dateString;
  }
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [signatures, setSignatures] = useState<OperatorSignature[]>([]);
  const [auditSequence, setAuditSequence] = useState<number>(0);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRotatingCosign, setIsRotatingCosign] = useState(false);
  const [isRotatingGpg, setIsRotatingGpg] = useState(false);
  const [isSigningModalOpen, setIsSigningModalOpen] = useState(false);
  const [newAction, setNewAction] = useState('');
  const [newDetails, setNewDetails] = useState('');
  const [isSubmittingSig, setIsSubmittingSig] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const loadData = async () => {
    try {
      const [profData, sigData] = await Promise.all([
        operatorApi.getOperatorProfile(),
        operatorApi.getOperatorSignatures(),
      ]);
      setProfile(profData);
      setSignatures(sigData.signatures || []);
      setAuditSequence(sigData.sequence || 0);
    } catch (err) {
      console.error('Failed to load operator state:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const copyGpgKey = () => {
    if (!profile?.gpg_key || profile.gpg_key === 'Not configured') {
      showNotification('No signing key configured to copy');
      return;
    }
    navigator.clipboard.writeText(profile.gpg_key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleExportAudit = async () => {
    setIsExporting(true);
    try {
      await operatorApi.downloadAuditExport();
      showNotification('Audit log exported successfully');
    } catch (err) {
      console.error('Audit export error:', err);
      showNotification('Export failed: please try again');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRotateCosignKey = async () => {
    setIsRotatingCosign(true);
    try {
      const res = await operatorApi.rotateCosignKey('Local Worker');
      if (res.data?.success) {
        showNotification('Cosign key rotated & cryptographic signature recorded');
        await loadData();
      }
    } catch (err) {
      console.error('Key rotation failed:', err);
      showNotification('Key rotation error');
    } finally {
      setIsRotatingCosign(false);
    }
  };

  const handleRotateGpgKey = async () => {
    setIsRotatingGpg(true);
    try {
      const res = await operatorApi.rotateGpgKey();
      if (res.data?.success) {
        showNotification('Signing key updated & signature recorded');
        await loadData();
      }
    } catch (err) {
      console.error('Signing key update failed:', err);
      showNotification('Signing key rotation error');
    } finally {
      setIsRotatingGpg(false);
    }
  };

  const handleCreateSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAction.trim()) return;
    setIsSubmittingSig(true);
    try {
      const res = await operatorApi.createSignature(
        newAction.trim(),
        newDetails.trim() || 'Operator policy directive',
        'policy'
      );
      if (res.data?.success) {
        showNotification(`Signed: ${res.data.signature.action}`);
        setNewAction('');
        setNewDetails('');
        setIsSigningModalOpen(false);
        await loadData();
      }
    } catch (err) {
      console.error('Signature creation failed:', err);
    } finally {
      setIsSubmittingSig(false);
    }
  };

  const hasConfiguredGpg = profile?.gpg_key && profile.gpg_key !== 'Not configured' && profile.gpg_key.trim() !== '';

  return (
    <div className="space-y-space-lg">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 px-4 py-3 rounded-xl bg-[#2D2926] text-white text-xs font-medium shadow-xl flex items-center gap-2 border border-white/10 animate-fade-in">
          <span className="material-symbols-outlined text-[#5B7C4B] text-base">verified</span>
          <span>{notification}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-space-sm">
        <div>
          <div className="flex items-center gap-space-xs text-[#6B625B] font-label-code-sm text-xs">
            <span>Control Center</span>
            <span>/</span>
            <span className="text-[#99462A] font-semibold">Operator Profile</span>
          </div>
          <h1 className="font-headline-lg text-xl sm:text-2xl font-bold text-[#2D2926] tracking-tight mt-1">
            Operator Profile &amp; Security Clearance
          </h1>
        </div>

        <div className="flex items-center gap-space-sm flex-wrap">
          <button
            onClick={() => setIsSigningModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] hover:bg-[#F2EDE6] text-[#2D2926] font-medium text-xs shadow-sm transition-all flex items-center gap-1.5"
            title="Create an authentic cryptographic signature"
          >
            <span className="material-symbols-outlined text-sm text-[#D97757]">draw</span>
            <span>Sign Policy / Action</span>
          </button>

          <button
            onClick={handleExportAudit}
            disabled={isExporting}
            className="px-4 py-2 rounded-lg bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] text-[#2D2926] font-medium text-xs shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm text-[#D97757]">
              {isExporting ? 'hourglass_top' : 'verified_user'}
            </span>
            <span>{isExporting ? 'Exporting...' : 'Export Security Audit'}</span>
          </button>
        </div>
      </div>

      {/* Operator Identity Banner */}
      <div className="p-4 sm:p-6 lg:p-space-lg rounded-2xl bg-white border border-[#E5DED6] shadow-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#D97757] text-white flex items-center justify-center font-bold text-2xl shadow-md shadow-[#D97757]/30">
            {profile?.name
              ? profile.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()
              : 'OP'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-headline-md text-xl font-bold text-[#2D2926]">
                {profile?.name || 'Naveen Kumar'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#EAF3E7] border border-[#5B7C4B]/30 text-[#5B7C4B] font-mono text-xs font-semibold">
                {profile?.status || 'ACTIVE OPERATOR'}
              </span>
            </div>
            <p className="text-xs text-[#6B625B] mt-0.5">
              {profile?.role || 'Repository Operator'} · {profile?.handle || '@naveenkumar030'}
            </p>
            <div className="flex items-center gap-3 text-xs text-[#6B625B] mt-2 flex-wrap">
              <span>
                Timezone: <strong>{profile?.timezone || 'Asia/Kolkata (IST +05:30)'}</strong>
              </span>
              <span>·</span>
              <span>
                Cluster Scope: <strong>{profile?.cluster_scope || 'naveenkumar030/testingrepo'}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start md:items-end gap-1.5">
          <span className="px-3 py-1 rounded-full bg-[#F9ECE7] border border-[#D97757]/30 text-[#99462A] font-mono text-xs font-bold">
            Security Clearance: {profile?.clearance || 'Repository Admin'}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#6B625B]">
              Cosign Key: {profile?.cosign_hardware_token || 'Not configured'}
            </span>
            <button
              onClick={handleRotateCosignKey}
              disabled={isRotatingCosign}
              className="text-[10px] font-mono text-[#99462A] hover:underline bg-[#F9ECE7] px-2 py-0.5 rounded border border-[#D97757]/20 disabled:opacity-50"
              title="Rotate Cosign Key"
            >
              {isRotatingCosign ? 'Rotating...' : 'Rotate Key'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Delegation Matrix + Security Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* Left Column: Delegation Matrix & Audit (8 cols) */}
        <div className="lg:col-span-8 space-y-space-lg">
          {/* Delegation Matrix */}
          <div className="rounded-2xl bg-white border border-[#E5DED6] p-space-lg shadow-card space-y-space-md">
            <div className="flex items-center justify-between border-b border-[#E5DED6] pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D97757] text-xl">security</span>
                <h3 className="font-headline-sm font-bold text-base text-[#2D2926]">
                  Autonomous Agent Delegation Matrix
                </h3>
              </div>
              <span className="text-xs text-[#6B625B]">Authority Level: Operator</span>
            </div>

            <div className="space-y-3">
              {(
                profile?.delegation_matrix || [
                  {
                    name: 'Diagnoser Agent',
                    description: 'Root cause analysis, semantic failure log isolation & triage',
                    tier: 'Active',
                    icon: 'smart_toy',
                    color: 'green',
                  },
                  {
                    name: 'Fix Suggester Agent',
                    description: 'Deterministic code patch synthesis & candidate pull requests',
                    tier: 'Active',
                    icon: 'auto_fix_high',
                    color: 'green',
                  },
                  {
                    name: 'MergeGuard-Zero',
                    description: 'Enforces CI verification & safety boundary before auto-merge',
                    tier: 'Active',
                    icon: 'security',
                    color: 'green',
                  },
                ]
              ).map((tier, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-[#FAF7F3] border border-[#E5DED6]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#F9ECE7] text-[#D97757] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined">{tier.icon}</span>
                    </div>
                    <div>
                      <div className="font-bold text-xs text-[#2D2926]">{tier.name}</div>
                      <div className="text-[11px] text-[#6B625B]">{tier.description}</div>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full font-mono text-xs font-bold shrink-0 ${
                      tier.color === 'amber'
                        ? 'bg-[#FDF3E5] border border-[#B87A36]/30 text-[#B87A36]'
                        : 'bg-[#EAF3E7] border border-[#5B7C4B]/30 text-[#5B7C4B]'
                    }`}
                  >
                    {tier.tier}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Real Operator Audit Log */}
          <div className="rounded-2xl bg-white border border-[#E5DED6] p-space-lg shadow-card space-y-space-md">
            <div className="flex items-center justify-between border-b border-[#E5DED6] pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D97757] text-xl">history</span>
                <h3 className="font-headline-sm font-bold text-base text-[#2D2926]">Recent Operator Signatures</h3>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                    signatures.length > 0
                      ? 'text-[#5B7C4B] bg-[#EAF3E7] border-[#5B7C4B]/30'
                      : 'text-[#6B625B] bg-[#FAF7F3] border-[#E5DED6]'
                  }`}
                >
                  {signatures.length > 0 ? 'LIVE AUDIT' : 'IDLE'}
                </span>
                <span className="text-xs text-[#6B625B]">Audit Log #{auditSequence}</span>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              {signatures.length === 0 ? (
                <div className="p-8 text-center bg-[#FAF7F3] rounded-xl border border-dashed border-[#E5DED6] space-y-2">
                  <span className="material-symbols-outlined text-3xl text-[#6B625B]">verified_user</span>
                  <div className="font-semibold text-xs text-[#2D2926]">No operator signatures recorded yet</div>
                  <p className="text-[11px] text-[#6B625B] max-w-md mx-auto">
                    Cryptographic signatures will appear here when an operator signs policy overrides, rotates security keys, or authorizes actions.
                  </p>
                  <button
                    onClick={() => setIsSigningModalOpen(true)}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] text-[#2D2926] font-medium text-xs shadow-sm transition-all"
                  >
                    <span className="material-symbols-outlined text-xs text-[#D97757]">draw</span>
                    <span>Sign First Action</span>
                  </button>
                </div>
              ) : (
                signatures.map((sig) => (
                  <div
                    key={sig.id}
                    className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] hover:border-[#D97757]/40 transition-all space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-[#2D2926] flex items-center gap-1.5">
                          <span>{sig.action}</span>
                          {sig.verified && (
                            <span className="material-symbols-outlined text-xs text-[#5B7C4B]" title="Cryptographically Verified">
                              check_circle
                            </span>
                          )}
                        </div>
                        <div className="text-[#6B625B] text-[11px] mt-0.5">{sig.details}</div>
                      </div>
                      <span className="font-mono text-[#6B625B] shrink-0 text-[11px]">
                        {formatRelativeTime(sig.timestamp)}
                      </span>
                    </div>

                    <div className="pt-1 border-t border-[#E5DED6]/60 flex items-center justify-between text-[10px] text-[#6B625B] font-mono flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[#99462A] font-semibold">{sig.id}</span>
                        <span>·</span>
                        <span className="truncate max-w-[220px]" title={sig.signature_hash}>
                          {sig.signature_hash ? `${sig.signature_hash.slice(0, 18)}...` : 'ECDSA-P256'}
                        </span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-white border border-[#E5DED6] text-[#2D2926]">
                        {sig.token_type || 'Verified Key'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: GPG, MFA & Sessions (4 cols) */}
        <div className="lg:col-span-4 space-y-space-md">
          {/* Signing Key Card */}
          <div className="rounded-2xl bg-white border border-[#E5DED6] p-space-md shadow-card space-y-3">
            <div className="flex items-center justify-between border-b border-[#E5DED6] pb-2">
              <h3 className="font-headline-sm font-bold text-sm text-[#2D2926]">Signing Key (GPG / Git)</h3>
              <div className="flex items-center gap-2">
                <span
                  className={`font-mono text-[10px] font-bold ${
                    hasConfiguredGpg ? 'text-[#5B7C4B]' : 'text-[#6B625B]'
                  }`}
                >
                  {profile?.gpg_status || (hasConfiguredGpg ? 'VERIFIED' : 'UNCONFIGURED')}
                </span>
                <button
                  onClick={handleRotateGpgKey}
                  disabled={isRotatingGpg}
                  className="text-[10px] text-[#99462A] hover:underline font-mono disabled:opacity-50"
                  title="Register new signing key"
                >
                  {isRotatingGpg ? '...' : 'Update'}
                </button>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] font-mono text-[11px] text-[#6B625B] break-all space-y-1">
              {hasConfiguredGpg ? (
                profile?.gpg_key?.split('  ').map((chunk, i) => (
                  <div key={i} className={i === 0 ? 'text-[#2D2926] font-bold' : ''}>
                    {chunk}
                  </div>
                ))
              ) : (
                <div className="text-[#6B625B] italic py-1">
                  No GPG signing key configured in local git.
                </div>
              )}
            </div>

            <button
              onClick={copyGpgKey}
              disabled={!hasConfiguredGpg}
              className="w-full py-1.5 rounded-lg border border-[#E5DED6] hover:bg-[#FAF7F3] text-xs font-semibold text-[#2D2926] flex items-center justify-center gap-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-sm">
                {copiedKey ? 'check' : 'content_copy'}
              </span>
              <span>{copiedKey ? 'Fingerprint Copied' : 'Copy Key Fingerprint'}</span>
            </button>
          </div>

          {/* Active Sessions */}
          <div className="rounded-2xl bg-white border border-[#E5DED6] p-space-md shadow-card space-y-3">
            <h3 className="font-headline-sm font-bold text-sm text-[#2D2926] border-b border-[#E5DED6] pb-2">
              Active Operational Sessions
            </h3>

            <div className="space-y-2 text-xs">
              {(
                profile?.active_sessions || [
                  {
                    name: 'SentinelOps Control Server',
                    status: 'RUNNING',
                    details: 'Port: 5000 · Localhost',
                  },
                ]
              ).map((sess, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#2D2926]">{sess.name}</span>
                    <span
                      className={`font-semibold text-[10px] ${
                        sess.status === 'RUNNING' || sess.status === 'CURRENT'
                          ? 'text-[#5B7C4B]'
                          : 'text-[#6B625B]'
                      }`}
                    >
                      {sess.status}
                    </span>
                  </div>
                  <div className="text-[#6B625B] text-[11px]">{sess.details}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sign Policy / Action Modal */}
      {isSigningModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white border border-[#E5DED6] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5DED6] pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D97757]">draw</span>
                <h3 className="font-bold text-base text-[#2D2926]">Sign Operational Action</h3>
              </div>
              <button
                onClick={() => setIsSigningModalOpen(false)}
                className="text-[#6B625B] hover:text-[#2D2926]"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateSignature} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#2D2926] mb-1">
                  Action / Policy Directive
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Policy Directive: Production Release Approval"
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E5DED6] bg-[#FAF7F3] text-[#2D2926] focus:outline-none focus:border-[#D97757]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#2D2926] mb-1">
                  Audit Justification / Scope
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Manual operator verification for deployment."
                  value={newDetails}
                  onChange={(e) => setNewDetails(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E5DED6] bg-[#FAF7F3] text-[#2D2926] focus:outline-none focus:border-[#D97757]"
                />
              </div>

              <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-1 text-[11px] text-[#6B625B]">
                <div className="flex justify-between">
                  <span>Signer:</span>
                  <strong className="text-[#2D2926]">{profile?.name || 'Naveen Kumar'}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Clearance:</span>
                  <span className="font-mono text-[#99462A]">
                    {profile?.clearance || 'Repository Admin'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSigningModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-[#E5DED6] hover:bg-[#FAF7F3] font-medium text-[#6B625B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSig || !newAction.trim()}
                  className="px-4 py-2 rounded-lg bg-[#D97757] hover:bg-[#C26244] text-white font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">verified</span>
                  <span>{isSubmittingSig ? 'Signing...' : 'Cryptographically Sign'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
