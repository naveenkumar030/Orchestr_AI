import { useState } from 'react';
import { pipelines } from '../data/mockData';
import type { Pipeline } from '../types';

export default function PipelinesPage() {
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline>(pipelines[0]);
  const [filter, setFilter] = useState<'all' | 'running' | 'success' | 'failed'>('all');

  const filteredPipelines = pipelines.filter((p) => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  return (
    <div className="space-y-space-lg">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
        <div>
          <div className="flex items-center gap-space-xs text-[#6B625B] font-label-code-sm text-xs">
            <span>Control Center</span>
            <span>/</span>
            <span className="text-[#99462A] font-semibold">Autonomous DAG Workflows</span>
          </div>
          <h1 className="font-headline-lg text-2xl font-bold text-[#2D2926] tracking-tight mt-1">
            Pipelines &amp; DAG Execution
          </h1>
        </div>

        <div className="flex items-center gap-space-sm">
          <button className="px-4 py-2 rounded-lg bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] text-[#2D2926] font-medium font-body-sm flex items-center gap-2 shadow-sm transition-all">
            <span className="material-symbols-outlined text-lg">tune</span>
            <span>DAG Settings</span>
          </button>
          <button className="px-4 py-2 rounded-lg bg-[#D97757] hover:bg-[#B85D3E] text-white font-medium font-body-sm flex items-center gap-2 shadow-sm transition-all">
            <span className="material-symbols-outlined text-lg">play_arrow</span>
            <span>Trigger Pipeline</span>
          </button>
        </div>
      </div>

      {/* Top 4 Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-base">
        {/* Card 1 */}
        <div className="relative overflow-hidden rounded-xl bg-white border border-[#E5DED6] p-space-base shadow-card transition-transform hover:-translate-y-1 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-label-caps uppercase text-[#6B625B] tracking-wider font-semibold">
              Active Workflows
            </span>
            <span className="material-symbols-outlined text-[#D97757] text-lg">account_tree</span>
          </div>
          <div className="mt-space-md flex items-baseline gap-space-xs">
            <span className="font-headline-xl text-3xl font-bold text-[#2D2926]">148</span>
            <span className="font-label-code-sm text-xs text-[#99462A] font-semibold">+12.4% vs peak</span>
          </div>
          <div className="mt-space-sm flex items-center justify-between font-label-code-sm text-xs text-[#6B625B]">
            <span>141 Nominal</span>
            <span className="text-[#D97757] font-semibold">7 Interventions</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="relative overflow-hidden rounded-xl bg-white border border-[#E5DED6] p-space-base shadow-card transition-transform hover:-translate-y-1 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-label-caps uppercase text-[#6B625B] tracking-wider font-semibold">
              Fleet Capacity
            </span>
            <span className="material-symbols-outlined text-[#D97757] text-lg">developer_board</span>
          </div>
          <div className="mt-space-md flex items-baseline gap-space-xs">
            <span className="font-headline-xl text-3xl font-bold text-[#2D2926]">64 <span className="text-[#6B625B] text-lg font-normal">/ 96</span></span>
            <span className="font-label-code-sm text-xs text-[#6B625B]">Allocated</span>
          </div>
          <div className="mt-space-sm w-full bg-[#F2EDE6] rounded-full h-1.5 overflow-hidden">
            <div className="bg-[#D97757] h-full rounded-full" style={{ width: '66.6%' }}></div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="relative overflow-hidden rounded-xl bg-white border border-[#E5DED6] p-space-base shadow-card transition-transform hover:-translate-y-1 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-label-caps uppercase text-[#6B625B] tracking-wider font-semibold">
              AI Interventions (24h)
            </span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D97757] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D97757]"></span>
            </span>
          </div>
          <div className="mt-space-md flex items-baseline gap-space-xs">
            <span className="font-headline-xl text-3xl font-bold text-[#D97757]">32</span>
            <span className="font-label-code-sm text-xs text-[#99462A] font-semibold">97.0% Success</span>
          </div>
          <div className="mt-space-sm flex items-center justify-between font-label-code-sm text-xs text-[#6B625B]">
            <span>31 Auto-remediated</span>
            <span className="text-[#C34A4A] font-medium">1 Escalated</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="relative overflow-hidden rounded-xl bg-white border border-[#E5DED6] p-space-base shadow-card transition-transform hover:-translate-y-1 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-label-caps uppercase text-[#6B625B] tracking-wider font-semibold">
              Mean Stage Duration
            </span>
            <span className="material-symbols-outlined text-[#D97757] text-lg">timer</span>
          </div>
          <div className="mt-space-md flex items-baseline gap-space-xs">
            <span className="font-headline-xl text-3xl font-bold text-[#2D2926]">2m 14s</span>
            <span className="font-label-code-sm text-xs text-[#99462A] font-semibold">-38s faster</span>
          </div>
          <div className="mt-space-sm flex items-center justify-between font-label-code-sm text-xs text-[#6B625B]">
            <span>Cache Hit 94.2%</span>
            <span>Target: &lt;3m</span>
          </div>
        </div>
      </div>

      {/* Interactive DAG Canvas */}
      <div className="relative rounded-2xl bg-white border border-[#E5DED6] p-space-lg shadow-card overflow-hidden flex flex-col gap-space-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-space-sm gap-space-sm border-b border-[#E5DED6]">
          <div className="flex items-center gap-space-md flex-wrap">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[#D97757] text-lg">terminal</span>
              <span className="font-headline-sm font-semibold text-[#2D2926]">{selectedPipeline.repo}</span>
              <span className="font-label-code-sm text-xs px-2 py-0.5 rounded bg-[#F9ECE7] text-[#99462A] font-medium">
                {selectedPipeline.branch}
              </span>
              <span className="font-label-code-sm text-xs text-[#6B625B]">
                commit: <span className="text-[#2D2926] font-semibold">#{selectedPipeline.commit}</span>
              </span>
            </div>
            <span className="font-label-caps text-xs px-2 py-0.5 rounded-full bg-[#F2EDE6] border border-[#E5DED6] text-[#6B625B] uppercase tracking-wider">
              Triggered by: {selectedPipeline.triggeredBy}
            </span>
          </div>

          <div className="flex items-center gap-space-sm">
            <span className="font-label-code-sm text-xs text-[#6B625B] flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#D97757] animate-pulse"></span>
              Live DAG Graph
            </span>
            <button className="px-3 py-1.5 rounded bg-[#F2EDE6] border border-[#E5DED6] text-[#2D2926] hover:bg-[#E5DED6] font-label-code-sm text-xs flex items-center gap-1 transition-all">
              <span className="material-symbols-outlined text-sm">fullscreen</span>
              Expanded View
            </button>
          </div>
        </div>

        {/* Horizontal DAG Stages Flow */}
        <div className="w-full overflow-x-auto pb-space-sm pt-space-xs">
          <div className="flex items-center min-w-[1020px] justify-between gap-space-sm">
            {/* Stage 1 */}
            <div className="flex-1 rounded-xl bg-white border border-[#E5DED6] p-space-md shadow-sm hover:shadow-md transition-all flex flex-col gap-1 cursor-pointer">
              <div className="flex items-center justify-between">
                <span className="font-label-caps text-[10px] text-[#6B625B] uppercase tracking-wider">Stage 01</span>
                <span className="inline-flex items-center gap-1 font-label-code-sm text-xs text-[#99462A] bg-[#F9ECE7] px-2 py-0.5 rounded-full font-semibold">
                  <span className="material-symbols-outlined text-xs">check_circle</span> 18s
                </span>
              </div>
              <p className="font-headline-sm font-semibold text-[#2D2926]">Checkout &amp; Lint</p>
              <div className="flex items-center justify-between text-[#6B625B] font-label-code-sm text-xs pt-1">
                <span>runner-x86-04</span>
                <span className="text-[#99462A] font-semibold">0 warnings</span>
              </div>
              <div className="w-full bg-[#F2EDE6] rounded-full h-1 mt-1">
                <div className="bg-[#D97757] h-full rounded-full w-full"></div>
              </div>
            </div>

            {/* Connector */}
            <div className="flex items-center text-[#B5ABA1]">
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </div>

            {/* Stage 2 */}
            <div className="flex-1 rounded-xl bg-white border border-[#E5DED6] p-space-md shadow-sm hover:shadow-md transition-all flex flex-col gap-1 cursor-pointer">
              <div className="flex items-center justify-between">
                <span className="font-label-caps text-[10px] text-[#6B625B] uppercase tracking-wider">Stage 02</span>
                <span className="inline-flex items-center gap-1 font-label-code-sm text-xs text-[#99462A] bg-[#F9ECE7] px-2 py-0.5 rounded-full font-semibold">
                  <span className="material-symbols-outlined text-xs">check_circle</span> 45s
                </span>
              </div>
              <p className="font-headline-sm font-semibold text-[#2D2926]">Build Container</p>
              <div className="flex items-center justify-between text-[#6B625B] font-label-code-sm text-xs pt-1">
                <span>builder-kaniko-09</span>
                <span className="text-[#99462A] font-semibold">Layers cached</span>
              </div>
              <div className="w-full bg-[#F2EDE6] rounded-full h-1 mt-1">
                <div className="bg-[#D97757] h-full rounded-full w-full"></div>
              </div>
            </div>

            {/* Connector */}
            <div className="flex items-center text-[#B5ABA1]">
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </div>

            {/* Stage 3 (AI HEALED) */}
            <div className="flex-1 rounded-xl bg-[#FDF9F7] border-2 border-[#D97757] p-space-md shadow-sm flex flex-col gap-1 cursor-pointer relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="font-label-caps text-[10px] text-[#D97757] font-bold uppercase tracking-wider">
                  Stage 03 · AI HEALED
                </span>
                <span className="inline-flex items-center gap-1 font-label-code-sm text-xs text-[#D97757] bg-[#F9ECE7] px-2 py-0.5 rounded-full font-semibold">
                  <span className="material-symbols-outlined text-xs">auto_fix_high</span> 1m 12s
                </span>
              </div>
              <p className="font-headline-sm font-semibold text-[#2D2926]">Unit &amp; Integration</p>
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#F9ECE7] text-[#99462A] font-label-code-sm text-xs font-semibold animate-pulse border border-[#D97757]/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#D97757]"></span> Patch Applied Live
                </span>
              </div>
              <div className="flex items-center justify-between text-[#6B625B] font-label-code-sm text-xs pt-1">
                <span>test-matrix-v3</span>
                <span className="text-[#99462A] font-semibold">418 / 418 passed</span>
              </div>
              <div className="w-full bg-[#F2EDE6] rounded-full h-1 mt-1">
                <div className="bg-[#D97757] h-full rounded-full w-full"></div>
              </div>
            </div>

            {/* Connector */}
            <div className="flex items-center text-[#D97757] animate-pulse">
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </div>

            {/* Stage 4 (Active Scan) */}
            <div className="flex-1 rounded-xl bg-white border border-[#D97757] p-space-md shadow-sm flex flex-col gap-1 cursor-pointer relative">
              <div className="flex items-center justify-between">
                <span className="font-label-caps text-[10px] text-[#D97757] uppercase tracking-wider font-semibold">
                  Stage 04 · Active
                </span>
                <span className="inline-flex items-center gap-1 font-label-code-sm text-xs text-[#D97757] bg-[#F9ECE7] px-2 py-0.5 rounded-full border border-[#D97757]/30 font-semibold">
                  <span className="material-symbols-outlined text-xs animate-spin">refresh</span> 94%
                </span>
              </div>
              <p className="font-headline-sm font-semibold text-[#2D2926]">Security &amp; SBOM Scan</p>
              <div className="flex items-center justify-between text-[#6B625B] font-label-code-sm text-xs pt-1">
                <span>sec-trivy-worker</span>
                <span className="text-[#99462A] font-mono text-xs font-semibold">0 CVE critical</span>
              </div>
              <div className="w-full bg-[#F2EDE6] rounded-full h-1 mt-1 overflow-hidden">
                <div className="bg-[#D97757] h-full rounded-full w-[94%] animate-pulse"></div>
              </div>
            </div>

            {/* Connector */}
            <div className="flex items-center text-[#B5ABA1]">
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </div>

            {/* Stage 5 (Queued) */}
            <div className="flex-1 rounded-xl bg-[#FAF7F3] border border-[#E5DED6] p-space-md shadow-sm flex flex-col gap-1 opacity-70">
              <div className="flex items-center justify-between">
                <span className="font-label-caps text-[10px] text-[#6B625B] uppercase tracking-wider">Stage 05</span>
                <span className="font-label-code-sm text-xs text-[#6B625B]">Queued</span>
              </div>
              <p className="font-headline-sm font-semibold text-[#2D2926]">Canary Deploy (k8s)</p>
              <div className="flex items-center justify-between text-[#6B625B] font-label-code-sm text-xs pt-1">
                <span>cluster-prod-east</span>
                <span>10% traffic</span>
              </div>
              <div className="w-full bg-[#F2EDE6] rounded-full h-1 mt-1">
                <div className="bg-[#E5DED6] h-full rounded-full w-0"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Terminal output drawer */}
        <div className="rounded-xl bg-[#201B18] text-[#EDE7E3] p-space-md font-mono text-xs border border-[#3E3835]">
          <div className="flex items-center justify-between pb-2 border-b border-[#3E3835] mb-2 text-[#A89F99]">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#D97757]"></span>
              <span>LIVE LOG STREAM // Stage 04 · SAST Security</span>
            </div>
            <span>Runner ID: runner-us-east-492 · Kaniko v1.18</span>
          </div>
          <div className="space-y-1 font-mono text-xs text-[#D1C7BD]">
            <p className="text-[#8F857D]">[02:14:38] Initializing Trivy container scanner v0.51.1 ...</p>
            <p className="text-[#8F857D]">[02:14:40] Loading vulnerability database (updated 12m ago) ...</p>
            <p className="text-[#D97757]">[02:14:43] Scanning base layer docker.io/library/node:20.11-alpine3.19 ...</p>
            <p className="text-[#D97757]">[02:14:46] AI Sentinel validated AST changes against CVE-2024-21538: PASSED</p>
            <p className="text-white font-semibold flex items-center gap-2">
              <span className="inline-block h-2 w-1 bg-[#D97757] animate-pulse"></span>
              Checking 84 declared dependencies in package-lock.json (94% complete)
            </p>
          </div>
        </div>
      </div>

      {/* Pipelines List Section */}
      <div className="rounded-2xl bg-white border border-[#E5DED6] p-space-lg shadow-card space-y-space-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm border-b border-[#E5DED6] pb-space-sm">
          <div>
            <h2 className="font-headline-sm text-lg font-bold text-[#2D2926]">Active &amp; Recent Pipelines</h2>
            <p className="font-body-sm text-sm text-[#6B625B]">Real-time execution status across all connected repositories</p>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-[#F2EDE6] p-1 rounded-lg border border-[#E5DED6]">
            {(['all', 'running', 'success', 'failed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 text-xs font-semibold rounded capitalize transition-all ${
                  filter === tab
                    ? 'bg-white text-[#2D2926] shadow-sm'
                    : 'text-[#6B625B] hover:text-[#2D2926]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Table of Pipelines */}
        <div className="overflow-x-auto">
          <table className="w-full text-left font-body-sm">
            <thead>
              <tr className="border-b border-[#E5DED6] text-[#6B625B] font-label-caps text-xs uppercase tracking-wider">
                <th className="pb-3 font-semibold">Pipeline &amp; Service</th>
                <th className="pb-3 font-semibold">Branch / Commit</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Stage Progress</th>
                <th className="pb-3 font-semibold">Duration</th>
                <th className="pb-3 font-semibold">Triggered</th>
                <th className="pb-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DED6]">
              {filteredPipelines.map((pipeline) => {
                const isSelected = selectedPipeline.id === pipeline.id;
                return (
                  <tr
                    key={pipeline.id}
                    onClick={() => setSelectedPipeline(pipeline)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#F9ECE7]/50' : 'hover:bg-[#FAF7F3]'
                    }`}
                  >
                    <td className="py-4 font-medium text-[#2D2926]">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg text-[#D97757]">
                          {pipeline.status === 'running' ? 'sync' : pipeline.status === 'success' ? 'check_circle' : 'error'}
                        </span>
                        <div>
                          <div className="font-semibold text-sm">{pipeline.name}</div>
                          <div className="text-xs text-[#6B625B] font-mono">{pipeline.repo}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="text-xs font-mono text-[#2D2926] font-semibold">{pipeline.branch}</div>
                      <div className="text-xs font-mono text-[#6B625B]">#{pipeline.commit}</div>
                    </td>
                    <td className="py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-label-code-sm text-xs font-semibold ${
                          pipeline.status === 'running'
                            ? 'bg-[#F9ECE7] text-[#99462A] border border-[#D97757]/30'
                            : pipeline.status === 'success'
                            ? 'bg-[#F2EDE6] text-[#6B625B] border border-[#E5DED6]'
                            : 'bg-[#FDF0F0] text-[#C34A4A] border border-[#C34A4A]/30'
                        }`}
                      >
                        {pipeline.status === 'running' && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#D97757] animate-pulse"></span>
                        )}
                        {pipeline.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-1">
                        {pipeline.stages.map((stage, idx) => (
                          <div
                            key={idx}
                            title={`${stage.name}: ${stage.status}`}
                            className={`h-2.5 w-7 rounded-sm ${
                              stage.status === 'success'
                                ? 'bg-[#D97757]'
                                : stage.status === 'running'
                                ? 'bg-[#D97757] animate-pulse'
                                : stage.status === 'failed'
                                ? 'bg-[#C34A4A]'
                                : 'bg-[#E5DED6]'
                            }`}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="py-4 text-xs font-mono text-[#6B625B]">{pipeline.duration}</td>
                    <td className="py-4 text-xs text-[#6B625B]">
                      <div>{pipeline.time}</div>
                      <div className="text-[11px] text-[#A89F99]">{pipeline.triggeredBy}</div>
                    </td>
                    <td className="py-4 text-right">
                      <button
                        className="px-3 py-1 rounded bg-[#F2EDE6] hover:bg-[#E5DED6] text-xs font-semibold text-[#2D2926] transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPipeline(pipeline);
                        }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
