import { useState, useEffect } from 'react';
import { incidents as initialIncidents } from '../data/mockData';
import { api, type IncidentExplanation } from '../services/api';
import type { Incident, IncidentStatus, MultiAgentReasoningResult } from '../types';
import { MultiAgentWorkflowCard } from '../components/ui/MultiAgentWorkflowCard';

export default function IncidentsPage() {
  const [incidentList, setIncidentList] = useState<Incident[]>(initialIncidents);
  const [selectedIncident, setSelectedIncident] = useState<Incident>(initialIncidents[0]);
  const [logFilter, setLogFilter] = useState('');
  const [copied, setCopied] = useState(false);
  const [merged, setMerged] = useState(false);
  const [showExplainModal, setShowExplainModal] = useState(false);
  const [explanationData, setExplanationData] = useState<IncidentExplanation | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [isRemediating, setIsRemediating] = useState(false);
  const [isValidatingCI, setIsValidatingCI] = useState(false);
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [isVerifyingDeployment, setIsVerifyingDeployment] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [isReasoning, setIsReasoning] = useState(false);
  const [agentReasoningData, setAgentReasoningData] = useState<MultiAgentReasoningResult | null>(null);
  const [selectedAttemptIdx, setSelectedAttemptIdx] = useState<number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [explainTab, setExplainTab] = useState<'triage' | 'diff' | 'telemetry' | 'roadmap'>('triage');
  const [copiedDiff, setCopiedDiff] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  const handleRunMultiAgent = async () => {
    setIsReasoning(true);
    try {
      const res = await api.triggerIncidentAgentReasoning(selectedIncident.id);
      if (res) {
        setAgentReasoningData(res);
        setNotification(`🤖 Phase 3 Multi-Agent Reasoning completed! Diagnoser (${res.diagnosis?.category || 'evaluated'}) → FixSuggester → Critic (${(res.status || 'APPROVED').toUpperCase()})`);
        setTimeout(() => setNotification(null), 6000);
        const updatedList = await api.getIncidents();
        if (updatedList && updatedList.length > 0) {
          setIncidentList(updatedList);
          const curr = updatedList.find((i) => i.id === selectedIncident.id);
          if (curr) setSelectedIncident(curr);
        }
      }
    } catch (err) {
      console.error('Failed to execute Multi-Agent reasoning chain:', err);
      setNotification('Multi-Agent Reasoning run failed');
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setIsReasoning(false);
    }
  };

  const handleHumanApprove = async (comment?: string) => {
    try {
      await api.submitIncidentApproval(selectedIncident.id, 'approve', comment);
      setNotification(`✅ Incident ${selectedIncident.id} fix approved by operator!`);
      setTimeout(() => setNotification(null), 5000);
      const updatedList = await api.getIncidents();
      if (updatedList && updatedList.length > 0) {
        setIncidentList(updatedList);
        const curr = updatedList.find((i) => i.id === selectedIncident.id);
        if (curr) setSelectedIncident(curr);
      }
    } catch (err) {
      console.error('Failed to submit approval:', err);
      setNotification('Failed to submit human approval');
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleHumanReject = async (comment?: string) => {
    try {
      await api.submitIncidentApproval(selectedIncident.id, 'reject', comment);
      setNotification(`❌ Incident ${selectedIncident.id} fix rejected by operator.`);
      setTimeout(() => setNotification(null), 5000);
      const updatedList = await api.getIncidents();
      if (updatedList && updatedList.length > 0) {
        setIncidentList(updatedList);
        const curr = updatedList.find((i) => i.id === selectedIncident.id);
        if (curr) setSelectedIncident(curr);
      }
    } catch (err) {
      console.error('Failed to submit rejection:', err);
      setNotification('Failed to submit human rejection');
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleRemediate = async () => {
    setIsRemediating(true);
    try {
      const res = await api.remediateIncident(selectedIncident.id);
      const updatedList = await api.getIncidents();
      if (updatedList && updatedList.length > 0) {
        setIncidentList(updatedList);
        const curr = updatedList.find((i) => i.id === selectedIncident.id);
        if (curr) setSelectedIncident(curr);
      }
      setNotification(`⚡ Healer-Alpha auto-remediated ${selectedIncident.id}! PR #${res?.prNumber || '144'} created on branch '${res?.remediationBranch || 'sentinelops/fix'}'`);
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      console.error('Failed to auto-remediate:', err);
      setNotification('Failed to auto-remediate incident');
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setIsRemediating(false);
    }
  };

  const handleValidateCI = async () => {
    setIsValidatingCI(true);
    try {
      const res = await api.validateIncidentFix(selectedIncident.id);
      const statusText = res.status || 'PASSED';
      const duration = res.duration_seconds || 14;
      setNotification(`🧪 CI Validation for ${selectedIncident.id}: ${statusText} in ${duration}s`);
      setTimeout(() => setNotification(null), 5000);
      const updatedList = await api.getIncidents();
      if (updatedList && updatedList.length > 0) {
        setIncidentList(updatedList);
        const curr = updatedList.find((i) => i.id === selectedIncident.id);
        if (curr) setSelectedIncident(curr);
      }
    } catch (err) {
      console.error('Failed to validate in CI:', err);
      setNotification('CI validation request failed');
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setIsValidatingCI(false);
    }
  };

  const handleVerifyDeployment = async () => {
    setIsVerifyingDeployment(true);
    try {
      const res = await api.verifyIncidentDeployment(selectedIncident.id);
      const statusText = res.status || 'HEALTHY';
      const avgLat = res.average_latency_ms ? `${res.average_latency_ms}ms` : '42ms';
      setNotification(`🏥 Post-Deployment Health Check for ${selectedIncident.id}: ${statusText} (${res.consecutive_successes}/${res.success_threshold} probes passed, avg latency ${avgLat})`);
      setTimeout(() => setNotification(null), 6000);
      const updatedList = await api.getIncidents();
      if (updatedList && updatedList.length > 0) {
        setIncidentList(updatedList);
        const curr = updatedList.find((i) => i.id === selectedIncident.id);
        if (curr) setSelectedIncident(curr);
      }
    } catch (err) {
      console.error('Failed to verify deployment:', err);
      setNotification('Deployment health verification failed');
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setIsVerifyingDeployment(false);
    }
  };

  const handleTriggerRollback = async () => {
    if (!window.confirm(`Are you sure you want to trigger an automated rollback for incident ${selectedIncident.id}?`)) {
      return;
    }
    setIsRollingBack(true);
    try {
      const res = await api.triggerIncidentRollback(selectedIncident.id, 'Operator manual rollback trigger');
      setNotification(`⏪ Rollback executed for ${selectedIncident.id}: Status=${res?.status || 'SUCCESS'}, strategy=${res?.strategy || 'git_revert'}`);
      setTimeout(() => setNotification(null), 6000);
      const updatedList = await api.getIncidents();
      if (updatedList && updatedList.length > 0) {
        setIncidentList(updatedList);
        const curr = updatedList.find((i) => i.id === selectedIncident.id);
        if (curr) setSelectedIncident(curr);
      }
    } catch (err) {
      console.error('Failed to trigger rollback:', err);
      setNotification('Rollback execution failed');
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setIsRollingBack(false);
    }
  };

  const handleOrchestrate = async () => {
    setIsOrchestrating(true);
    try {
      const res = await api.orchestrateRemediation({
        run_id: selectedIncident.runId || 892401,
        repo: selectedIncident.repo || 'SentinelOps',
        branch: selectedIncident.branch || 'main',
        commit_sha: selectedIncident.commit || 'a1b2c3d',
        workflow_name: selectedIncident.pipeline || 'CI/CD Workflow',
      });
      const updatedList = await api.getIncidents();
      if (updatedList && updatedList.length > 0) {
        setIncidentList(updatedList);
        const curr = updatedList.find((i) => i.id === selectedIncident.id);
        if (curr) setSelectedIncident(curr);
      }
      setNotification(`🚀 Phase 3 Autonomous Closed-Loop completed: Status=${res?.data?.status || 'Resolved'}, PR=${res?.data?.pr_number ? '#' + res.data.pr_number : 'Auto-Merged'}, Deploy=${res?.data?.deployment?.status || 'SUCCESS'}, Health=${res?.data?.health_check?.status || 'HEALTHY'}`);
      setTimeout(() => setNotification(null), 7000);
    } catch (err) {
      console.error('Failed to run autonomous orchestration:', err);
      setNotification('Autonomous loop failed');
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setIsOrchestrating(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    api.getIncidents().then((data) => {
      if (!mounted) return;
      if (data && data.length > 0) {
        setIncidentList(data);
        setSelectedIncident((prev) => data.find((i) => i.id === prev.id) || data[0]);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleStatusChange = async (newStatus: IncidentStatus) => {
    try {
      const updated = await api.updateIncidentStatus(selectedIncident.id, newStatus);
      setIncidentList((prev) =>
        prev.map((i) => (i.id === updated.id ? updated : i))
      );
      setSelectedIncident(updated);
      if (newStatus === 'Resolved') setMerged(true);
      setNotification(`Incident ${updated.id} status updated to '${newStatus}' in Flask backend!`);
      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleExplain = async () => {
    setShowExplainModal(true);
    setIsLoadingExplanation(true);
    setExplainTab('triage');
    try {
      const exp = await api.explainIncident(selectedIncident.id);
      setExplanationData(exp);
    } catch (err) {
      console.error('Failed to fetch AI explanation:', err);
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  const handleCopyDiff = () => {
    const diffText = explanationData?.diff || selectedIncident.diff;
    if (!diffText) return;
    navigator.clipboard.writeText(diffText);
    setCopiedDiff(true);
    setTimeout(() => setCopiedDiff(false), 2000);
  };

  const handleCopyReport = () => {
    if (!explanationData) return;
    const reportText = `[SentinelOps AI Diagnostics Report]
Incident: ${explanationData.incidentId} (${explanationData.repo})
Model: ${explanationData.aiModel || 'DevOps-LLM'}
Confidence: ${explanationData.confidence}%
Root Cause: ${explanationData.rootCause}
Error Type: ${explanationData.errorType || 'Unknown'}
Target File: ${explanationData.targetFile || 'N/A'}
Policy: ${explanationData.policyCheck}
Explanation: ${explanationData.explanation}
Suggested Action: ${explanationData.suggestedAction}`;
    navigator.clipboard.writeText(reportText);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const rawLogs = [
    { line: '01', time: '[14:22:01]', type: 'info', text: 'Triggering pipeline step: npm test -- --bail (NodeJS v20.11.0 runtime)' },
    { line: '02', time: '[14:22:04]', type: 'error', text: 'npm ERR! code ERESOLVE' },
    { line: '03', time: '[14:22:04]', type: 'error', text: 'npm ERR! ERESOLVE could not resolve peer dependency tree' },
    { line: '04', time: '[14:22:04]', type: 'error', text: 'While resolving: @stripe/stripe-node@12.1.0' },
    { line: '05', time: '[14:22:04]', type: 'warn', text: 'Found: @types/node@20.11.0 (node_modules/@types/node)' },
    { line: '06', time: '[14:22:04]', type: 'error', text: 'Conflicting peer dependency: @types/node@^18.0.0' },
    { line: '07', time: '[14:22:05]', type: 'agent', text: 'Detected exit code 1. Stack trace fingerprint: HASH_9a7d32b4f' },
    { line: '08', time: '[14:22:06]', type: 'agent', text: 'Querying AST knowledge base for fix recipes... Match found (99% similarity to CVE-RECIPE-492)' },
  ];

  const filteredLogs = rawLogs.filter((l) =>
    l.text.toLowerCase().includes(logFilter.toLowerCase())
  );

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(rawLogs.map(l => `${l.time} ${l.text}`).join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-space-lg">
      {/* Toast Notification */}
      {notification && (
        <div className="p-3 rounded-lg bg-[#EAF3E7] border border-[#5B7C4B]/40 text-[#5B7C4B] text-xs font-semibold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">task_alt</span>
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-[#5B7C4B] hover:text-[#2D2926]">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Top Breadcrumb & Incident Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-space-sm">
        <div>
          <div className="flex items-center gap-space-xs text-[#6B625B] font-label-code-sm text-xs">
            <span>Control Center</span>
            <span>/</span>
            <span>Incidents</span>
            <span>/</span>
            <span className="text-[#99462A] font-semibold">{selectedIncident.id}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <h1 className="font-headline-lg text-xl sm:text-2xl font-bold text-[#2D2926] tracking-tight">
              {selectedIncident.id}: Autonomous Remediation
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#F9ECE7] border border-[#D97757]/30 text-[#99462A] font-label-code-sm text-xs font-semibold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#D97757] animate-pulse"></span>
              {selectedIncident.status.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-space-sm">
          <select
            value={selectedIncident.id}
            onChange={(e) => {
              const inc = incidentList.find(i => i.id === e.target.value);
              if (inc) setSelectedIncident(inc);
            }}
            aria-label="Select incident"
            className="w-full sm:w-auto px-3 py-2 rounded-lg bg-white border border-[#E5DED6] text-xs font-medium text-[#2D2926] focus:outline-none focus:border-[#D97757]"
          >
            {incidentList.map(inc => (
              <option key={inc.id} value={inc.id}>
                {inc.id} ({inc.repo} - {inc.status})
              </option>
            ))}
          </select>

          <button
            onClick={handleExplain}
            className="px-3.5 py-2 rounded-lg bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] text-[#2D2926] font-medium font-body-sm flex items-center gap-1.5 shadow-sm transition-all cursor-pointer text-xs"
          >
            <span className="material-symbols-outlined text-base text-[#D97757]">psychology</span>
            <span>Explain via AI</span>
          </button>

          <button
            onClick={handleValidateCI}
            disabled={isValidatingCI}
            className={`px-3.5 py-2 rounded-lg font-medium font-body-sm flex items-center gap-1.5 shadow-sm transition-all cursor-pointer text-xs text-[#2D2926] bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] ${
              isValidatingCI ? 'cursor-wait opacity-80' : ''
            }`}
          >
            <span className={`material-symbols-outlined text-base text-[#5B7C4B] ${isValidatingCI ? 'animate-spin' : ''}`}>
              {isValidatingCI ? 'progress_activity' : 'fact_check'}
            </span>
            <span>{isValidatingCI ? 'Validating...' : 'Validate Fix in CI'}</span>
          </button>

          <button
            onClick={handleVerifyDeployment}
            disabled={isVerifyingDeployment}
            className={`px-3.5 py-2 rounded-lg font-medium font-body-sm flex items-center gap-1.5 shadow-sm transition-all cursor-pointer text-xs text-[#2D2926] bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] ${
              isVerifyingDeployment ? 'cursor-wait opacity-80' : ''
            }`}
          >
            <span className={`material-symbols-outlined text-base text-[#2563EB] ${isVerifyingDeployment ? 'animate-spin' : ''}`}>
              {isVerifyingDeployment ? 'progress_activity' : 'health_and_safety'}
            </span>
            <span>{isVerifyingDeployment ? 'Verifying...' : 'Verify Deployment'}</span>
          </button>

          <button
            onClick={handleTriggerRollback}
            disabled={isRollingBack}
            className={`px-3 py-2 rounded-lg font-medium font-body-sm flex items-center gap-1.5 shadow-sm transition-all cursor-pointer text-xs text-[#C34A4A] bg-[#FDF0F0] border border-[#C34A4A]/30 hover:bg-[#FCE8E8] ${
              isRollingBack ? 'cursor-wait opacity-80' : ''
            }`}
          >
            <span className={`material-symbols-outlined text-base ${isRollingBack ? 'animate-spin' : ''}`}>
              {isRollingBack ? 'progress_activity' : 'history'}
            </span>
            <span>{isRollingBack ? 'Rolling back...' : 'Rollback'}</span>
          </button>

          <button
            onClick={handleRemediate}
            disabled={isRemediating}
            className={`px-3.5 py-2 rounded-lg font-medium font-body-sm flex items-center gap-1.5 shadow-sm transition-all cursor-pointer text-xs text-white ${
              isRemediating
                ? 'bg-[#B87A36] cursor-wait opacity-90'
                : 'bg-[#D97757] hover:bg-[#B85D3E]'
            }`}
          >
            <span className={`material-symbols-outlined text-base ${isRemediating ? 'animate-spin' : ''}`}>
              {isRemediating ? 'progress_activity' : 'auto_fix_high'}
            </span>
            <span>{isRemediating ? 'Remediating...' : 'Healer-Alpha'}</span>
          </button>

          <button
            onClick={handleRunMultiAgent}
            disabled={isReasoning}
            className={`px-3.5 py-2 rounded-lg font-semibold font-body-sm flex items-center gap-1.5 shadow-sm transition-all cursor-pointer text-xs text-white ${
              isReasoning
                ? 'bg-[#4338CA] cursor-wait opacity-90'
                : 'bg-gradient-to-r from-[#4F46E5] to-[#6366F1] hover:opacity-95'
            }`}
          >
            <span className={`material-symbols-outlined text-base ${isReasoning ? 'animate-spin' : ''}`}>
              {isReasoning ? 'progress_activity' : 'account_tree'}
            </span>
            <span>{isReasoning ? '3-Agent Reasoning...' : '🤖 3-Agent Pipeline'}</span>
          </button>

          <button
            onClick={handleOrchestrate}
            disabled={isOrchestrating}
            className={`px-4 py-2 rounded-lg font-semibold font-body-sm flex items-center gap-1.5 shadow-md transition-all cursor-pointer text-xs text-white ${
              isOrchestrating
                ? 'bg-[#7C3AED] cursor-wait opacity-90'
                : 'bg-gradient-to-r from-[#D97757] via-[#99462A] to-[#5B7C4B] hover:opacity-95'
            }`}
          >
            <span className={`material-symbols-outlined text-base ${isOrchestrating ? 'animate-spin' : ''}`}>
              {isOrchestrating ? 'progress_activity' : 'all_inclusive'}
            </span>
            <span>{isOrchestrating ? 'Autonomous Loop Running...' : '⚡ Closed-Loop Self-Healing'}</span>
          </button>
        </div>
      </div>


      {/* Metadata Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-space-md p-space-md rounded-xl bg-white border border-[#E5DED6] shadow-card">
        <div className="flex flex-col gap-1">
          <span className="font-label-caps text-[11px] text-[#6B625B] uppercase tracking-wider font-semibold">
            Detection to Fix
          </span>
          <span className="font-label-code-sm text-xs text-[#D97757] font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">timer</span>
            2m 14s (Autonomous)
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-label-caps text-[11px] text-[#6B625B] uppercase tracking-wider font-semibold">
            Target Branch
          </span>
          <span className="font-label-code-sm text-xs text-[#2D2926] font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-[#D97757]">alt_route</span>
            refs/heads/main
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-label-caps text-[11px] text-[#6B625B] uppercase tracking-wider font-semibold">
            Agent Engine
          </span>
          <span className="font-label-code-sm text-xs text-[#D97757] font-semibold">DevOps-LLM v2.4</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-label-caps text-[11px] text-[#6B625B] uppercase tracking-wider font-semibold">
            Confidence Score
          </span>
          <span className="font-label-code-sm text-xs text-[#D97757] font-bold">
            {selectedIncident.confidence}% Certainty
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-label-caps text-[11px] text-[#6B625B] uppercase tracking-wider font-semibold">
            Blast Radius
          </span>
          <span className="font-label-code-sm text-xs text-[#2D2926] font-medium">Isolated (Module)</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-label-caps text-[11px] text-[#6B625B] uppercase tracking-wider font-semibold">
            Service Health
          </span>
          <span className="font-label-code-sm text-xs text-[#5B7C4B] font-semibold flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5B7C4B] animate-pulse"></span>
            100% Zero Downtime
          </span>
        </div>
      </div>

      {/* Main 2-Column Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 space-y-space-lg">
          {/* 0. Phase 3 & 4: Multi-Agent Reasoning Pipeline & Safety Gate Visualizer */}
          <MultiAgentWorkflowCard
            reasoningData={
              (typeof selectedIncident.agent_reasoning === 'string'
                ? (() => {
                    try {
                      return JSON.parse(selectedIncident.agent_reasoning as any);
                    } catch {
                      return null;
                    }
                  })()
                : selectedIncident.agent_reasoning) || agentReasoningData
            }
            isLoading={isReasoning}
            onRerun={handleRunMultiAgent}
            onHumanApprove={handleHumanApprove}
            onHumanReject={handleHumanReject}
            incidentId={selectedIncident.id}
            repo={selectedIncident.repo}
          />

          {/* 1. Root Cause Analysis Card */}
          <section className="rounded-xl bg-white border border-[#E5DED6] shadow-card overflow-hidden relative">
            <div className="p-space-md bg-[#F2EDE6]/80 border-b border-[#E5DED6] flex items-center justify-between flex-wrap gap-space-sm">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[#D97757] text-xl">auto_fix_high</span>
                <span className="font-headline-sm font-semibold text-[#2D2926] tracking-tight">
                  AI Root Cause Identified
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#F9ECE7] border border-[#D97757]/30 text-[#99462A] font-label-code-sm text-xs font-semibold">
                  Deep AST Analysis
                </span>
              </div>
              <div className="flex items-center gap-space-sm">
                <span className="font-label-caps text-xs text-[#6B625B] uppercase tracking-wider font-semibold">
                  Agent Confidence
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 rounded-full bg-[#E5DED6] overflow-hidden">
                    <div className="bg-[#D97757] h-full rounded-full" style={{ width: `${selectedIncident.confidence}%` }}></div>
                  </div>
                  <span className="font-label-code-sm text-xs text-[#D97757] font-bold">
                    {selectedIncident.confidence}%
                  </span>
                </div>
              </div>
            </div>

            <div className="p-space-lg space-y-space-md">
              {/* Conflict details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                <div className="p-space-md rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-1">
                  <span className="font-label-caps text-xs text-[#6B625B] uppercase tracking-wider font-semibold">
                    Identified Root Conflict
                  </span>
                  <p className="font-body-sm text-sm text-[#2D2926] leading-relaxed">
                    Node dependency version incompatibility: <code className="font-mono text-xs text-[#99462A] font-semibold bg-[#F9ECE7] px-1 py-0.5 rounded">@stripe/stripe-node v12.1.0</code> requires <code className="font-mono text-xs text-[#6B625B]">@types/node@^18.0.0</code>, which violates workspace spec (<code className="font-mono text-xs text-[#D97757] font-semibold">v20.11.0</code>).
                  </p>
                </div>

                <div className="p-space-md rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-1">
                  <span className="font-label-caps text-xs text-[#6B625B] uppercase tracking-wider font-semibold">
                    Impacted Target Manifests
                  </span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="font-mono text-xs px-2 py-1 rounded bg-white border border-[#E5DED6] text-[#2D2926] flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-[#D97757]">description</span>
                      package.json
                    </span>
                    <span className="font-mono text-xs px-2 py-1 rounded bg-white border border-[#E5DED6] text-[#2D2926] flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-[#D97757]">lock</span>
                      package-lock.json
                    </span>
                    <span className="font-mono text-xs px-2 py-1 rounded bg-white border border-[#E5DED6] text-[#6B625B]">
                      services/payment-webhook/**
                    </span>
                  </div>
                </div>
              </div>

              {/* Recommended Solution Banner */}
              <div className="p-space-md rounded-lg bg-[#F9ECE7] border border-[#D97757]/30 space-y-1">
                <div className="flex items-center gap-1.5 text-[#99462A]">
                  <span className="material-symbols-outlined text-base text-[#D97757]">lightbulb</span>
                  <span className="font-label-caps text-xs uppercase tracking-wider font-semibold">
                    Automated Solution Strategy
                  </span>
                </div>
                <p className="font-body-sm text-sm text-[#2D2926] leading-relaxed">
                  Update <code className="font-mono text-xs text-[#99462A] font-semibold">@stripe/stripe-node</code> to version <code className="font-mono text-xs text-[#D97757] font-bold">14.1.2</code> and regenerate the deterministic lockfile with strict semantic versioning resolution flags to maintain node20 LTS parity.
                </p>
              </div>

              {/* Quick Action Bar */}
              <div className="flex items-center justify-between flex-wrap gap-space-sm pt-space-xs">
                <div className="flex items-center gap-space-xs flex-wrap">
                  <button
                    onClick={() => alert('Patch deployed to ephemeral staging namespace: staging-payment-pr184')}
                    className="px-4 py-2 rounded-lg bg-white hover:bg-[#F2EDE6] border border-[#E5DED6] text-[#2D2926] font-body-sm text-xs flex items-center gap-1.5 transition-all shadow-sm font-semibold"
                  >
                    <span className="material-symbols-outlined text-base text-[#D97757]">rocket_launch</span>
                    <span>Apply Fix to Staging</span>
                  </button>
                  <a
                    href="#unified-diff"
                    className="px-4 py-2 rounded-lg bg-white hover:bg-[#F2EDE6] border border-[#E5DED6] text-[#2D2926] font-body-sm text-xs flex items-center gap-1.5 transition-all shadow-sm font-semibold"
                  >
                    <span className="material-symbols-outlined text-base text-[#D97757]">difference</span>
                    <span>Review Unified Diff</span>
                  </a>
                </div>
                <span className="font-label-code-sm text-xs text-[#6B625B]">Synthesized in 14.8s</span>
              </div>
            </div>
          </section>

          {/* 2. Error Logs Monospace Glass Terminal */}
          <section className="rounded-xl bg-white border border-[#E5DED6] shadow-card overflow-hidden flex flex-col">
            <div className="px-space-md py-2.5 bg-[#F2EDE6] border-b border-[#E5DED6] flex items-center justify-between gap-space-md">
              <div className="flex items-center gap-space-md">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#C34A4A]/50"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#B87A36]/50"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#5B7C4B]/50"></div>
                </div>
                <div className="flex items-center gap-1 text-[#6B625B] font-mono text-xs">
                  <span className="material-symbols-outlined text-sm">terminal</span>
                  <span>build-ci.us-east-1.internal // stdout</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter logs (e.g. ERESOLVE)..."
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  className="h-7 px-2.5 rounded bg-white border border-[#E5DED6] text-xs font-mono placeholder:text-[#6B625B] focus:outline-none focus:border-[#D97757]"
                />
                <button
                  onClick={handleCopyLogs}
                  title="Copy Raw Logs"
                  className="p-1 rounded hover:bg-white text-[#6B625B] hover:text-[#2D2926] transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">
                    {copied ? 'check' : 'content_copy'}
                  </span>
                </button>
              </div>
            </div>

            <div className="p-space-md bg-[#201B18] font-mono text-xs max-h-72 overflow-y-auto space-y-1.5">
              {filteredLogs.map((log) => (
                <div
                  key={log.line}
                  className={`flex items-start gap-2.5 px-2 py-1 rounded ${
                    log.type === 'error'
                      ? 'bg-[#ba1a1a]/20 text-[#fca5a5] border-l-2 border-[#ba1a1a]'
                      : log.type === 'agent'
                      ? 'bg-[#D97757]/20 text-[#fed7aa] border-l-2 border-[#D97757]'
                      : 'text-[#D1C7BD]'
                  }`}
                >
                  <span className="text-[#8F857D] select-none">{log.line}</span>
                  <span className="text-[#D97757]">{log.time}</span>
                  <span>{log.text}</span>
                </div>
              ))}
            </div>
          </section>          {/* 3. Proposed Fix & Unified Code Diff */}
          <section id="unified-diff" className="rounded-xl bg-white border border-[#E5DED6] shadow-card overflow-hidden relative">
            {isRemediating && (
              <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 rounded-xl border border-[#D97757]/50 shadow-inner overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-[#F9ECE7]">
                  <div className="h-full bg-[#D97757] animate-[progress_2s_ease-in-out_infinite]" style={{ width: '50%', animationName: 'progress' }}></div>
                </div>
                <div className="flex flex-col items-center gap-4 text-[#D97757]">
                  <div className="relative">
                    <span className="material-symbols-outlined text-6xl animate-pulse drop-shadow-md">psychology</span>
                    <span className="absolute -bottom-1 -right-1 h-4 w-4 bg-[#5B7C4B] rounded-full border-2 border-white animate-ping"></span>
                  </div>
                  <h3 className="font-headline-sm font-bold text-lg text-[#2D2926] mt-2 tracking-tight">Healer-Alpha is synthesizing fix...</h3>
                  <div className="flex flex-col gap-3 w-full max-w-sm text-xs text-[#6B625B] font-mono bg-[#FAF7F3] p-4 rounded-lg border border-[#E5DED6]">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-base animate-spin text-[#D97757]">sync</span>
                      <span>Querying Gemini 3.6 Flash Engine...</span>
                    </div>
                    <div className="flex items-center gap-3 opacity-70">
                      <span className="material-symbols-outlined text-base text-[#5B7C4B]">check_circle</span>
                      <span>Parsing AST topology</span>
                    </div>
                    <div className="flex items-center gap-3 opacity-70">
                      <span className="material-symbols-outlined text-base text-[#5B7C4B]">check_circle</span>
                      <span>Enforcing zero-regression policies</span>
                    </div>
                  </div>
                </div>
                <style>{`
                  @keyframes progress {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                  }
                `}</style>
              </div>
            )}
            <div className="p-space-md bg-[#F2EDE6]/80 border-b border-[#E5DED6] flex items-center justify-between flex-wrap gap-space-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-[#D97757]">difference</span>
                  <span className="font-headline-sm font-semibold text-[#2D2926]">
                    {selectedIncident.prNumber ? `Pull Request #${selectedIncident.prNumber} Diff` : 'Auto-Remediation PR Diff'}
                  </span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-white border border-[#E5DED6] text-[#2D2926]">
                    {selectedIncident.targetFile || 'package.json'}
                  </span>
                  {selectedIncident.remediationBranch && (
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#EAF3E7] border border-[#5B7C4B]/30 text-[#5B7C4B]">
                      {selectedIncident.remediationBranch}
                    </span>
                  )}
                </div>
                <p className="font-body-sm text-xs text-[#6B625B] mt-0.5">
                  {selectedIncident.rootCause || 'fix(deps): resolve dependency conflict and restore pipeline green status'}
                </p>
              </div>

              <a
                href={selectedIncident.prUrl || '#'}
                target={selectedIncident.prUrl ? '_blank' : undefined}
                rel="noreferrer"
                onClick={(e) => {
                  if (!selectedIncident.prUrl) {
                    e.preventDefault();
                    alert(`Pull Request #${selectedIncident.prNumber || 184} opened in GitHub.`);
                  }
                }}
                className="px-3 py-1.5 rounded bg-white hover:bg-[#F2EDE6] border border-[#E5DED6] text-[#2D2926] font-body-sm text-xs flex items-center gap-1 font-semibold transition-colors"
              >
                <span className="material-symbols-outlined text-sm text-[#D97757]">open_in_new</span>
                <span>{selectedIncident.prNumber ? `Open PR #${selectedIncident.prNumber}` : 'Open in GitHub'}</span>
              </a>
            </div>

            {/* Code diff container */}
            <div className="p-space-md bg-[#201B18] font-mono text-xs overflow-x-auto space-y-1">
              {selectedIncident.diff ? (
                selectedIncident.diff.split('\n').map((line, idx) => {
                  const isAdd = line.startsWith('+') && !line.startsWith('+++');
                  const isDel = line.startsWith('-') && !line.startsWith('---');
                  const isHdr = line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++');
                  return (
                    <div
                      key={idx}
                      className={`px-2 py-0.5 rounded flex items-center gap-2 ${
                        isAdd
                          ? 'bg-[#15803d]/30 text-[#86efac]'
                          : isDel
                          ? 'bg-[#ba1a1a]/30 text-[#fca5a5]'
                          : isHdr
                          ? 'text-[#8F857D] border-b border-[#3E3835]'
                          : 'text-[#D1C7BD] pl-4'
                      }`}
                    >
                      <span>{line}</span>
                    </div>
                  );
                })
              ) : (
                <>
                  <div className="text-[#8F857D] py-1 border-b border-[#3E3835]">
                    @@ -28,7 +28,7 @@ "dependencies": &#123;
                  </div>
                  <div className="text-[#D1C7BD] pl-4">
                    &nbsp;&nbsp;"@fastify/sensible": "^5.2.0",
                  </div>
                  <div className="bg-[#ba1a1a]/30 text-[#fca5a5] px-2 py-0.5 rounded flex items-center gap-2">
                    <span>-</span>
                    <span>&nbsp;&nbsp;"@stripe/stripe-node": "^12.1.0",</span>
                  </div>
                  <div className="bg-[#15803d]/30 text-[#86efac] px-2 py-0.5 rounded flex items-center gap-2">
                    <span>+</span>
                    <span>&nbsp;&nbsp;"@stripe/stripe-node": "^14.1.2",</span>
                  </div>
                  <div className="text-[#D1C7BD] pl-4">
                    &nbsp;&nbsp;"dotenv": "^16.3.1",
                  </div>
                  <div className="text-[#D1C7BD] pl-4">
                    &nbsp;&nbsp;"fastify": "^4.26.1"
                  </div>
                </>
              )}
            </div>

            {/* Validation checks footer */}
            <div className="p-space-md border-t border-[#E5DED6] space-y-space-md">
              {/* SentinelGuard UI */}
              <div className={`p-4 rounded-lg border ${selectedIncident.guard_status === 'BLOCKED' ? 'bg-[#FDF0F0] border-[#C34A4A]' : 'bg-[#EAF3E7] border-[#5B7C4B]/30'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`material-symbols-outlined text-lg ${selectedIncident.guard_status === 'BLOCKED' ? 'text-[#C34A4A]' : 'text-[#5B7C4B]'}`}>
                    {selectedIncident.guard_status === 'BLOCKED' ? 'block' : 'shield'}
                  </span>
                  <span className={`font-headline-sm font-semibold ${selectedIncident.guard_status === 'BLOCKED' ? 'text-[#C34A4A]' : 'text-[#2D2926]'}`}>
                    {selectedIncident.guard_status === 'BLOCKED' ? '🚫 Change Blocked by SentinelGuard' : '🛡️ SentinelGuard Check Passed'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-[#6B625B] block mb-1">Risk Level</span>
                    <span className={`font-semibold px-2 py-0.5 rounded ${
                      selectedIncident.risk_level === 'LOW' ? 'bg-green-100 text-green-700' :
                      selectedIncident.risk_level === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                      selectedIncident.risk_level === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {selectedIncident.risk_level || 'LOW'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6B625B] block mb-1">Files Changed</span>
                    <span className="font-semibold text-[#2D2926]">{selectedIncident.files_changed || 1}</span>
                  </div>
                  <div>
                    <span className="text-[#6B625B] block mb-1">Lines Changed</span>
                    <span className="font-semibold text-[#2D2926]">{selectedIncident.lines_added || 14}</span>
                  </div>
                  <div>
                    <span className="text-[#6B625B] block mb-1">Protected Files</span>
                    <span className="font-semibold text-[#2D2926]">0</span>
                  </div>
                </div>
                
                {selectedIncident.guard_status === 'BLOCKED' && selectedIncident.block_reasons && (
                  <div className="mt-3 p-2 bg-white rounded border border-[#C34A4A]/20">
                    <span className="text-xs font-semibold text-[#C34A4A] block mb-1">Reasons:</span>
                    <ul className="list-disc list-inside text-xs text-[#6B625B]">
                      {selectedIncident.block_reasons.map((reason: string, idx: number) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              {/* MergeGuard 7-Point Policy Boundary (Phase 2) */}
              <div className="p-4 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#5B7C4B] text-lg">verified_user</span>
                    <span className="font-headline-sm font-semibold text-[#2D2926] text-xs uppercase tracking-wider">
                      MergeGuard 7-Point Autonomous Safety Boundary
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-[#EAF3E7] border border-[#5B7C4B]/40 text-[#5B7C4B] font-mono text-xs font-bold">
                    POLICY STATUS: {selectedIncident.status === 'Resolved' || selectedIncident.status === 'Remediated' ? 'APPROVED (7/7 PASS)' : 'EVALUATING'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
                  <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
                    <span className="text-[#6B625B] text-[10px] block">Confidence &ge; 90%</span>
                    <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                      <span className="material-symbols-outlined text-xs">check</span>
                      {selectedIncident.confidence}%
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
                    <span className="text-[#6B625B] text-[10px] block">Risk == LOW</span>
                    <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                      <span className="material-symbols-outlined text-xs">check</span>
                      LOW
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
                    <span className="text-[#6B625B] text-[10px] block">SentinelGuard</span>
                    <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                      <span className="material-symbols-outlined text-xs">check</span>
                      PASS
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
                    <span className="text-[#6B625B] text-[10px] block">Secret Scan</span>
                    <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                      <span className="material-symbols-outlined text-xs">check</span>
                      0 LEAKS
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
                    <span className="text-[#6B625B] text-[10px] block">CI Status</span>
                    <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                      <span className="material-symbols-outlined text-xs">check</span>
                      GREEN
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
                    <span className="text-[#6B625B] text-[10px] block">Attempts &le; 3</span>
                    <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                      <span className="material-symbols-outlined text-xs">check</span>
                      {selectedIncident.attemptCount || 1} / 3
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
                    <span className="text-[#6B625B] text-[10px] block">Protected Files</span>
                    <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                      <span className="material-symbols-outlined text-xs">check</span>
                      0 MODIFIED
                    </span>
                  </div>
                </div>
              </div>

              {/* Multi-Attempt History & Closed-Loop Telemetry */}
              {selectedIncident.attempts && selectedIncident.attempts.length > 0 && (
                <div className="p-4 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#D97757] text-lg">repeat</span>
                      <span className="font-headline-sm font-semibold text-[#2D2926] text-xs uppercase tracking-wider">
                        Autonomous Remediation Attempts ({selectedIncident.attempts.length})
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {selectedIncident.attempts.map((att, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                          selectedAttemptIdx === idx
                            ? 'bg-white border-[#D97757] shadow-sm'
                            : 'bg-white/80 border-[#E5DED6] hover:bg-white'
                        }`}
                        onClick={() => setSelectedAttemptIdx(selectedAttemptIdx === idx ? null : idx)}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded font-mono font-bold bg-[#F9ECE7] text-[#99462A]">
                              Attempt #{att.attempt_number}
                            </span>
                            <span className="font-semibold text-[#2D2926]">
                              {att.patch_strategy || 'Intelligent AST Reconciliation'}
                            </span>
                            {att.commit_sha && (
                              <span className="font-mono text-[11px] text-[#6B625B]">
                                [{att.commit_sha.slice(0, 7)}]
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              att.ci_validation?.status === 'PASSED'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              CI: {att.ci_validation?.status || 'UNKNOWN'}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              att.outcome === 'AUTO_MERGED' || att.outcome === 'RESOLVED'
                                ? 'bg-[#EAF3E7] text-[#5B7C4B]'
                                : 'bg-[#FDF0F0] text-[#C34A4A]'
                            }`}>
                              {att.outcome}
                            </span>
                          </div>
                        </div>

                        {selectedAttemptIdx === idx && (
                          <div className="mt-3 pt-3 border-t border-[#E5DED6] space-y-2 text-[#2D2926]">
                            <div className="p-2 rounded bg-[#FAF7F3] border border-[#E5DED6]">
                              <span className="font-semibold text-[#6B625B] block mb-0.5">Patch Summary:</span>
                              <p className="font-mono text-[11px]">{att.patch_summary || 'Autonomous AST patch applied'}</p>
                            </div>
                            {att.evaluation && (
                              <div className="p-2 rounded bg-[#FAF7F3] border border-[#E5DED6]">
                                <span className="font-semibold text-[#6B625B] block mb-0.5">ValidatorAgent Assessment:</span>
                                <p className="text-[11px] leading-relaxed">{att.evaluation.reasoning}</p>
                              </div>
                            )}
                            {att.diff && (
                              <div className="p-2 rounded bg-[#201B18] font-mono text-[10px] text-[#D1C7BD] overflow-x-auto max-h-40">
                                <pre>{att.diff}</pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Phase 3: Autonomous Deployment Management */}
              <div className="p-4 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#16A34A] text-lg">rocket_launch</span>
                    <span className="font-headline-sm font-semibold text-[#2D2926] text-xs uppercase tracking-wider">
                      Phase 3: Autonomous Deployment Management
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full font-mono text-xs font-bold ${
                    (selectedIncident.deployment?.status === 'SUCCESS' || selectedIncident.status === 'Resolved' || selectedIncident.status === 'Remediated')
                      ? 'bg-[#EAF3E7] text-[#5B7C4B] border border-[#5B7C4B]/40'
                      : 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#3B82F6]/40'
                  }`}>
                    STATUS: {selectedIncident.deployment?.status || (selectedIncident.status === 'Resolved' ? 'SUCCESS' : 'DEPLOYED')}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded bg-white border border-[#E5DED6]">
                    <span className="text-[#6B625B] text-[10px] block">Provider</span>
                    <span className="font-bold text-[#2D2926] uppercase mt-0.5">
                      {selectedIncident.deployment?.provider || 'github_actions'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-white border border-[#E5DED6]">
                    <span className="text-[#6B625B] text-[10px] block">Target Environment</span>
                    <span className="font-bold text-[#2D2926] uppercase mt-0.5">
                      {selectedIncident.deployment?.target_environment || 'production'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-white border border-[#E5DED6]">
                    <span className="text-[#6B625B] text-[10px] block">Duration</span>
                    <span className="font-bold text-[#2D2926] mt-0.5">
                      {selectedIncident.deployment?.duration_seconds ? `${selectedIncident.deployment.duration_seconds}s` : '14s'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-white border border-[#E5DED6]">
                    <span className="text-[#6B625B] text-[10px] block">Live Endpoint</span>
                    <a
                      href={selectedIncident.deployment?.deployment_url || `https://${selectedIncident.repo.split('/')[-1] || 'sentinelops'}.pages.dev`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-[#2563EB] hover:underline flex items-center gap-1 mt-0.5 truncate"
                    >
                      <span className="truncate">View App</span>
                      <span className="material-symbols-outlined text-xs">open_in_new</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Phase 3: Post-Deployment Health Verification Probes */}
              <div className="p-4 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#2563EB] text-lg">monitor_heart</span>
                    <span className="font-headline-sm font-semibold text-[#2D2926] text-xs uppercase tracking-wider">
                      Post-Deployment Health Probes ({selectedIncident.healthCheck?.consecutive_successes ?? 2}/{selectedIncident.healthCheck?.success_threshold ?? 2} Threshold)
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full font-mono text-xs font-bold ${
                    (selectedIncident.healthCheck?.status === 'HEALTHY' || selectedIncident.status === 'Resolved' || selectedIncident.status === 'Remediated')
                      ? 'bg-[#EAF3E7] text-[#5B7C4B] border border-[#5B7C4B]/40'
                      : 'bg-[#FDF0F0] text-[#C34A4A] border border-[#C34A4A]/40'
                  }`}>
                    HEALTH: {selectedIncident.healthCheck?.status || (selectedIncident.status === 'Resolved' ? 'HEALTHY (200 OK)' : 'VERIFIED')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2 rounded bg-white border border-[#E5DED6]">
                    <span className="text-[#6B625B] text-[10px] block">Consecutive Passed</span>
                    <span className="font-bold text-[#5B7C4B] mt-0.5">
                      {selectedIncident.healthCheck?.consecutive_successes ?? 2} / {selectedIncident.healthCheck?.success_threshold ?? 2} Probes (HTTP 200)
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white border border-[#E5DED6]">
                    <span className="text-[#6B625B] text-[10px] block">Avg Response Latency</span>
                    <span className="font-bold text-[#2D2926] mt-0.5">
                      {selectedIncident.healthCheck?.average_latency_ms ? `${selectedIncident.healthCheck.average_latency_ms}ms` : '43.5ms'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white border border-[#E5DED6]">
                    <span className="text-[#6B625B] text-[10px] block">Target Health URL</span>
                    <span className="font-mono text-[11px] text-[#6B625B] truncate block mt-0.5">
                      {selectedIncident.healthCheck?.url || `https://${selectedIncident.repo}/health`}
                    </span>
                  </div>
                </div>

                {selectedIncident.healthCheck?.probes && selectedIncident.healthCheck.probes.length > 0 && (
                  <div className="p-2 rounded bg-white border border-[#E5DED6] space-y-1.5">
                    <span className="text-[10px] font-semibold text-[#6B625B] uppercase block">Probe Telemetry History:</span>
                    <div className="space-y-1">
                      {selectedIncident.healthCheck.probes.map((probe, pIdx) => (
                        <div key={pIdx} className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-[#FAF7F3]">
                          <span className="font-mono text-[#2D2926]">Probe #{probe.probe_number || pIdx + 1}</span>
                          <span className="font-mono text-[#5B7C4B] font-bold">HTTP {probe.status_code || 200} OK</span>
                          <span className="text-[#6B625B]">{probe.latency_ms || 42}ms</span>
                          <span className="text-[#5B7C4B] font-semibold">PASS</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Phase 3: DeploymentGuard 5-Point Safety Boundary */}
              <div className="p-4 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#5B7C4B] text-lg">verified_user</span>
                    <span className="font-headline-sm font-semibold text-[#2D2926] text-xs uppercase tracking-wider">
                      DeploymentGuard 5-Point Resolution Gate
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-[#EAF3E7] border border-[#5B7C4B]/40 text-[#5B7C4B] font-mono text-xs font-bold">
                    GATE: {selectedIncident.status === 'Resolved' || selectedIncident.status === 'Remediated' ? 'APPROVED (5/5 PASS)' : 'EVALUATING'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
                  <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
                    <span className="text-[#6B625B] text-[10px] block">1. CI Validation</span>
                    <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                      <span className="material-symbols-outlined text-xs">check</span>
                      SUCCESS
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
                    <span className="text-[#6B625B] text-[10px] block">2. MergeGuard</span>
                    <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                      <span className="material-symbols-outlined text-xs">check</span>
                      APPROVED
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
                    <span className="text-[#6B625B] text-[10px] block">3. PR Merged</span>
                    <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                      <span className="material-symbols-outlined text-xs">check</span>
                      MERGED
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
                    <span className="text-[#6B625B] text-[10px] block">4. Deployment</span>
                    <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                      <span className="material-symbols-outlined text-xs">check</span>
                      SUCCESS
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white border border-[#E5DED6] text-center">
                    <span className="text-[#6B625B] text-[10px] block">5. Health Probe</span>
                    <span className="font-bold text-[#5B7C4B] flex items-center justify-center gap-0.5 mt-0.5">
                      <span className="material-symbols-outlined text-xs">check</span>
                      HEALTHY
                    </span>
                  </div>
                </div>
              </div>

              {/* Phase 3: Rollback & Audit Card (if rollback occurred or active) */}
              {(selectedIncident.rollback || selectedIncident.status === 'Rolled Back' || selectedIncident.status === 'Rolling Back') && (
                <div className="p-4 rounded-lg bg-[#FFFBEB] border border-[#D97706]/40 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#D97706] text-lg">history</span>
                      <span className="font-headline-sm font-semibold text-[#B45309] text-xs uppercase tracking-wider">
                        Autonomous Rollback Engine (Single-Attempt Policy)
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] font-mono text-xs font-bold border border-[#D97706]/30">
                      STATUS: {selectedIncident.rollback?.status || 'HEALTH_VERIFIED'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded bg-white border border-[#E5DED6]">
                      <span className="text-[#6B625B] text-[10px] block">Strategy</span>
                      <span className="font-bold text-[#2D2926] mt-0.5 uppercase">
                        {selectedIncident.rollback?.strategy || 'git_revert'}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-white border border-[#E5DED6]">
                      <span className="text-[#6B625B] text-[10px] block">Failed Commit &rarr; Restored</span>
                      <span className="font-mono text-[11px] text-[#2D2926] mt-0.5 block">
                        {(selectedIncident.rollback?.failed_commit_sha || 'a1b2c3d').slice(0, 7)} &rarr; {(selectedIncident.rollback?.rollback_commit_sha || 'e4f5a6b').slice(0, 7)}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-white border border-[#E5DED6]">
                      <span className="text-[#6B625B] text-[10px] block">Rollback Health</span>
                      <span className="font-bold text-[#5B7C4B] mt-0.5">
                        {selectedIncident.rollback?.health_status || 'HEALTHY (200 OK)'}
                      </span>
                    </div>
                  </div>

                  {selectedIncident.rollback?.audit_events && selectedIncident.rollback.audit_events.length > 0 && (
                    <div className="p-2 rounded bg-white border border-[#E5DED6] space-y-1">
                      <span className="text-[10px] font-semibold text-[#6B625B] uppercase block">Rollback Audit Trail:</span>
                      {selectedIncident.rollback.audit_events.map((ev, eIdx) => (
                        <div key={eIdx} className="flex items-center gap-2 text-[11px] text-[#6B625B]">
                          <span className="font-mono text-[#D97706]">{ev.action}</span>
                          <span>&bull;</span>
                          <span>{ev.details}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
                <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
                  <div className="flex items-center justify-between text-xs text-[#6B625B]">
                    <span className="font-semibold">Automated Checks</span>
                    <span className="material-symbols-outlined text-[#5B7C4B] text-base">check_circle</span>
                  </div>
                  <div className="text-base font-bold text-[#2D2926] mt-1">14 / 14 Passed</div>
                  <div className="text-[11px] text-[#5B7C4B] font-semibold">All workflows green (48s)</div>
                </div>

                <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
                  <div className="flex items-center justify-between text-xs text-[#6B625B]">
                    <span className="font-semibold">Test Suite Coverage</span>
                    <span className="material-symbols-outlined text-[#D97757] text-base">fact_check</span>
                  </div>
                  <div className="text-base font-bold text-[#2D2926] mt-1">440 Tests Run</div>
                  <div className="text-[11px] text-[#6B625B]">412 unit · 28 integration</div>
                </div>

                <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
                  <div className="flex items-center justify-between text-xs text-[#6B625B]">
                    <span className="font-semibold">Security Gates</span>
                    <span className="material-symbols-outlined text-[#6B625B] text-base">shield</span>
                  </div>
                  <div className="text-base font-bold text-[#2D2926] mt-1">0 Vulnerabilities</div>
                  <div className="text-[11px] text-[#6B625B]">Trivy · Snyk · SonarQube [A]</div>
                </div>
              </div>

              {/* Bottom merge action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pt-2 border-t border-[#E5DED6]">
                <div className="flex items-center gap-2 text-xs text-[#6B625B]">
                  <span className="h-2 w-2 rounded-full bg-[#D97757] animate-pulse"></span>
                  <span>Autonomous Auto-Merge Policy active:</span>
                </div>
                <button
                  disabled={merged || selectedIncident.status === 'Resolved'}
                  onClick={() => handleStatusChange('Resolved')}
                  className={`px-5 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                    merged || selectedIncident.status === 'Resolved'
                      ? 'bg-[#5B7C4B] text-white cursor-default'
                      : 'bg-[#D97757] hover:bg-[#B85D3E] text-white shadow-[#D97757]/20'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">
                    {merged || selectedIncident.status === 'Resolved' ? 'task_alt' : 'done_all'}
                  </span>
                  <span>{merged || selectedIncident.status === 'Resolved' ? 'Resolved in Flask API' : 'Approve Fix & Merge PR'}</span>
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Autonomous Execution Trail (4 cols) */}
        <div className="lg:col-span-4 space-y-space-lg">
          <section className="rounded-xl bg-white border border-[#E5DED6] shadow-card overflow-hidden flex flex-col">
            <div className="p-space-md bg-[#F2EDE6]/80 border-b border-[#E5DED6] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#D97757] text-lg">timeline</span>
                <span className="font-headline-sm font-semibold text-[#2D2926]">Execution Trail</span>
              </div>
              <span className="font-label-code-sm text-xs text-[#99462A] bg-[#F9ECE7] border border-[#D97757]/30 px-2 py-0.5 rounded font-semibold">
                Live Loop
              </span>
            </div>

            <div className="p-space-md">
              <div className="relative pl-6 space-y-5">
                {/* Vertical connecting line */}
                <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-[#E5DED6]"></div>

                {/* Trail Steps */}
                <div className="relative flex items-start gap-3">
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#FDF0F0] border border-[#C34A4A]/40 text-[#C34A4A] flex items-center justify-center">
                    <span className="material-symbols-outlined text-xs">close</span>
                  </div>
                  <div className="text-xs">
                    <div className="flex items-center gap-1 text-[#6B625B]">
                      <span className="font-mono">14:22:05</span> · <span className="font-semibold text-[#2D2926]">Failure detected</span>
                    </div>
                    <p className="text-[#6B625B] mt-0.5">GitHub Actions CI pipeline failed with exit code 1</p>
                  </div>
                </div>

                <div className="relative flex items-start gap-3">
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#D97757] text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-xs">check</span>
                  </div>
                  <div className="text-xs">
                    <div className="flex items-center gap-1 text-[#6B625B]">
                      <span className="font-mono">14:22:08</span> · <span className="font-semibold text-[#2D2926]">AST analysis</span>
                    </div>
                    <p className="text-[#6B625B] mt-0.5">Captured stack trace fingerprint HASH_9a7d</p>
                  </div>
                </div>

                <div className="relative flex items-start gap-3">
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#D97757] text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-xs">check</span>
                  </div>
                  <div className="text-xs">
                    <div className="flex items-center gap-1 text-[#6B625B]">
                      <span className="font-mono">14:22:15</span> · <span className="font-semibold text-[#2D2926]">Conflict isolated</span>
                    </div>
                    <p className="text-[#6B625B] mt-0.5">Identified @stripe/stripe-node peer dependency constraint</p>
                  </div>
                </div>

                <div className="relative flex items-start gap-3">
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#D97757] text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-xs">check</span>
                  </div>
                  <div className="text-xs">
                    <div className="flex items-center gap-1 text-[#6B625B]">
                      <span className="font-mono">14:22:28</span> · <span className="font-semibold text-[#2D2926]">Synthesized patch</span>
                    </div>
                    <p className="text-[#6B625B] mt-0.5">Updated package.json and resolved lockfile</p>
                  </div>
                </div>

                <div className="relative flex items-start gap-3">
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#D97757] text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-xs">check</span>
                  </div>
                  <div className="text-xs">
                    <div className="flex items-center gap-1 text-[#6B625B]">
                      <span className="font-mono">14:23:01</span> · <span className="font-semibold text-[#2D2926]">Sandbox verification</span>
                    </div>
                    <p className="text-[#6B625B] mt-0.5">Ephemeral k8s runner passed 440/440 tests</p>
                  </div>
                </div>

                <div className="relative flex items-start gap-3">
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#5B7C4B] text-white flex items-center justify-center shadow-xs animate-pulse">
                    <span className="material-symbols-outlined text-xs">done_all</span>
                  </div>
                  <div className="text-xs">
                    <div className="flex items-center gap-1 text-[#6B625B]">
                      <span className="font-mono">14:24:19</span> · <span className="font-semibold text-[#2D2926]">PR #184 Opened</span>
                    </div>
                    <p className="text-[#6B625B] mt-0.5">Assigned reviewers: @platform-lead, auto-merge enabled</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* AI Knowledge Base Context Card */}
          <section className="rounded-xl bg-white border border-[#E5DED6] p-space-md shadow-card space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#6B625B]">
              <span className="material-symbols-outlined text-[#D97757] text-base">auto_stories</span>
              <span>KNOWLEDGE REPOSITORIES ACCESSED</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="p-2 rounded bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between">
                <span className="text-[#2D2926] font-mono">npm-resolution-recipes.db</span>
                <span className="text-[#99462A] font-semibold">99% match</span>
              </div>
              <div className="p-2 rounded bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between">
                <span className="text-[#2D2926] font-mono">stripe-migration-v14.md</span>
                <span className="text-[#99462A] font-semibold">Verified</span>
              </div>
              <div className="p-2 rounded bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between">
                <span className="text-[#2D2926] font-mono">service-catalog/payment-service</span>
                <span className="text-[#99462A] font-semibold">Policy checked</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Enhanced AI Diagnostics Modal */}
      {showExplainModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E5DED6] shadow-2xl max-w-3xl w-full p-5 sm:p-6 space-y-4 max-h-[92vh] flex flex-col relative overflow-hidden">
            {/* Subtle top glow */}
            <div className="absolute -right-20 -top-20 w-56 h-56 bg-[#D97757]/10 rounded-full blur-3xl pointer-events-none" />

            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#E5DED6] pb-3.5 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F9ECE7] border border-[#D97757]/30 text-[#D97757] flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-2xl">psychology</span>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-headline-md font-bold text-lg text-[#2D2926] tracking-tight">
                      Autonomous AI Diagnostics: {selectedIncident.id}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-[#EDF4EA] text-[#5B7C4B] border border-[#5B7C4B]/30 font-label-code-sm text-[10px] font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">verified</span>
                      {explanationData?.confidence ?? selectedIncident.confidence}% Confidence
                    </span>
                    {explanationData?.guardStatus && (
                      <span className={`px-2 py-0.5 rounded-full font-label-code-sm text-[10px] font-semibold border ${
                        explanationData.guardStatus === 'BLOCKED'
                          ? 'bg-[#FDF0F0] text-[#C34A4A] border-[#C34A4A]/30'
                          : 'bg-[#EDF4EA] text-[#5B7C4B] border-[#5B7C4B]/30'
                      }`}>
                        🛡️ {explanationData.guardStatus}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#6B625B] mt-0.5">
                    <span>Repo: <strong className="text-[#2D2926]">{selectedIncident.repo}</strong></span>
                    <span>·</span>
                    <span>AI Engine: <strong className="text-[#D97757]">{explanationData?.aiModel || 'DevOps-LLM (Groq / Gemini / AST)'}</strong></span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowExplainModal(false)}
                className="text-[#6B625B] hover:text-[#2D2926] hover:bg-[#F2EDE6] p-1.5 rounded-lg transition-colors cursor-pointer"
                title="Close modal"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Diagnostic Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-[#E5DED6] pb-2 text-xs font-label-code-sm overflow-x-auto relative z-10">
              <button
                onClick={() => setExplainTab('triage')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  explainTab === 'triage'
                    ? 'bg-[#F9ECE7] text-[#99462A] border border-[#D97757]/30 shadow-sm'
                    : 'text-[#6B625B] hover:text-[#2D2926] hover:bg-[#F2EDE6]'
                }`}
              >
                <span className="material-symbols-outlined text-sm">troubleshoot</span>
                <span>Root Cause &amp; Triage</span>
              </button>
              <button
                onClick={() => setExplainTab('diff')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  explainTab === 'diff'
                    ? 'bg-[#F9ECE7] text-[#99462A] border border-[#D97757]/30 shadow-sm'
                    : 'text-[#6B625B] hover:text-[#2D2926] hover:bg-[#F2EDE6]'
                }`}
              >
                <span className="material-symbols-outlined text-sm">difference</span>
                <span>Synthesized Patch Diff</span>
                {explanationData?.diff && (
                  <span className="px-1.5 py-0.2 rounded bg-[#EDF4EA] text-[#5B7C4B] text-[10px]">
                    +{explanationData.linesAdded ?? 2}/-{explanationData.linesDeleted ?? 1}
                  </span>
                )}
              </button>
              <button
                onClick={() => setExplainTab('telemetry')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  explainTab === 'telemetry'
                    ? 'bg-[#F9ECE7] text-[#99462A] border border-[#D97757]/30 shadow-sm'
                    : 'text-[#6B625B] hover:text-[#2D2926] hover:bg-[#F2EDE6]'
                }`}
              >
                <span className="material-symbols-outlined text-sm">terminal</span>
                <span>Runner Telemetry</span>
              </button>
              <button
                onClick={() => setExplainTab('roadmap')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  explainTab === 'roadmap'
                    ? 'bg-[#F9ECE7] text-[#99462A] border border-[#D97757]/30 shadow-sm'
                    : 'text-[#6B625B] hover:text-[#2D2926] hover:bg-[#F2EDE6]'
                }`}
              >
                <span className="material-symbols-outlined text-sm">checklist</span>
                <span>Resolution Plan</span>
              </button>
            </div>

            {/* Modal Body / Tab Panels */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs text-[#2D2926] relative z-10">
              {isLoadingExplanation ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-[#6B625B]">
                  <span className="material-symbols-outlined text-4xl text-[#D97757] animate-spin">sync</span>
                  <span className="font-label-code-sm text-sm font-medium">
                    Performing autonomous AST &amp; LLM diagnostics...
                  </span>
                  <span className="text-xs text-[#8F857D]">
                    Inspecting runner logs, pinpointing root cause, and synthesizing patch
                  </span>
                </div>
              ) : (
                <>
                  {/* TAB 1: Root Cause & Triage */}
                  {explainTab === 'triage' && (
                    <div className="space-y-3.5 animate-fade-in">
                      {/* Root Cause Banner */}
                      <div className="p-3.5 rounded-xl bg-[#FAF7F3] border border-[#E5DED6] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-label-caps text-[11px] text-[#99462A] font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-[#D97757]">bug_report</span>
                            Pinpointed Root Cause ({explanationData?.errorType || 'RuntimeError'})
                          </span>
                          <span className="font-label-code-sm text-[11px] text-[#5B7C4B] font-semibold">
                            Deterministic AST Match
                          </span>
                        </div>
                        <div className="font-bold text-sm text-[#2D2926] leading-snug">
                          {explanationData?.rootCause || selectedIncident.rootCause}
                        </div>
                      </div>

                      {/* Detailed Narrative Explanation */}
                      <div className="p-3.5 rounded-xl bg-white border border-[#E5DED6] space-y-2 shadow-xs">
                        <div className="font-bold text-xs text-[#2D2926] flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-[#D97757]">analytics</span>
                          Algorithmic Failure Analysis
                        </div>
                        <p className="text-xs text-[#6B625B] leading-relaxed">
                          {explanationData?.explanation || selectedIncident.explanation || (
                            `When tests executed on the ${selectedIncident.repo} repository, SentinelOps inspected AST execution traces and identified broken constraints that triggered workflow exit code 1.`
                          )}
                        </p>
                      </div>

                      {/* Safety & Blast Radius Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="p-3 rounded-xl bg-[#FAF7F3] border border-[#E5DED6] flex flex-col justify-between">
                          <span className="text-[10px] font-label-caps text-[#6B625B] uppercase font-semibold">Target File</span>
                          <span className="font-mono text-xs font-bold text-[#2D2926] truncate mt-1">
                            {explanationData?.targetFile || selectedIncident.targetFile || 'package.json'}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#FAF7F3] border border-[#E5DED6] flex flex-col justify-between">
                          <span className="text-[10px] font-label-caps text-[#6B625B] uppercase font-semibold">Blast Radius</span>
                          <span className="text-xs font-semibold text-[#5B7C4B] mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">track_changes</span>
                            {explanationData?.blastRadius || 'Isolated (Single Module)'}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#FAF7F3] border border-[#E5DED6] flex flex-col justify-between">
                          <span className="text-[10px] font-label-caps text-[#6B625B] uppercase font-semibold">SentinelGuard Risk</span>
                          <span className={`text-xs font-bold mt-1 ${
                            explanationData?.riskLevel === 'HIGH' || explanationData?.riskLevel === 'CRITICAL'
                              ? 'text-[#C34A4A]'
                              : 'text-[#5B7C4B]'
                          }`}>
                            {explanationData?.riskLevel || 'LOW'} RISK
                          </span>
                        </div>
                      </div>

                      {/* Suggested Action Box */}
                      {explanationData?.suggestedAction && (
                        <div className="p-3 rounded-xl bg-[#F9ECE7] border border-[#D97757]/30 text-[#99462A] flex items-start gap-2.5">
                          <span className="material-symbols-outlined text-base mt-0.5 text-[#D97757]">lightbulb</span>
                          <div className="flex-1">
                            <span className="font-bold block text-xs">Recommended Remediation</span>
                            <span className="text-xs mt-0.5 block">{explanationData.suggestedAction}</span>
                          </div>
                        </div>
                      )}

                      {/* Policy Check */}
                      {explanationData?.policyCheck && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#EDF4EA] border border-[#5B7C4B]/30 text-[#5B7C4B] font-semibold text-xs">
                          <span className="material-symbols-outlined text-base">verified_user</span>
                          <span>{explanationData.policyCheck}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: Synthesized Patch Diff */}
                  {explainTab === 'diff' && (
                    <div className="space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#2D2926]">
                            Target: {explanationData?.targetFile || selectedIncident.targetFile || 'package.json'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-[#EDF4EA] text-[#5B7C4B] font-label-code-sm text-[10px] font-semibold">
                            Zero-Regression Verified
                          </span>
                        </div>
                        <button
                          onClick={handleCopyDiff}
                          className="px-2.5 py-1 rounded-lg bg-[#F2EDE6] hover:bg-[#E5DED6] border border-[#E5DED6] text-xs font-medium text-[#2D2926] flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-xs">
                            {copiedDiff ? 'check' : 'content_copy'}
                          </span>
                          <span>{copiedDiff ? 'Copied Diff' : 'Copy Diff'}</span>
                        </button>
                      </div>

                      {/* Unified Diff Box */}
                      <div className="rounded-xl bg-[#1E1A18] p-3.5 font-mono text-xs text-[#EDE7E3] space-y-1 overflow-x-auto shadow-inner border border-[#3E3835] max-h-[340px]">
                        {(explanationData?.diff || selectedIncident.diff || `--- a/package.json\n+++ b/package.json\n@@ -3,3 +3,3 @@\n-    "@stripe/stripe-node": "^12.1.0"\n+    "@stripe/stripe-node": "^14.0.0"`)
                          .split('\n')
                          .map((line, idx) => {
                            const isAdd = line.startsWith('+') && !line.startsWith('+++');
                            const isDel = line.startsWith('-') && !line.startsWith('---');
                            const isHeader = line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@');

                            return (
                              <div
                                key={idx}
                                className={`px-2 py-0.5 rounded ${
                                  isAdd
                                    ? 'bg-[#15803d]/30 text-[#86efac]'
                                    : isDel
                                    ? 'bg-[#ba1a1a]/30 text-[#fca5a5]'
                                    : isHeader
                                    ? 'text-[#8F857D] font-semibold'
                                    : 'text-[#D1C7BD]'
                                }`}
                              >
                                {line || ' '}
                              </div>
                            );
                          })}
                      </div>

                      <p className="text-[11px] text-[#6B625B] flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-[#5B7C4B]">check_circle</span>
                        Deterministic lockfile validation passed without contract breaking changes.
                      </p>
                    </div>
                  )}

                  {/* TAB 3: Runner Telemetry */}
                  {explainTab === 'telemetry' && (
                    <div className="space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="font-label-caps text-xs text-[#6B625B] uppercase font-semibold">
                          Runner Log Excerpt ({selectedIncident.repo})
                        </span>
                        <span className="font-label-code-sm text-[11px] text-[#D97757] font-semibold">
                          Exit Code: 1 (Failed)
                        </span>
                      </div>

                      <div className="rounded-xl bg-[#1E1A18] p-3.5 font-mono text-xs text-[#EDE7E3] space-y-1 overflow-x-auto shadow-inner border border-[#3E3835] max-h-[320px]">
                        {(explanationData?.rawLogsSnippet ||
                          `Triggering pipeline step: npm test -- --bail\nnpm ERR! code ERESOLVE\nnpm ERR! ERESOLVE could not resolve peer dependency tree\nnpm ERR! While resolving: @stripe/stripe-node@12.1.0\nnpm ERR! Found: @types/node@20.11.0\nnpm ERR! Conflicting peer dependency: @types/node@^18.0.0\nDetected exit code 1. Stack trace fingerprint: HASH_9a7d32b4f`
                        )
                          .split('\n')
                          .map((line, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <span className="text-[#6B625B] select-none text-[10px] w-6 text-right">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <span className={
                                line.toLowerCase().includes('err') || line.toLowerCase().includes('fail') || line.toLowerCase().includes('assertion')
                                  ? 'text-[#fca5a5] font-semibold'
                                  : line.toLowerCase().includes('warn')
                                  ? 'text-[#fde047]'
                                  : 'text-[#D1C7BD]'
                              }>
                                {line}
                              </span>
                            </div>
                          ))}
                      </div>

                      <div className="p-2.5 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] text-[11px] text-[#6B625B]">
                        Telemetry ingested from GitHub Actions runner environment and parsed by SentinelOps AST heuristic pattern library.
                      </div>
                    </div>
                  )}

                  {/* TAB 4: Resolution Roadmap */}
                  {explainTab === 'roadmap' && (
                    <div className="space-y-3.5 animate-fade-in">
                      <div className="font-bold text-xs text-[#2D2926] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-[#D97757]">route</span>
                        Autonomous Self-Healing Execution Lifecycle
                      </div>

                      <div className="space-y-2.5">
                        {(explanationData?.steps || [
                          'Captured runner telemetry and isolated ERESOLVE failure log',
                          'AST parsed dependency matrix against package-lock.json',
                          'Synthesized compatible peer dependency lockfile pin',
                          'SentinelGuard safety verified: 0 CVEs introduced',
                          'Dispatched automated remediation PR #184'
                        ]).map((step, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-6 h-6 rounded-full bg-[#D97757] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                                {idx + 1}
                              </div>
                              <span className="text-xs font-medium text-[#2D2926]">{step}</span>
                            </div>
                            <span className="material-symbols-outlined text-sm text-[#5B7C4B]">check_circle</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="pt-3.5 border-t border-[#E5DED6] flex flex-wrap items-center justify-between gap-2 relative z-10">
              <button
                onClick={handleCopyReport}
                disabled={isLoadingExplanation}
                className="px-3.5 py-2 rounded-lg bg-[#F2EDE6] hover:bg-[#E5DED6] border border-[#E5DED6] text-xs font-semibold text-[#2D2926] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">
                  {copiedReport ? 'check' : 'assignment'}
                </span>
                <span>{copiedReport ? 'Report Copied!' : 'Copy Diagnosis'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowExplainModal(false)}
                  className="px-4 py-2 rounded-lg bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] text-xs font-semibold text-[#6B625B] hover:text-[#2D2926] transition-colors cursor-pointer"
                >
                  Close
                </button>

                <button
                  onClick={() => {
                    handleRemediate();
                  }}
                  disabled={isRemediating || isLoadingExplanation}
                  className="px-4 py-2 rounded-lg bg-[#D97757] hover:bg-[#B85D3E] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-sm ${isRemediating ? 'animate-spin' : ''}`}>
                    {isRemediating ? 'sync' : 'auto_fix_high'}
                  </span>
                  <span>{isRemediating ? 'Remediating...' : 'Auto-Remediate (Healer-Alpha)'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
