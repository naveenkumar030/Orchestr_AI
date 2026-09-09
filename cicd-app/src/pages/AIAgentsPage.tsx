import { useState } from 'react';
import { aiAgents } from '../data/mockData';

export default function AIAgentsPage() {
  const [temperature, setTemperature] = useState(0.10);
  const [reasoningBudget, setReasoningBudget] = useState(4096);
  const [astCaching, setAstCaching] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(aiAgents[0].name);

  return (
    <div className="space-y-space-lg">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
        <div>
          <div className="flex items-center gap-space-xs text-[#6B625B] font-label-code-sm text-xs">
            <span>Control Center</span>
            <span>/</span>
            <span className="text-[#99462A] font-semibold">Fleet Orchestration</span>
          </div>
          <h1 className="font-headline-lg text-2xl font-bold text-[#2D2926] tracking-tight mt-1">
            AI Agents Fleet &amp; Orchestration
          </h1>
        </div>

        <div className="flex items-center gap-space-sm">
          <button className="px-4 py-2 rounded-lg bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] text-[#2D2926] font-medium font-body-sm flex items-center gap-2 shadow-sm transition-all text-xs">
            <span className="material-symbols-outlined text-base text-[#D97757]">smart_toy</span>
            <span>Deploy Agent Pod</span>
          </button>
          <button className="px-4 py-2 rounded-lg bg-[#D97757] hover:bg-[#B85D3E] text-white font-medium font-body-sm flex items-center gap-2 shadow-sm transition-all text-xs">
            <span className="material-symbols-outlined text-base">tune</span>
            <span>Global Policies</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-base">
        {/* Metric 1 */}
        <div className="relative overflow-hidden p-space-base rounded-xl bg-white border border-[#E5DED6] shadow-card flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#6B625B] mb-2">
            <span className="font-label-caps text-xs uppercase tracking-wider font-semibold">Active AI Agent Nodes</span>
            <span className="material-symbols-outlined text-[#D97757] text-xl">smart_toy</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-[#2D2926]">12 <span className="text-[#6B625B] text-lg font-normal">/ 16</span></span>
            <span className="font-label-code-sm text-xs text-[#99462A] font-semibold">4 Standby</span>
          </div>
          <div className="mt-3 pt-2 flex items-center justify-between text-[#6B625B] border-t border-[#E5DED6] text-xs">
            <span>k8s cluster: prod-east-agent</span>
            <span className="text-[#5B7C4B] font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#5B7C4B] animate-pulse"></span>
              Healthy
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="relative overflow-hidden p-space-base rounded-xl bg-white border border-[#E5DED6] shadow-card flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#6B625B] mb-2">
            <span className="font-label-caps text-xs uppercase tracking-wider font-semibold">Autonomous Resolution</span>
            <span className="material-symbols-outlined text-[#D97757] text-xl">bolt</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-[#2D2926]">94.8%</span>
            <span className="font-label-code-sm text-xs text-[#99462A] font-semibold">+6.2% this week</span>
          </div>
          <div className="mt-3 pt-2 flex items-center justify-between text-[#6B625B] border-t border-[#E5DED6] text-xs">
            <span>132 of 146 CI failures repaired</span>
            <span className="font-semibold text-[#99462A]">0 Escapes</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="relative overflow-hidden p-space-base rounded-xl bg-white border border-[#E5DED6] shadow-card flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#6B625B] mb-2">
            <span className="font-label-caps text-xs uppercase tracking-wider font-semibold">Zero-Shot Patch Accuracy</span>
            <span className="material-symbols-outlined text-[#D97757] text-xl">auto_fix_high</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-[#2D2926]">98.6%</span>
            <span className="font-label-code-sm text-xs text-[#99462A] font-semibold">99.1% Verified</span>
          </div>
          <div className="mt-3 pt-2 flex items-center justify-between text-[#6B625B] border-t border-[#E5DED6] text-xs">
            <span>AST compile &amp; test pass rate</span>
            <span className="material-symbols-outlined text-sm text-[#5B7C4B]">verified</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="relative overflow-hidden p-space-base rounded-xl bg-white border border-[#E5DED6] shadow-card flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#6B625B] mb-2">
            <span className="font-label-caps text-xs uppercase tracking-wider font-semibold">Inference Cost</span>
            <span className="material-symbols-outlined text-[#D97757] text-xl">payments</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-[#2D2926]">$14.80<span className="text-[#6B625B] text-sm font-normal">/day</span></span>
            <span className="font-label-code-sm text-xs text-[#5B7C4B] font-semibold">94.2% Cache Hit</span>
          </div>
          <div className="mt-3 pt-2 flex items-center justify-between text-[#6B625B] border-t border-[#E5DED6] text-xs">
            <span>vs $4,200 on-call equiv</span>
            <span className="font-semibold text-[#5B7C4B]">Savings: 99.6%</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Fleet List + Right Live Trace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 space-y-space-lg">
          {/* Autonomous Agent Fleet Card */}
          <div className="rounded-2xl bg-white border border-[#E5DED6] p-space-lg shadow-card space-y-space-md">
            <div className="flex items-center justify-between border-b border-[#E5DED6] pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D97757] text-xl">psychology</span>
                <h2 className="font-headline-md text-lg font-bold text-[#2D2926]">Autonomous Agent Fleet</h2>
                <span className="font-label-code-sm text-xs px-2 py-0.5 rounded-full bg-[#FAF7F3] border border-[#E5DED6] text-[#6B625B]">
                  5 active · 1 standby
                </span>
              </div>
              <span className="font-label-code-sm text-xs text-[#6B625B]">Orchestrator: K8s-CRD-v2</span>
            </div>

            {/* Agent 1 */}
            <div
              onClick={() => setSelectedAgent('AST-Patch-Architect-v4')}
              className={`p-space-base rounded-xl border transition-all cursor-pointer ${
                selectedAgent === 'AST-Patch-Architect-v4'
                  ? 'bg-[#F9ECE7]/40 border-[#D97757] shadow-sm'
                  : 'bg-white border-[#E5DED6] hover:shadow-md'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-center text-[#D97757]">
                    <span className="material-symbols-outlined text-2xl">account_tree</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-headline-sm text-sm font-bold text-[#2D2926]">AST-Patch-Architect-v4</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F9ECE7] border border-[#D97757]/30 text-[#99462A] text-xs font-semibold">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#D97757] animate-pulse"></span>
                        Active (4 in flight)
                      </span>
                    </div>
                    <span className="font-mono text-xs text-[#6B625B]">Backend: Claude 3.7 Sonnet (Hybrid CoT Reasoning)</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button className="px-2.5 py-1 rounded bg-[#FAF7F3] border border-[#E5DED6] hover:bg-[#F2EDE6] text-xs font-medium text-[#2D2926] flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">terminal</span>
                    Trace
                  </button>
                  <button className="px-2.5 py-1 rounded bg-[#FAF7F3] border border-[#E5DED6] hover:bg-[#F2EDE6] text-xs font-medium text-[#2D2926] flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">tune</span>
                    Config
                  </button>
                </div>
              </div>

              <p className="text-xs text-[#6B625B] leading-relaxed mb-3">
                Specialization: Semantic syntax tree mutations, breaking upgrade reconciliation, lockfile AST patch synthesis, and strict peer-dependency resolution.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] text-xs">
                <div>
                  <span className="text-[10px] text-[#8F857D] uppercase font-semibold block">Pass Rate</span>
                  <span className="font-semibold text-[#99462A]">99.4% (AST Valid)</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#8F857D] uppercase font-semibold block">Avg Latency</span>
                  <span className="font-semibold text-[#2D2926]">312ms / token</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#8F857D] uppercase font-semibold block">Host Runner</span>
                  <span className="font-semibold text-[#6B625B]">k8s-agent-worker-01</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#8F857D] uppercase font-semibold block">Permissions</span>
                  <span className="font-semibold text-[#2D2926]">Read / PR Write</span>
                </div>
              </div>
            </div>

            {/* Agent 2 */}
            <div
              onClick={() => setSelectedAgent('Docker-Sec-Remediator')}
              className={`p-space-base rounded-xl border transition-all cursor-pointer ${
                selectedAgent === 'Docker-Sec-Remediator'
                  ? 'bg-[#F9ECE7]/40 border-[#D97757] shadow-sm'
                  : 'bg-white border-[#E5DED6] hover:shadow-md'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-center text-[#D97757]">
                    <span className="material-symbols-outlined text-2xl">shield</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-headline-sm text-sm font-bold text-[#2D2926]">Docker-Sec-Remediator</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F9ECE7] border border-[#D97757]/30 text-[#99462A] text-xs font-semibold">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#D97757] animate-pulse"></span>
                        Active (2 in flight)
                      </span>
                    </div>
                    <span className="font-mono text-xs text-[#6B625B]">Backend: DevOps-LLM v2.4 (Self-Hosted H100)</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button className="px-2.5 py-1 rounded bg-[#FAF7F3] border border-[#E5DED6] hover:bg-[#F2EDE6] text-xs font-medium text-[#2D2926] flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">terminal</span>
                    Trace
                  </button>
                </div>
              </div>

              <p className="text-xs text-[#6B625B] leading-relaxed mb-3">
                Specialization: Base image CVE patching, Alpine / Debian multi-stage Dockerfile optimization, and non-root security context injection.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] text-xs">
                <div>
                  <span className="text-[10px] text-[#8F857D] uppercase font-semibold block">CVEs Patched</span>
                  <span className="font-semibold text-[#5B7C4B]">743 zero-day</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#8F857D] uppercase font-semibold block">Image Shrink</span>
                  <span className="font-semibold text-[#2D2926]">-48% avg</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#8F857D] uppercase font-semibold block">Host Runner</span>
                  <span className="font-semibold text-[#6B625B]">k8s-agent-worker-02</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#8F857D] uppercase font-semibold block">Action Policy</span>
                  <span className="font-semibold text-[#2D2926]">Auto-Branch</span>
                </div>
              </div>
            </div>

            {/* Agent 3 */}
            <div
              onClick={() => setSelectedAgent('Flaky-Test-Isolator')}
              className={`p-space-base rounded-xl border transition-all cursor-pointer ${
                selectedAgent === 'Flaky-Test-Isolator'
                  ? 'bg-[#F9ECE7]/40 border-[#D97757] shadow-sm'
                  : 'bg-white border-[#E5DED6] hover:shadow-md'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-center text-[#D97757]">
                    <span className="material-symbols-outlined text-2xl">bug_report</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-headline-sm text-sm font-bold text-[#2D2926]">Flaky-Test-Isolator</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FAF7F3] border border-[#E5DED6] text-[#6B625B] text-xs font-semibold">
                        Idle (Awaiting run)
                      </span>
                    </div>
                    <span className="font-mono text-xs text-[#6B625B]">Backend: Gemini 1.5 Pro (2M Token Context Window)</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button className="px-2.5 py-1 rounded bg-[#FAF7F3] border border-[#E5DED6] hover:bg-[#F2EDE6] text-xs font-medium text-[#2D2926] flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">playlist_add_check</span>
                    Quarantine (3)
                  </button>
                </div>
              </div>

              <p className="text-xs text-[#6B625B] leading-relaxed mb-3">
                Specialization: Non-deterministic race condition detection, timing skew isolation, synthetic mock generation, and quarantine branch creation.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] text-xs">
                <div>
                  <span className="text-[10px] text-[#8F857D] uppercase font-semibold block">Stabilized Runs</span>
                  <span className="font-semibold text-[#99462A]">84 Test Suites</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#8F857D] uppercase font-semibold block">Context Processed</span>
                  <span className="font-semibold text-[#2D2926]">1.2M lines/hr</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#8F857D] uppercase font-semibold block">Host Runner</span>
                  <span className="font-semibold text-[#6B625B]">k8s-agent-worker-03</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#8F857D] uppercase font-semibold block">Action Policy</span>
                  <span className="font-semibold text-[#2D2926]">Auto-Quarantine</span>
                </div>
              </div>
            </div>
          </div>

          {/* Model Inference Engine Matrix */}
          <div className="rounded-2xl bg-white border border-[#E5DED6] p-space-lg shadow-card space-y-space-md">
            <div className="flex items-center justify-between border-b border-[#E5DED6] pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D97757] text-xl">tune</span>
                <h2 className="font-headline-md text-lg font-bold text-[#2D2926]">Inference Engine Matrix</h2>
              </div>
              <span className="font-mono text-xs text-[#6B625B]">Kernel Dispatcher v2.4</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-space-sm">
              <div className="p-3 rounded-lg bg-[#FAF7F3] border-2 border-[#D97757] shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#2D2926]">Claude 3.7 Sonnet</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#D97757] text-white text-[10px] font-bold">DEFAULT</span>
                </div>
                <p className="text-xs text-[#6B625B]">Hybrid Reasoning CoT engine for semantic code patches.</p>
                <div className="border-t border-[#E5DED6] pt-1.5 text-xs text-[#6B625B] flex justify-between">
                  <span>Cost: <strong className="text-[#2D2926]">$3.00/1M</strong></span>
                  <span>Accuracy: <strong className="text-[#5B7C4B]">99.4%</strong></span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#2D2926]">DevOps-LLM v2.4</span>
                  <span className="px-1.5 py-0.5 rounded bg-white border border-[#E5DED6] text-[10px] font-bold text-[#6B625B]">LOCAL H100</span>
                </div>
                <p className="text-xs text-[#6B625B]">Fine-tuned 70B parameter model hosted on local GPU cluster.</p>
                <div className="border-t border-[#E5DED6] pt-1.5 text-xs text-[#6B625B] flex justify-between">
                  <span>Cost: <strong className="text-[#2D2926]">$0.18/1M</strong></span>
                  <span>Accuracy: <strong className="text-[#5B7C4B]">97.1%</strong></span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#2D2926]">Gemini 1.5 Pro</span>
                  <span className="px-1.5 py-0.5 rounded bg-white border border-[#E5DED6] text-[10px] font-bold text-[#6B625B]">STANDBY</span>
                </div>
                <p className="text-xs text-[#6B625B]">Ultra-context fallback for mega-repository trace dumps (&gt;100k lines).</p>
                <div className="border-t border-[#E5DED6] pt-1.5 text-xs text-[#6B625B] flex justify-between">
                  <span>Context: <strong className="text-[#2D2926]">2M tokens</strong></span>
                  <span>Accuracy: <strong className="text-[#5B7C4B]">98.2%</strong></span>
                </div>
              </div>
            </div>

            {/* Hyperparameter sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md pt-2 border-t border-[#E5DED6]">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#6B625B] font-medium">Temperature (Deterministic)</span>
                  <span className="font-mono text-[#D97757] font-bold">{temperature.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={temperature * 100}
                  onChange={(e) => setTemperature(Number(e.target.value) / 100)}
                  className="w-full accent-[#D97757] h-1.5 bg-[#E5DED6] rounded cursor-pointer"
                />
                <span className="text-[10px] text-[#8F857D]">Lower = reproducible compilation</span>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#6B625B] font-medium">CoT Reasoning Budget</span>
                  <span className="font-mono text-[#D97757] font-bold">{reasoningBudget} tok</span>
                </div>
                <input
                  type="range"
                  min="1024"
                  max="8192"
                  step="512"
                  value={reasoningBudget}
                  onChange={(e) => setReasoningBudget(Number(e.target.value))}
                  className="w-full accent-[#D97757] h-1.5 bg-[#E5DED6] rounded cursor-pointer"
                />
                <span className="text-[10px] text-[#8F857D]">Expanded AST search space</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
                <div>
                  <div className="text-xs font-semibold text-[#2D2926]">Prompt AST Caching</div>
                  <div className="text-[10px] text-[#5B7C4B] font-semibold">94.2% Hit Rate</div>
                </div>
                <input
                  type="checkbox"
                  checked={astCaching}
                  onChange={(e) => setAstCaching(e.target.checked)}
                  className="h-4 w-4 accent-[#D97757] cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Sandboxed Trace (4 cols) */}
        <div className="lg:col-span-4 space-y-space-lg">
          <div className="rounded-2xl bg-white border border-[#E5DED6] p-space-md shadow-card space-y-3">
            <div className="flex items-center justify-between border-b border-[#E5DED6] pb-2">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#D97757] animate-pulse"></span>
                <h3 className="font-headline-sm font-bold text-sm text-[#2D2926]">Live Sandboxed Trace</h3>
              </div>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#FAF7F3] border border-[#E5DED6] text-[#99462A]">
                payment-service #418
              </span>
            </div>

            <div className="p-space-md rounded-xl bg-[#201B18] font-mono text-xs text-[#EDE7E3] space-y-2 max-h-96 overflow-y-auto">
              <div className="text-[#8F857D]">
                <span className="text-[#D97757]">09:42:10.102</span> [KERNEL] Agent AST-Patch-Architect spawned
              </div>
              <div className="p-1.5 rounded bg-[#2D2622] text-[#EDE7E3]">
                <span className="text-[#D97757]">09:42:10.220</span> [STEP 1] Captured STDOUT trace (1,493 lines)
              </div>
              <div className="p-1.5 rounded bg-[#2D2622] text-[#EDE7E3]">
                <span className="text-[#D97757]">09:42:10.840</span> [STEP 2] AST node parsed: dependencies["@stripe/stripe-node"]
              </div>
              <div className="p-1.5 rounded bg-[#2D2622] text-[#EDE7E3]">
                <span className="text-[#D97757]">09:42:11.412</span> [STEP 3] Querying semantic index: 42 CVEs verified
              </div>
              <div className="p-1.5 rounded bg-[#D97757]/20 border border-[#D97757]/40 text-[#FED7AA]">
                <span className="text-[#D97757]">09:42:12.010</span> [STEP 4] Executing isolated sandbox: ephem-val-902
              </div>
              <div className="pl-4 text-[11px] text-[#A89F99] flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-[#5B7C4B]">check_circle</span>
                <span>Network egress restricted to internal mirror</span>
              </div>
              <div className="p-1.5 rounded bg-[#2D2622] text-[#EDE7E3]">
                <span className="text-[#D97757]">09:42:13.204</span> [STEP 5] Regression suite: 440/440 tests passed
              </div>
              <div className="pt-1 text-[#86efac] font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">done_all</span>
                <span>PR #1204 created with AST diff patch</span>
              </div>
              <div className="text-[#8F857D] animate-pulse flex items-center gap-1 pt-1">
                <span className="text-[#D97757]">&gt;&gt;</span>
                <span>Awaiting CI check pass verification...</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#E5DED6] flex justify-between font-mono text-xs text-[#6B625B]">
              <span>Cycle: <strong className="text-[#2D2926]">3.4s</strong></span>
              <span>RAM: <strong className="text-[#2D2926]">412MB</strong></span>
              <span>Tokens: <strong className="text-[#2D2926]">2,841</strong></span>
            </div>
          </div>

          {/* Task Dispatch Queue */}
          <div className="rounded-2xl bg-white border border-[#E5DED6] p-space-md shadow-card space-y-3">
            <div className="flex items-center justify-between border-b border-[#E5DED6] pb-2">
              <h3 className="font-headline-sm font-bold text-sm text-[#2D2926]">Dispatch Queue</h3>
              <span className="font-mono text-xs text-[#6B625B]">3 Pending</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#2D2926]">auth-service: JWT Secret rotation</div>
                  <div className="text-[#6B625B] text-[11px]">Assigned to: AST-Patch-Architect</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#F9ECE7] text-[#99462A] font-semibold text-[10px]">
                  P1 HIGH
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#2D2926]">inventory-api: alpine 3.19 bump</div>
                  <div className="text-[#6B625B] text-[11px]">Assigned to: Docker-Sec-Remediator</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#FAF7F3] text-[#6B625B] font-semibold text-[10px]">
                  P2 NORMAL
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#2D2926]">order-service: flaky grpc retry</div>
                  <div className="text-[#6B625B] text-[11px]">Assigned to: Flaky-Test-Isolator</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#FAF7F3] text-[#6B625B] font-semibold text-[10px]">
                  P3 LOW
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
