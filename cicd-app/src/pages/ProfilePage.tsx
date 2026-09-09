import { useState } from 'react';

export default function ProfilePage() {
  const [copiedKey, setCopiedKey] = useState(false);

  const copyGpgKey = () => {
    navigator.clipboard.writeText('4A9F 8201 3E29 BF10 9942  DC81 7720 1A09 FE83 4902');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-space-lg">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
        <div>
          <div className="flex items-center gap-space-xs text-[#6B625B] font-label-code-sm text-xs">
            <span>Control Center</span>
            <span>/</span>
            <span className="text-[#99462A] font-semibold">Operator Profile</span>
          </div>
          <h1 className="font-headline-lg text-2xl font-bold text-[#2D2926] tracking-tight mt-1">
            Operator Profile &amp; Security Clearance
          </h1>
        </div>

        <div className="flex items-center gap-space-sm">
          <button
            onClick={() => alert('Security audit log exported')}
            className="px-4 py-2 rounded-lg bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] text-[#2D2926] font-medium text-xs shadow-sm transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm text-[#D97757]">verified_user</span>
            <span>Export Security Audit</span>
          </button>
        </div>
      </div>

      {/* Operator Identity Banner */}
      <div className="p-space-lg rounded-2xl bg-white border border-[#E5DED6] shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#D97757] text-white flex items-center justify-center font-bold text-2xl shadow-md shadow-[#D97757]/30">
            NK
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-headline-md text-xl font-bold text-[#2D2926]">Naveen Kumar</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#EAF3E7] border border-[#5B7C4B]/30 text-[#5B7C4B] font-mono text-xs font-semibold">
                ACTIVE OPERATOR
              </span>
            </div>
            <p className="text-xs text-[#6B625B] mt-0.5">Staff Platform &amp; Autonomous Systems Engineer · @naveenkumar030</p>
            <div className="flex items-center gap-3 text-xs text-[#6B625B] mt-2">
              <span>Timezone: <strong>Asia/Kolkata (IST +05:30)</strong></span>
              <span>·</span>
              <span>Cluster Scope: <strong>Global Mesh (38 Repos)</strong></span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start md:items-end gap-1.5">
          <span className="px-3 py-1 rounded-full bg-[#F9ECE7] border border-[#D97757]/30 text-[#99462A] font-mono text-xs font-bold">
            Security Clearance: LEVEL 4 ADMIN
          </span>
          <span className="text-[11px] text-[#6B625B]">Cosign Hardware Token: YubiKey 5C NFC Verified</span>
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
              <span className="text-xs text-[#6B625B]">Authority Level: Root</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF7F3] border border-[#E5DED6]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#F9ECE7] text-[#D97757] flex items-center justify-center">
                    <span className="material-symbols-outlined">auto_fix</span>
                  </div>
                  <div>
                    <div className="font-bold text-xs text-[#2D2926]">Incident Auto-Remediator (Sentinel-7)</div>
                    <div className="text-[11px] text-[#6B625B]">Full autonomous AST diff generation, rollback trigger, and patch commit</div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#EAF3E7] border border-[#5B7C4B]/30 text-[#5B7C4B] font-mono text-xs font-bold">
                  Tier 4 · Unrestricted
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF7F3] border border-[#E5DED6]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#F9ECE7] text-[#D97757] flex items-center justify-center">
                    <span className="material-symbols-outlined">call_merge</span>
                  </div>
                  <div>
                    <div className="font-bold text-xs text-[#2D2926]">PR Autopilot Reviewer &amp; Merger</div>
                    <div className="text-[11px] text-[#6B625B]">Automated code review, lint fixing, and merge queue promotion</div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#EAF3E7] border border-[#5B7C4B]/30 text-[#5B7C4B] font-mono text-xs font-bold">
                  Tier 3 · Staging &amp; Prod
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF7F3] border border-[#E5DED6]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#F9ECE7] text-[#D97757] flex items-center justify-center">
                    <span className="material-symbols-outlined">account_tree</span>
                  </div>
                  <div>
                    <div className="font-bold text-xs text-[#2D2926]">DAG Pipeline Workflow Orchestrator</div>
                    <div className="text-[11px] text-[#6B625B]">Dynamic parallel execution rebalancing and failure retry policies</div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#EAF3E7] border border-[#5B7C4B]/30 text-[#5B7C4B] font-mono text-xs font-bold">
                  Tier 3 · All Clusters
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF7F3] border border-[#E5DED6]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#F9ECE7] text-[#D97757] flex items-center justify-center">
                    <span className="material-symbols-outlined">pest_control</span>
                  </div>
                  <div>
                    <div className="font-bold text-xs text-[#2D2926]">Chaos Engineering &amp; Drift Injector</div>
                    <div className="text-[11px] text-[#6B625B]">Synthetic latency injection and failover drill execution</div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#FDF3E5] border border-[#B87A36]/30 text-[#B87A36] font-mono text-xs font-bold">
                  Tier 2 · Staging Only
                </span>
              </div>
            </div>
          </div>

          {/* Operator Audit Log */}
          <div className="rounded-2xl bg-white border border-[#E5DED6] p-space-lg shadow-card space-y-space-md">
            <div className="flex items-center justify-between border-b border-[#E5DED6] pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D97757] text-xl">history</span>
                <h3 className="font-headline-sm font-bold text-base text-[#2D2926]">Recent Operator Signatures</h3>
              </div>
              <span className="text-xs text-[#6B625B]">Audit Log #4810</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between">
                <div>
                  <div className="font-bold text-[#2D2926]">Approved Autonomous Merge: PR #184</div>
                  <div className="text-[#6B625B]">payment-service: resolve stripe-node peer dependency</div>
                </div>
                <span className="font-mono text-[#6B625B]">14m ago</span>
              </div>

              <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between">
                <div>
                  <div className="font-bold text-[#2D2926]">Policy Override: Staging Autopilot Threshold → 95%</div>
                  <div className="text-[#6B625B]">Tightened confidence boundary for Kubernetes deployments</div>
                </div>
                <span className="font-mono text-[#6B625B]">1h ago</span>
              </div>

              <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between">
                <div>
                  <div className="font-bold text-[#2D2926]">Cosign Key Rotation: Production Node Worker 01</div>
                  <div className="text-[#6B625B]">Hardware cryptographic signature re-authenticated</div>
                </div>
                <span className="font-mono text-[#6B625B]">3h ago</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: GPG, MFA & Sessions (4 cols) */}
        <div className="lg:col-span-4 space-y-space-md">
          {/* GPG Key Card */}
          <div className="rounded-2xl bg-white border border-[#E5DED6] p-space-md shadow-card space-y-3">
            <div className="flex items-center justify-between border-b border-[#E5DED6] pb-2">
              <h3 className="font-headline-sm font-bold text-sm text-[#2D2926]">GPG Commit Key</h3>
              <span className="text-[#5B7C4B] font-mono text-[10px] font-bold">VERIFIED</span>
            </div>

            <div className="p-2.5 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] font-mono text-[11px] text-[#6B625B] break-all space-y-1">
              <div className="text-[#2D2926] font-bold">4A9F 8201 3E29 BF10 9942</div>
              <div>DC81 7720 1A09 FE83 4902</div>
            </div>

            <button
              onClick={copyGpgKey}
              className="w-full py-1.5 rounded-lg border border-[#E5DED6] hover:bg-[#FAF7F3] text-xs font-semibold text-[#2D2926] flex items-center justify-center gap-1 transition-all"
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
              Active Sessions
            </h3>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#2D2926]">Antigravity IDE (Windows)</span>
                  <span className="text-[#5B7C4B] font-semibold text-[10px]">CURRENT</span>
                </div>
                <div className="text-[#6B625B] text-[11px]">IP: 192.168.1.124 · Local Workstation</div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#2D2926]">AGY CLI Daemon</span>
                  <span className="text-[#6B625B] text-[10px]">v2.4 Kernel</span>
                </div>
                <div className="text-[#6B625B] text-[11px]">Daemon PID: 49102 · Port: 58570</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
