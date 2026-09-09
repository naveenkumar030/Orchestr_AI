import { useState } from 'react';

export default function SettingsPage() {
  const [confidenceThreshold, setConfidenceThreshold] = useState(95);
  const [autoMergeActive, setAutoMergeActive] = useState(true);
  const [ciSuccessRequired, setCiSuccessRequired] = useState(true);
  const [zeroCveRequired, setZeroCveRequired] = useState(true);
  const [humanApprovalRequired, setHumanApprovalRequired] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
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
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-[#D97757] hover:bg-[#B85D3E] text-white font-medium text-xs shadow-sm transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">save</span>
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      {savedNotice && (
        <div className="p-3 rounded-lg bg-[#EAF3E7] border border-[#5B7C4B]/40 text-[#5B7C4B] text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-base">check_circle</span>
          Policy configuration updated across all clusters in real time.
        </div>
      )}

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
                onClick={() => alert('Emergency kill-switch activated: All autonomous agents paused.')}
                className="px-4 py-2 rounded-lg bg-[#FDF0F0] border border-[#C34A4A]/40 text-[#C34A4A] font-bold text-xs hover:bg-[#C34A4A] hover:text-white transition-all shadow-xs"
              >
                Engage Emergency Kill-Switch
              </button>
            </div>
          </section>
        </div>

        {/* Right Column: Access Credentials & Tokens (4 cols) */}
        <div className="lg:col-span-4 space-y-space-md">
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

              <button
                onClick={() => alert('Add credential modal opened')}
                className="w-full py-2.5 border border-dashed border-[#E5DED6] text-[#6B625B] rounded-xl hover:bg-[#FAF7F3] hover:text-[#2D2926] transition-colors flex items-center justify-center gap-1.5 font-semibold"
              >
                <span className="material-symbols-outlined text-base">add</span>
                <span>Add Credential</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
