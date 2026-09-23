import { useState, useEffect } from 'react';
import { pipelines as initialPipelines } from '../data/mockData';
import { api } from '../services/api';
import type { Pipeline } from '../types';

export default function PipelinesPage() {
  const [pipelineList, setPipelineList] = useState<Pipeline[]>(initialPipelines);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(initialPipelines[0] || null);
  const [filter, setFilter] = useState<'all' | 'running' | 'success' | 'failed'>('all');
  const [isTriggering, setIsTriggering] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [customRepo, setCustomRepo] = useState('payment-service');
  const [customBranch, setCustomBranch] = useState('main');
  const [customName, setCustomName] = useState('Autonomous CI/CD Workflow');

  useEffect(() => {
    let mounted = true;
    const fetchLatest = () => {
      api.getPipelines().then((data) => {
        if (!mounted) return;
        if (data) {
          setPipelineList(data);
          if (data.length > 0) {
            setSelectedPipeline((prev) => (prev ? (data.find((p) => p.id === prev.id) || data[0]) : data[0]));
          } else {
            setSelectedPipeline(null);
          }
        }
      });
    };

    fetchLatest();

    const interval = setInterval(() => {
      setPipelineList((current) => {
        const hasRunning = current.some((p) => p.status === 'running');
        if (hasRunning) {
          fetchLatest();
        }
        return current;
      });
    }, 1500);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleTrigger = async (repo = customRepo, branch = customBranch, name = customName) => {
    setIsTriggering(true);
    try {
      const created = await api.triggerPipeline({ repo, branch, name });
      setPipelineList((prev) => [created, ...prev]);
      setSelectedPipeline(created);
      setNotification(`Pipeline ${created.id} (${name}) scheduled on branch '${branch}' via Flask backend!`);
      setShowTriggerModal(false);
      setTimeout(() => setNotification(null), 4500);
    } catch (err) {
      console.error('Failed to trigger pipeline:', err);
      setNotification('Failed to trigger pipeline via backend API');
    } finally {
      setIsTriggering(false);
    }
  };

  const handleDispatchGitHub = async () => {
    setIsTriggering(true);
    try {
      const res = await api.dispatchGitHubWorkflow(customBranch, 'deploy.yml');
      if (res.success) {
        setNotification(
          res.live
            ? `Dispatched live GitHub Actions workflow (deploy.yml) on branch '${customBranch}'!`
            : `Autonomous simulation workflow dispatched for ${res.repo || 'SentinelOps'}@${customBranch}.`
        );
        setShowTriggerModal(false);
        const latest = await api.getPipelines();
        if (latest && latest.length > 0) {
          setPipelineList(latest);
          setSelectedPipeline(latest[0]);
        }
      } else {
        setNotification(`GitHub Actions dispatch error: ${res.error || 'Failed'}`);
      }
      setTimeout(() => setNotification(null), 4500);
    } catch (err) {
      console.error('Dispatch error:', err);
      setNotification('Failed to dispatch to GitHub Actions');
    } finally {
      setIsTriggering(false);
    }
  };


  const handleRetry = async (pipelineId: string) => {
    try {
      const retried = await api.retryPipeline(pipelineId);
      setPipelineList((prev) =>
        prev.map((p) => (p.id === retried.id ? retried : p))
      );
      if (selectedPipeline && selectedPipeline.id === retried.id) {
        setSelectedPipeline(retried);
      }
      setNotification(`Pipeline ${pipelineId} retry requested successfully.`);
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.error('Failed to retry pipeline:', err);
    }
  };

  const filteredPipelines = pipelineList.filter((p) => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  return (
    <div className="space-y-space-lg">
      {/* Toast Notification */}
      {notification && (
        <div className="p-3 rounded-lg bg-[#EAF3E7] border border-[#5B7C4B]/40 text-[#5B7C4B] text-xs font-semibold flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">task_alt</span>
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-[#5B7C4B] hover:text-[#2D2926]">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

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
          <button
            onClick={() => setShowTriggerModal(true)}
            className="px-4 py-2 rounded-lg bg-[#D97757] hover:bg-[#B85D3E] text-white font-medium font-body-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">play_arrow</span>
            <span>{isTriggering ? 'Triggering...' : 'Trigger Pipeline'}</span>
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
            <span className="font-headline-xl text-3xl font-bold text-[#2D2926]">{pipelineList.length}</span>
            <span className="font-label-code-sm text-xs text-[#99462A] font-semibold">
              {pipelineList.length > 0 ? '+100% live' : 'No runs'}
            </span>
          </div>
          <div className="mt-space-sm flex items-center justify-between font-label-code-sm text-xs text-[#6B625B]">
            <span>{pipelineList.filter(p => p.status === 'success').length} Passed</span>
            <span className="text-[#D97757] font-semibold">{pipelineList.filter(p => p.status === 'failed').length} Failed</span>
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
            <span className="font-headline-xl text-3xl font-bold text-[#2D2926]">
              {pipelineList.filter(p => p.status === 'running').length} <span className="text-[#6B625B] text-lg font-normal">/ 16</span>
            </span>
            <span className="font-label-code-sm text-xs text-[#6B625B]">Active Runners</span>
          </div>
          <div className="mt-space-sm w-full bg-[#F2EDE6] rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-[#D97757] h-full rounded-full"
              style={{ width: `${Math.min(100, (pipelineList.filter(p => p.status === 'running').length / 16) * 100)}%` }}
            ></div>
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
            <span className="font-headline-xl text-3xl font-bold text-[#D97757]">
              {pipelineList.filter(p => p.aiFixed).length}
            </span>
            <span className="font-label-code-sm text-xs text-[#99462A] font-semibold">Autonomous Fixes</span>
          </div>
          <div className="mt-space-sm flex items-center justify-between font-label-code-sm text-xs text-[#6B625B]">
            <span>{pipelineList.filter(p => p.aiFixed).length} Auto-remediated</span>
            <span className="text-[#5B7C4B] font-medium">Ready</span>
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
            <span className="font-headline-xl text-3xl font-bold text-[#2D2926]">
              {pipelineList.length > 0 ? (selectedPipeline?.duration || '42s') : '0s'}
            </span>
            <span className="font-label-code-sm text-xs text-[#99462A] font-semibold">
              {pipelineList.length > 0 ? 'Optimal' : 'Idle'}
            </span>
          </div>
          <div className="mt-space-sm flex items-center justify-between font-label-code-sm text-xs text-[#6B625B]">
            <span>Cache Nominal</span>
            <span>Target: &lt;3m</span>
          </div>
        </div>
      </div>

      {/* Interactive DAG Canvas */}
      {!selectedPipeline || pipelineList.length === 0 ? (
        <div className="relative rounded-2xl bg-white border border-[#E5DED6] p-space-xl shadow-card flex flex-col items-center justify-center text-center py-16">
          <div className="h-16 w-16 rounded-2xl bg-[#F9ECE7] border border-[#D97757]/20 flex items-center justify-center mb-4 text-[#D97757]">
            <span className="material-symbols-outlined text-3xl">account_tree</span>
          </div>
          <h3 className="font-headline-sm text-lg font-bold text-[#2D2926]">No Active CI/CD Pipelines</h3>
          <p className="font-body-sm text-sm text-[#6B625B] max-w-md mt-1 mb-6">
            The execution DAG canvas is idle. Trigger a new build workflow, dispatch a GitHub Action, or simulate an incident to observe autonomous pipeline execution.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleTrigger('api-gateway', 'main')}
              disabled={isTriggering}
              className="btn btn-primary text-xs px-4 py-2 font-semibold shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">play_arrow</span>
              {isTriggering ? 'Triggering...' : 'Trigger Pipeline (main)'}
            </button>
            <button
              onClick={handleDispatchGitHub}
              disabled={isTriggering}
              className="btn btn-secondary text-xs px-4 py-2 font-semibold flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">bolt</span>
              {isTriggering ? 'Dispatching...' : 'Dispatch GitHub Action'}
            </button>
          </div>
        </div>
      ) : (
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
      )}

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
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left font-body-sm min-w-[760px]">
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
              {filteredPipelines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#6B625B]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-3xl text-[#A89F99]">folder_open</span>
                      <p className="font-semibold text-sm text-[#2D2926]">No CI/CD pipelines recorded</p>
                      <p className="text-xs text-[#6B625B]">Trigger a new pipeline run above or simulate workflow events to populate telemetry.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPipelines.map((pipeline) => {
                  const isSelected = selectedPipeline?.id === pipeline.id;
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
                      <div className="flex items-center justify-end gap-2">
                        {pipeline.status === 'failed' && (
                          <button
                            className="px-2.5 py-1 rounded bg-[#FDF0F0] border border-[#C34A4A]/30 text-[#C34A4A] hover:bg-[#C34A4A] hover:text-white text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRetry(pipeline.id);
                            }}
                          >
                            <span className="material-symbols-outlined text-xs">replay</span>
                            <span>Retry</span>
                          </button>
                        )}
                        <button
                          className="px-3 py-1 rounded bg-[#F2EDE6] hover:bg-[#E5DED6] text-xs font-semibold text-[#2D2926] transition-all cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPipeline(pipeline);
                          }}
                        >
                          Inspect
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trigger Pipeline Modal */}
      {showTriggerModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-[#E5DED6] shadow-2xl max-w-md w-full p-4 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E5DED6] pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D97757] text-2xl">account_tree</span>
                <h3 className="font-headline-sm font-bold text-lg text-[#2D2926]">Trigger Autonomous Pipeline</h3>
              </div>
              <button
                onClick={() => setShowTriggerModal(false)}
                className="text-[#6B625B] hover:text-[#2D2926] p-1 rounded cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#2D2926] mb-1">Pipeline Name</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-[#E5DED6] bg-[#FAF7F3] focus:bg-white focus:outline-none focus:border-[#D97757]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2D2926] mb-1">Target Repository</label>
                <select
                  value={customRepo}
                  onChange={(e) => setCustomRepo(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-[#E5DED6] bg-[#FAF7F3] focus:bg-white focus:outline-none focus:border-[#D97757]"
                >
                  <option value="payment-service">payment-service</option>
                  <option value="auth-service">auth-service</option>
                  <option value="gateway-service">gateway-service</option>
                  <option value="inventory-api">inventory-api</option>
                  <option value="order-orchestrator">order-orchestrator</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2D2926] mb-1">Branch</label>
                <input
                  type="text"
                  value={customBranch}
                  onChange={(e) => setCustomBranch(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-[#E5DED6] bg-[#FAF7F3] focus:bg-white focus:outline-none focus:border-[#D97757]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#E5DED6] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-[11px] text-[#6B625B]">Choose execution runner:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTriggerModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-[#E5DED6] text-xs font-medium text-[#6B625B] hover:bg-[#F2EDE6] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={isTriggering}
                  onClick={() => handleTrigger()}
                  className="px-3.5 py-1.5 rounded-lg bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] text-[#2D2926] text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm text-[#D97757]">play_arrow</span>
                  <span>Autonomous Local</span>
                </button>
                <button
                  disabled={isTriggering}
                  onClick={handleDispatchGitHub}
                  className="px-3.5 py-1.5 rounded-lg bg-[#24292F] hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                  <span>Dispatch GitHub Actions</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

