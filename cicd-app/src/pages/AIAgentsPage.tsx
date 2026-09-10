import { useState, useEffect } from 'react';
import { aiAgents as initialMockAgents } from '../data/mockData';
import { api } from '../services/api';
import type { AIAgent, AgentStatus } from '../types';

export default function AIAgentsPage() {
  const [agentList, setAgentList] = useState<AIAgent[]>(initialMockAgents);
  const [selectedAgentName, setSelectedAgentName] = useState<string>(initialMockAgents[0]?.name || 'Sentinel-α');
  const [temperature, setTemperature] = useState(0.10);
  const [reasoningBudget, setReasoningBudget] = useState(4096);
  const [astCaching, setAstCaching] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);

  // Deploy Pod Modal
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [newPodName, setNewPodName] = useState('');
  const [newPodRole, setNewPodRole] = useState('Autonomous RCA & Healing');
  const [newPodCapability, setNewPodCapability] = useState('eBPF trace correlation, semantic diff synthesis, lockfile pin fixing');
  const [newPodModel, setNewPodModel] = useState('Claude 3.7 Sonnet (Hybrid CoT)');
  const [isDeploying, setIsDeploying] = useState(false);

  // Fetch agents from Python Flask Backend
  const fetchAgents = async () => {
    try {
      const data = await api.getAiAgents();
      if (data && data.length > 0) {
        setAgentList(data);
      }
    } catch (err) {
      console.warn('Failed to load AI agents from Flask backend:', err);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleStatusChange = async (agentId: string, newStatus: AgentStatus) => {
    try {
      const updated = await api.updateAgentStatus(agentId, newStatus);
      setAgentList((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setNotification(`Agent '${updated.name}' status changed to '${newStatus}' in Flask backend!`);
      setTimeout(() => setNotification(null), 3500);
    } catch (err) {
      console.error('Failed to update agent status:', err);
    }
  };

  const handleDeployPod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPodName.trim()) return;
    setIsDeploying(true);

    try {
      const created = await api.deployAgentPod({
        name: newPodName.trim(),
        role: newPodRole,
        capability: newPodCapability,
        status: 'active',
        modelBackend: newPodModel,
        tags: ['autonomous', 'k8s', 'dynamic-pod'],
      });

      setAgentList((prev) => [...prev, created]);
      setSelectedAgentName(created.name);
      setShowDeployModal(false);
      setNewPodName('');
      setNotification(`New Agent Pod '${created.name}' (${created.id}) successfully deployed to Python backend!`);
      setTimeout(() => setNotification(null), 4500);
    } catch (err) {
      console.error('Failed to deploy agent pod:', err);
      setNotification('Failed to deploy agent pod via Flask API.');
    } finally {
      setIsDeploying(false);
    }
  };

  const activeCount = agentList.filter((a) => a.status === 'active' || a.status === 'processing').length;
  const standbyCount = agentList.filter((a) => a.status === 'standby' || a.status === 'idle').length;
  const avgSuccessRate =
    agentList.length > 0
      ? (agentList.reduce((acc, a) => acc + (a.successRate || 98), 0) / agentList.length).toFixed(1)
      : '98.6';

  const selectedAgent = agentList.find((a) => a.name === selectedAgentName) || agentList[0];

  return (
    <div className="space-y-space-lg">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#2D2926] text-white text-xs shadow-lg border border-[#D97757]/40 animate-bounce">
          <span className="material-symbols-outlined text-[#D97757] text-base">check_circle</span>
          <span>{notification}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-space-sm">
        <div>
          <div className="flex items-center gap-space-xs text-[#6B625B] font-label-code-sm text-xs">
            <span>Control Center</span>
            <span>/</span>
            <span className="text-[#99462A] font-semibold">Fleet Orchestration</span>
          </div>
          <h1 className="font-headline-lg text-xl sm:text-2xl font-bold text-[#2D2926] tracking-tight mt-1">
            AI Agents Fleet &amp; Orchestration
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-space-sm">
          <button
            onClick={() => setShowDeployModal(true)}
            className="px-3.5 sm:px-4 py-2 rounded-lg bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] text-[#2D2926] font-medium font-body-sm flex items-center gap-1.5 sm:gap-2 shadow-sm transition-all text-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-base text-[#D97757]">smart_toy</span>
            <span>Deploy Pod</span>
          </button>
          <button
            onClick={() => fetchAgents()}
            className="px-3.5 sm:px-4 py-2 rounded-lg bg-[#D97757] hover:bg-[#B85D3E] text-white font-medium font-body-sm flex items-center gap-1.5 sm:gap-2 shadow-sm transition-all text-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            <span>Sync Fleet</span>
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
            <span className="font-headline-xl text-3xl font-bold text-[#2D2926]">
              {activeCount} <span className="text-[#6B625B] text-lg font-normal">/ {agentList.length}</span>
            </span>
            <span className="font-label-code-sm text-xs text-[#99462A] font-semibold">{standbyCount} Standby</span>
          </div>
          <div className="mt-3 pt-2 flex items-center justify-between text-[#6B625B] border-t border-[#E5DED6] text-xs">
            <span>Flask API: /api/ai-agents</span>
            <span className="text-[#5B7C4B] font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#5B7C4B] animate-pulse"></span>
              Live Sync
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
            <span className="font-label-caps text-xs uppercase tracking-wider font-semibold">Fleet Pass Accuracy</span>
            <span className="material-symbols-outlined text-[#D97757] text-xl">auto_fix_high</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-[#2D2926]">{avgSuccessRate}%</span>
            <span className="font-label-code-sm text-xs text-[#5B7C4B] font-semibold">Backend Synced</span>
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
                  {activeCount} active · {standbyCount} standby
                </span>
              </div>
              <span className="font-label-code-sm text-xs text-[#6B625B]">Connected to Flask REST API</span>
            </div>

            {/* Dynamic Agent List */}
            <div className="space-y-3">
              {agentList.map((agent) => {
                const isSelected = selectedAgent?.id === agent.id;
                const isOnline = agent.status === 'active' || agent.status === 'processing';

                return (
                  <div
                    key={agent.id}
                    onClick={() => setSelectedAgentName(agent.name)}
                    className={`p-space-base rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#F9ECE7]/40 border-[#D97757] shadow-sm'
                        : 'bg-white border-[#E5DED6] hover:shadow-md'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-center text-[#D97757]">
                          <span className="material-symbols-outlined text-2xl">
                            {agent.role.toLowerCase().includes('sec')
                              ? 'shield'
                              : agent.role.toLowerCase().includes('test')
                              ? 'bug_report'
                              : agent.role.toLowerCase().includes('review')
                              ? 'rate_review'
                              : agent.role.toLowerCase().includes('deploy')
                              ? 'cloud_upload'
                              : 'smart_toy'}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-headline-sm text-sm font-bold text-[#2D2926]">{agent.name}</span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                                isOnline
                                  ? 'bg-[#F9ECE7] border-[#D97757]/30 text-[#99462A]'
                                  : 'bg-[#FAF7F3] border-[#E5DED6] text-[#6B625B]'
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  isOnline ? 'bg-[#D97757] animate-pulse' : 'bg-[#A89F99]'
                                }`}
                              />
                              {agent.status.toUpperCase()}
                            </span>
                          </div>
                          <span className="font-mono text-xs text-[#6B625B]">
                            {agent.role} · Backend: {agent.modelBackend || 'Claude 3.7 Sonnet / Gemini 1.5 Pro'}
                          </span>
                        </div>
                      </div>

                      {/* Status Toggle Buttons */}
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={agent.status}
                          onChange={(e) => handleStatusChange(agent.id, e.target.value as AgentStatus)}
                          className="px-2.5 py-1 rounded bg-[#FAF7F3] border border-[#E5DED6] hover:bg-[#F2EDE6] text-xs font-medium text-[#2D2926] focus:outline-none cursor-pointer"
                        >
                          <option value="active">Active</option>
                          <option value="processing">Processing</option>
                          <option value="standby">Standby</option>
                          <option value="idle">Idle</option>
                        </select>
                      </div>
                    </div>

                    <p className="text-xs text-[#6B625B] leading-relaxed mb-3">
                      {agent.capability}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] text-xs">
                      <div>
                        <span className="text-[10px] text-[#8F857D] uppercase font-semibold block">Pass Rate</span>
                        <span className="font-semibold text-[#99462A]">{agent.successRate}%</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#8F857D] uppercase font-semibold block">Tasks Handled</span>
                        <span className="font-semibold text-[#2D2926]">{agent.tasksCompleted}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#8F857D] uppercase font-semibold block">Host Runner</span>
                        <span className="font-semibold text-[#6B625B] truncate block">{agent.hostRunner || 'k8s-worker-01'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#8F857D] uppercase font-semibold block">Last Seen</span>
                        <span className="font-semibold text-[#2D2926]">{agent.lastSeen}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                <h3 className="font-headline-sm font-bold text-sm text-[#2D2926]">Selected Agent Focus</h3>
              </div>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#FAF7F3] border border-[#E5DED6] text-[#99462A]">
                {selectedAgent?.id || 'agent-001'}
              </span>
            </div>

            <div className="p-space-md rounded-xl bg-[#201B18] font-mono text-xs text-[#EDE7E3] space-y-2 max-h-96 overflow-y-auto">
              <div className="text-[#8F857D]">
                <span className="text-[#D97757]">Active Target:</span> {selectedAgent?.name}
              </div>
              <div className="p-1.5 rounded bg-[#2D2622] text-[#EDE7E3]">
                <span className="text-[#D97757]">Role:</span> {selectedAgent?.role}
              </div>
              <div className="p-1.5 rounded bg-[#2D2622] text-[#EDE7E3]">
                <span className="text-[#D97757]">Current Task:</span> {selectedAgent?.currentTask || 'Idle / Queue listener'}
              </div>
              <div className="p-1.5 rounded bg-[#D97757]/20 border border-[#D97757]/40 text-[#FED7AA]">
                <span className="text-[#D97757]">Capability:</span> {selectedAgent?.capability}
              </div>
              <div className="pl-4 text-[11px] text-[#A89F99] flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-[#5B7C4B]">check_circle</span>
                <span>Security Clearance: Autonomous Level 4</span>
              </div>
              <div className="p-1.5 rounded bg-[#2D2622] text-[#EDE7E3]">
                <span className="text-[#D97757]">Success Rate:</span> {selectedAgent?.successRate}%
              </div>
              <div className="pt-1 text-[#86efac] font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">done_all</span>
                <span>Tasks Completed: {selectedAgent?.tasksCompleted}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#E5DED6] flex justify-between font-mono text-xs text-[#6B625B]">
              <span>Status: <strong className="text-[#2D2926]">{selectedAgent?.status}</strong></span>
              <span>Host: <strong className="text-[#2D2926]">{selectedAgent?.hostRunner || 'k8s-pod'}</strong></span>
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
                  <div className="font-semibold text-[#2D2926]">payment-service: stripe-node v14 fix</div>
                  <div className="text-[#6B625B] text-[11px]">Assigned to: Resolver-β / Patcher-γ</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#F9ECE7] text-[#99462A] font-semibold text-[10px]">
                  P1 HIGH
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#2D2926]">inventory-api: alpine 3.19 bump</div>
                  <div className="text-[#6B625B] text-[11px]">Assigned to: Scanner-ζ</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#FAF7F3] text-[#6B625B] font-semibold text-[10px]">
                  P2 NORMAL
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#2D2926]">order-service: flaky grpc retry</div>
                  <div className="text-[#6B625B] text-[11px]">Assigned to: Sentinel-α</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#FAF7F3] text-[#6B625B] font-semibold text-[10px]">
                  P3 LOW
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Deploy Agent Pod Modal */}
      {showDeployModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-[#E5DED6] shadow-2xl max-w-lg w-full p-4 sm:p-space-lg space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#E5DED6] pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D97757]">smart_toy</span>
                <h3 className="font-bold text-base text-[#2D2926]">Deploy New AI Agent Pod</h3>
              </div>
              <button
                onClick={() => setShowDeployModal(false)}
                className="text-[#6B625B] hover:text-[#2D2926] cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleDeployPod} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#2D2926] mb-1">Agent Pod Identifier</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CanaryGuard-v3, Snyk-Patcher"
                  value={newPodName}
                  onChange={(e) => setNewPodName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#E5DED6] bg-[#FAF7F3] focus:bg-white focus:outline-none focus:border-[#D97757]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#2D2926] mb-1">Specialization / Role</label>
                <select
                  value={newPodRole}
                  onChange={(e) => setNewPodRole(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#E5DED6] bg-[#FAF7F3] focus:bg-white focus:outline-none focus:border-[#D97757]"
                >
                  <option value="Autonomous RCA & Healing">Autonomous RCA & Healing</option>
                  <option value="Security Scanning & CVE Patching">Security Scanning & CVE Patching</option>
                  <option value="Test Generation & Flake Isolation">Test Generation & Flake Isolation</option>
                  <option value="Canary Delivery & Rollback Guard">Canary Delivery & Rollback Guard</option>
                  <option value="Code Review & Policy Audit">Code Review & Policy Audit</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#2D2926] mb-1">Model Inference Backend</label>
                <select
                  value={newPodModel}
                  onChange={(e) => setNewPodModel(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#E5DED6] bg-[#FAF7F3] focus:bg-white focus:outline-none focus:border-[#D97757]"
                >
                  <option value="Claude 3.7 Sonnet (Hybrid CoT)">Claude 3.7 Sonnet (Hybrid CoT)</option>
                  <option value="Gemini 1.5 Pro (2M Token Context)">Gemini 1.5 Pro (2M Token Context)</option>
                  <option value="DevOps-LLM v2.4 (Self-Hosted H100)">DevOps-LLM v2.4 (Self-Hosted H100)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#2D2926] mb-1">Capability Description</label>
                <textarea
                  rows={2}
                  value={newPodCapability}
                  onChange={(e) => setNewPodCapability(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#E5DED6] bg-[#FAF7F3] focus:bg-white focus:outline-none focus:border-[#D97757]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#E5DED6]">
                <button
                  type="button"
                  onClick={() => setShowDeployModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#E5DED6] text-[#6B625B] hover:bg-[#FAF7F3]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeploying || !newPodName.trim()}
                  className="px-5 py-2 rounded-lg bg-[#D97757] hover:bg-[#B85D3E] text-white font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isDeploying ? 'Deploying to Cluster...' : 'Deploy to Flask Backend'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
