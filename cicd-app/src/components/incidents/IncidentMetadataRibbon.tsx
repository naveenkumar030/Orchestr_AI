import React from 'react';
import type { Incident } from '../../types';

interface IncidentMetadataRibbonProps {
  selectedIncident: Incident;
}

export const IncidentMetadataRibbon: React.FC<IncidentMetadataRibbonProps> = ({ selectedIncident }) => {
  return (
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
  );
};
