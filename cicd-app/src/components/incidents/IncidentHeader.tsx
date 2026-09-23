import React from 'react';
import type { Incident } from '../../types';

interface IncidentHeaderProps {
  selectedIncident: Incident | null;
  incidentList: Incident[];
  onSelectIncident: (inc: Incident) => void;
  onExplain: () => void;
  onValidateCI: () => void;
  isValidatingCI: boolean;
  onVerifyDeployment: () => void;
  isVerifyingDeployment: boolean;
  onTriggerRollback: () => void;
  isRollingBack: boolean;
  onRemediate: () => void;
  isRemediating: boolean;
  onRunMultiAgent: () => void;
  isReasoning: boolean;
  onOrchestrate: () => void;
  isOrchestrating: boolean;
}

export const IncidentHeader: React.FC<IncidentHeaderProps> = ({
  selectedIncident,
  incidentList,
  onSelectIncident,
  onExplain,
  onValidateCI,
  isValidatingCI,
  onVerifyDeployment,
  isVerifyingDeployment,
  onTriggerRollback,
  isRollingBack,
  onRemediate,
  isRemediating,
  onRunMultiAgent,
  isReasoning,
  onOrchestrate,
  isOrchestrating,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-space-sm">
      <div>
        <div className="flex items-center gap-space-xs text-[#6B625B] font-label-code-sm text-xs">
          <span>Control Center</span>
          <span>/</span>
          <span>Incidents</span>
          {selectedIncident && (
            <>
              <span>/</span>
              <span className="text-[#99462A] font-semibold">{selectedIncident.id}</span>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <h1 className="font-headline-lg text-xl sm:text-2xl font-bold text-[#2D2926] tracking-tight">
            {selectedIncident ? `${selectedIncident.id}: Autonomous Remediation` : 'Incidents & Anomalies'}
          </h1>
          {selectedIncident && (
            <span className="px-2.5 py-0.5 rounded-full bg-[#F9ECE7] border border-[#D97757]/30 text-[#99462A] font-label-code-sm text-xs font-semibold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#D97757] animate-pulse"></span>
              {selectedIncident.status.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {selectedIncident && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-space-sm">
          <select
            value={selectedIncident.id}
            onChange={(e) => {
              const inc = incidentList.find((i) => i.id === e.target.value);
              if (inc) onSelectIncident(inc);
            }}
            aria-label="Select incident"
            className="w-full sm:w-auto px-3 py-2 rounded-lg bg-white border border-[#E5DED6] text-xs font-medium text-[#2D2926] focus:outline-none focus:border-[#D97757]"
          >
            {incidentList.map((inc) => (
              <option key={inc.id} value={inc.id}>
                {inc.id} ({inc.repo} - {inc.status})
              </option>
            ))}
          </select>

          <button
            onClick={onExplain}
            className="px-3.5 py-2 rounded-lg bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] text-[#2D2926] font-medium font-body-sm flex items-center gap-1.5 shadow-sm transition-all cursor-pointer text-xs"
          >
            <span className="material-symbols-outlined text-base text-[#D97757]">psychology</span>
            <span>Explain via AI</span>
          </button>

          <button
            onClick={onValidateCI}
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
            onClick={onVerifyDeployment}
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
            onClick={onTriggerRollback}
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
            onClick={onRemediate}
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
            onClick={onRunMultiAgent}
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
            onClick={onOrchestrate}
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
      )}
    </div>
  );
};
