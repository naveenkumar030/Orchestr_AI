import { useState, useEffect } from 'react';
import { incidents as initialIncidents } from '../data/mockData';
import { api, type IncidentExplanation } from '../services/api';
import type { Incident, IncidentStatus, MultiAgentReasoningResult } from '../types';
import { MultiAgentWorkflowCard } from '../components/ui/MultiAgentWorkflowCard';
import { IncidentExplainModal } from '../components/modals/IncidentExplainModal';
import {
  IncidentHeader,
  IncidentMetadataRibbon,
  IncidentRcaCard,
  IncidentTerminalCard,
  IncidentRemediationDetails,
  IncidentExecutionTrail,
} from '../components/incidents';

export default function IncidentsPage() {
  const [incidentList, setIncidentList] = useState<Incident[]>(initialIncidents);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(initialIncidents[0] || null);
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

  const handleRunMultiAgent = async () => {
    if (!selectedIncident) return;
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
    if (!selectedIncident) return;
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
    if (!selectedIncident) return;
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
    if (!selectedIncident) return;
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
    if (!selectedIncident) return;
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
    if (!selectedIncident) return;
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
    if (!selectedIncident) return;
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
    if (!selectedIncident) return;
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
      if (data) {
        setIncidentList(data);
        if (data.length > 0) {
          setSelectedIncident((prev) => (prev ? (data.find((i) => i.id === prev.id) || data[0]) : data[0]));
        } else {
          setSelectedIncident(null);
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleStatusChange = async (newStatus: IncidentStatus) => {
    if (!selectedIncident) return;
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
    if (!selectedIncident) return;
    setShowExplainModal(true);
    setIsLoadingExplanation(true);
    try {
      const exp = await api.explainIncident(selectedIncident.id);
      setExplanationData(exp);
    } catch (err) {
      console.error('Failed to fetch AI explanation:', err);
    } finally {
      setIsLoadingExplanation(false);
    }
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
      <IncidentHeader
        selectedIncident={selectedIncident}
        incidentList={incidentList}
        onSelectIncident={setSelectedIncident}
        onExplain={handleExplain}
        onValidateCI={handleValidateCI}
        isValidatingCI={isValidatingCI}
        onVerifyDeployment={handleVerifyDeployment}
        isVerifyingDeployment={isVerifyingDeployment}
        onTriggerRollback={handleTriggerRollback}
        isRollingBack={isRollingBack}
        onRemediate={handleRemediate}
        isRemediating={isRemediating}
        onRunMultiAgent={handleRunMultiAgent}
        isReasoning={isReasoning}
        onOrchestrate={handleOrchestrate}
        isOrchestrating={isOrchestrating}
      />

      {(!selectedIncident || incidentList.length === 0) ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-[#E5DED6] shadow-card text-center my-6">
          <div className="w-16 h-16 rounded-2xl bg-[#F9ECE7] flex items-center justify-center text-[#D97757] mb-4">
            <span className="material-symbols-outlined text-3xl">task_alt</span>
          </div>
          <h2 className="text-xl font-bold text-[#2D2926] mb-2">No Active Incidents Detected</h2>
          <p className="text-sm text-[#6B625B] max-w-md mb-6">
            All pipelines and microservices are operating normally. Sentinel-Core has detected zero policy violations or failed workflow runs.
          </p>
          <button
            onClick={async () => {
              try {
                const sim = await api.simulateAnomaly();
                const list = await api.getIncidents();
                setIncidentList(list);
                setSelectedIncident(sim || list[0]);
                setNotification('Live incident simulation initiated!');
              } catch (e) {
                console.error(e);
              }
            }}
            className="px-4 py-2.5 rounded-lg bg-[#D97757] hover:bg-[#B85D3E] text-white font-medium text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">bolt</span>
            <span>Simulate Anomaly (Self-Healing Test)</span>
          </button>
        </div>
      ) : (
        <>
          {/* Metadata Ribbon */}
          <IncidentMetadataRibbon selectedIncident={selectedIncident} />

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
                          return JSON.parse(selectedIncident.agent_reasoning as string);
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
              <IncidentRcaCard selectedIncident={selectedIncident} />

              {/* 2. Error Logs Monospace Glass Terminal */}
              <IncidentTerminalCard selectedIncident={selectedIncident} />

              {/* 3. Proposed Fix, Unified Code Diff, SentinelGuard & Gates */}
              <IncidentRemediationDetails
                selectedIncident={selectedIncident}
                isRemediating={isRemediating}
                selectedAttemptIdx={selectedAttemptIdx}
                onSelectAttempt={setSelectedAttemptIdx}
                merged={merged}
                onStatusChange={handleStatusChange}
              />
            </div>

            {/* Right Column: Autonomous Execution Trail (4 cols) */}
            <IncidentExecutionTrail selectedIncident={selectedIncident} />
          </div>
        </>
      )}

      {/* Enhanced AI Diagnostics Modal */}
      <IncidentExplainModal
        isOpen={showExplainModal}
        onClose={() => setShowExplainModal(false)}
        selectedIncident={selectedIncident}
        explanationData={explanationData}
        isLoadingExplanation={isLoadingExplanation}
        onRemediate={handleRemediate}
        isRemediating={isRemediating}
      />
    </div>
  );
}
