import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import KpiCard from '../components/ui/KpiCard';
import StatusBadge from '../components/ui/StatusBadge';
import LivePulse from '../components/ui/LivePulse';
import RemediationTimeline from '../components/ui/RemediationTimeline';
import { kpiMetrics as defaultKpis, incidents as defaultIncidents, remediationSteps as defaultSteps } from '../data/mockData';
import { api } from '../services/api';
import type { Incident, KpiMetric, RemediationStep } from '../types';

const defaultSummaryMetrics = [
  { label: 'Success Rate',    value: '98.6%',    sub: 'Target: >98%',    color: 'text-[#D97757]' },
  { label: 'Failure Rate',    value: '1.4%',     sub: '-0.8% today',     color: 'text-[#C34A4A]' },
  { label: 'Avg Recovery',    value: '1m 48s',   sub: 'Autonomous',      color: 'text-[#2D2926]' },
  { label: 'Auto Resolution', value: '92.4%',    sub: '132 / 146 runs',  color: 'text-[#B87A36]' },
];

const timeFilters = ['24H', '7D', '30D'] as const;
type TimeFilter = typeof timeFilters[number];

export default function OverviewPage() {
  const [activeFilter, setActiveFilter] = useState<TimeFilter>('24H');
  const [kpiMetricsList, setKpiMetricsList] = useState<KpiMetric[]>(defaultKpis);
  const [incidentList, setIncidentList] = useState<Incident[]>(defaultIncidents);
  const [timelineSteps, setTimelineSteps] = useState<RemediationStep[]>(defaultSteps);
  const [summaryMetrics, setSummaryMetrics] = useState(defaultSummaryMetrics);

  useEffect(() => {
    let mounted = true;
    api.getOverview().then((overview) => {
      if (!mounted) return;
      if (overview.kpiMetrics?.length) setKpiMetricsList(overview.kpiMetrics);
      if (overview.incidents?.length) setIncidentList(overview.incidents);
      if (overview.remediationSteps?.length) setTimelineSteps(overview.remediationSteps);
      if (overview.stats) {
        setSummaryMetrics([
          { label: 'Success Rate',    value: overview.stats.successRate,    sub: 'Target: >98%',    color: 'text-[#D97757]' },
          { label: 'Failure Rate',    value: overview.stats.failureRate,     sub: '-0.8% today',     color: 'text-[#C34A4A]' },
          { label: 'Avg Recovery',    value: overview.stats.avgRecovery,   sub: 'Autonomous',      color: 'text-[#2D2926]' },
          { label: 'Auto Resolution', value: overview.stats.autoResolution,    sub: '132 / 146 runs',  color: 'text-[#B87A36]' },
        ]);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="flex flex-col w-full gap-space-xl">

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-xl bg-white border border-[#E5DED6] p-4 sm:p-6 lg:p-space-xl shadow-panel">
        <div className="absolute -right-24 -top-24 w-96 h-96 bg-[#D97757]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-24 w-72 h-72 bg-[#B87A36]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-space-lg">
          <div className="flex flex-col max-w-3xl">
            {/* Live pill */}
            <div className="inline-flex items-center gap-space-xs px-3 sm:px-space-md py-1 sm:py-space-2xs rounded-full bg-[#F9ECE7] border border-[#D97757]/30 shadow-sm w-fit mb-3 sm:mb-space-md">
              <LivePulse />
              <span className="font-label-code-sm text-[11px] sm:text-label-code-sm text-[#99462A] tracking-wide uppercase font-semibold">
                Live Agent Orchestration: 99.4% resolution (24h)
              </span>
            </div>

            <h1 className="font-headline-xl text-2xl sm:text-3xl lg:text-headline-xl text-[#2D2926] tracking-tight">
              Autonomous DevOps Control Center
            </h1>
            <p className="font-body-lg text-sm sm:text-base text-[#6B625B] mt-1 sm:mt-space-xs max-w-2xl">
              AI-powered real-time detection, self-healing diagnostics, and deterministic remediation
              across distributed CI/CD workflows.
            </p>
          </div>

          {/* Action cluster */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-space-md shrink-0 w-full sm:w-auto">
            <Link to="/incidents" className="w-full sm:w-auto">
              <button className="w-full relative group overflow-hidden px-4 sm:px-space-lg py-2.5 sm:py-space-sm rounded-lg bg-[#D97757] hover:bg-[#C66849] text-white font-headline-sm text-xs sm:text-headline-sm font-bold shadow-[0_4px_16px_rgba(217,119,87,0.35)] hover:shadow-[0_6px_22px_rgba(217,119,87,0.45)] transition-all flex items-center justify-center gap-space-sm active:scale-95">
                <span className="material-symbols-outlined text-lg sm:text-xl text-white">fork_right</span>
                <span>Connect Repository</span>
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              </button>
            </Link>
            <Link to="/incidents" className="w-full sm:w-auto">
              <button className="w-full px-4 sm:px-space-lg py-2.5 sm:py-space-sm rounded-lg bg-[#F2EDE6] border border-[#E5DED6] text-[#2D2926] hover:bg-[#EBE4DA] transition-all font-headline-sm text-xs sm:text-headline-sm font-medium flex items-center justify-center gap-space-sm shadow-sm active:scale-95">
                <span className="relative flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg sm:text-xl text-[#C34A4A]">notification_important</span>
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#C34A4A] animate-ping" />
                </span>
                <span>View Incidents</span>
                <span className="font-label-code-sm text-[10px] sm:text-label-code-sm px-1.5 py-0.5 rounded bg-[#FDF0F0] text-[#C34A4A] border border-[#C34A4A]/30 font-semibold">2 live</span>
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── KPI Grid ─────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-space-base">
        {kpiMetricsList.map((m) => <KpiCard key={m.label} metric={m} />)}
      </section>

      {/* ── Split Panel ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-base">

        {/* Pipeline Health Chart — 7 cols */}
        <section className="lg:col-span-7 flex flex-col rounded-xl bg-white border border-[#E5DED6] p-space-lg shadow-panel relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm mb-space-base">
            <div>
              <h2 className="font-headline-md text-headline-md text-[#2D2926] font-semibold tracking-tight">
                Pipeline Health &amp; Autonomous Velocity
              </h2>
              <p className="font-body-sm text-body-sm text-[#6B625B]">
                Continuous integration build volume vs. autonomous agent mitigation curve
              </p>
            </div>
            {/* Time filter */}
            <div className="flex items-center gap-space-xs bg-[#F2EDE6] border border-[#E5DED6] p-space-2xs rounded-lg">
              {timeFilters.map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-space-sm py-space-2xs rounded font-label-code-sm text-label-code-sm transition-colors ${
                    activeFilter === f
                      ? 'bg-[#D97757] text-white font-bold shadow-sm'
                      : 'text-[#6B625B] hover:text-[#2D2926]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Summary metrics strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm p-space-md rounded-lg bg-[#FBF9F5] border border-[#E5DED6] mb-space-md shadow-sm">
            {summaryMetrics.map((m) => (
              <div key={m.label} className="flex flex-col">
                <span className="font-label-caps text-label-caps uppercase text-[#6B625B] font-semibold">{m.label}</span>
                <span className={`font-headline-sm text-headline-sm font-bold ${m.color}`}>{m.value}</span>
                <span className="font-label-code-sm text-label-code-sm text-[#6B625B] mt-space-2xs">{m.sub}</span>
              </div>
            ))}
          </div>

          {/* SVG chart */}
          <div className="relative w-full h-64 mt-space-xs flex flex-col justify-end">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 700 220" preserveAspectRatio="none">
              <defs>
                <linearGradient id="terracottaArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%"   stopColor="#D97757" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#D97757" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="amberArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%"   stopColor="#6B625B" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="#6B625B" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Grid lines */}
              <line stroke="#E5DED6" strokeDasharray="3,3" x1="0" x2="700" y1="20"  y2="20" />
              <line stroke="#E5DED6" strokeDasharray="3,3" x1="0" x2="700" y1="75"  y2="75" />
              <line stroke="#E5DED6" strokeDasharray="3,3" x1="0" x2="700" y1="130" y2="130" />
              <line stroke="#E5DED6" x1="0" x2="700" y1="185" y2="185" />
              {/* AI fixes area */}
              <polygon fill="url(#amberArea)" points="0,195 0,160 70,150 140,140 210,148 280,120 350,110 420,95 490,90 560,70 630,65 700,50 700,195" />
              {/* Builds area */}
              <polygon fill="url(#terracottaArea)" points="0,195 0,110 70,95 140,85 210,92 280,60 350,55 420,40 490,45 560,30 630,25 700,20 700,195" />
              {/* AI fixes line */}
              <path d="M 0,160 Q 35,155 70,150 T 140,140 T 210,148 T 280,120 T 350,110 T 420,95 T 490,90 T 560,70 T 630,65 T 700,50" fill="none" stroke="#6B625B" strokeWidth="2.5" />
              {/* Builds line */}
              <path d="M 0,110 Q 35,102 70,95 T 140,85 T 210,92 T 280,60 T 350,55 T 420,40 T 490,45 T 560,30 T 630,25 T 700,20" fill="none" stroke="#D97757" strokeWidth="2.5" />
              {/* Data points */}
              <circle cx="280" cy="60"  r="4.5" fill="#D97757" className="animate-pulse" />
              <circle cx="560" cy="30"  r="4.5" fill="#D97757" />
              <circle cx="700" cy="20"  r="4.5" fill="#D97757" />
              <circle cx="280" cy="120" r="4"   fill="#6B625B" />
              <circle cx="560" cy="70"  r="4"   fill="#6B625B" className="animate-pulse" />
              <circle cx="700" cy="50"  r="4"   fill="#6B625B" />
            </svg>
            {/* Time axis */}
            <div className="flex justify-between items-center text-[#6B625B] font-label-code-sm text-label-code-sm pt-space-xs mt-space-2xs">
              {['00:00','04:00','08:00','12:00','16:00','20:00','Now (Live)'].map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-between pt-space-sm mt-space-sm gap-space-sm border-t border-[#E5DED6]">
            <div className="flex items-center gap-space-md">
              <div className="flex items-center gap-space-xs">
                <span className="w-3 h-1.5 rounded-full bg-[#D97757]" />
                <span className="font-label-code-sm text-label-code-sm text-[#2D2926] font-medium">Successful Builds (1,414)</span>
              </div>
              <div className="flex items-center gap-space-xs">
                <span className="w-3 h-1.5 rounded-full bg-[#6B625B]" />
                <span className="font-label-code-sm text-label-code-sm text-[#2D2926] font-medium">AI Autonomous Fixes (132)</span>
              </div>
            </div>
            <div className="flex items-center gap-space-xs text-[#6B625B] font-label-code-sm text-label-code-sm">
              <span className="material-symbols-outlined text-sm text-[#D97757]">cloud_done</span>
              <span>Cluster-Alpha Telemetry Ingestion Active</span>
            </div>
          </div>
        </section>

        {/* AI Agent Stream — 5 cols */}
        <section className="lg:col-span-5 flex flex-col rounded-xl bg-white border border-[#E5DED6] p-space-lg shadow-panel relative overflow-hidden">
          <div className="flex items-center justify-between pb-space-sm mb-space-sm border-b border-[#E5DED6]">
            <div className="flex flex-col">
              <div className="flex items-center gap-space-xs">
                <LivePulse size="md" />
                <h2 className="font-headline-sm text-headline-sm text-[#2D2926] font-semibold tracking-tight">
                  AI Remediation Agent
                </h2>
              </div>
              <span className="font-label-code-sm text-label-code-sm text-[#6B625B] pl-space-md">
                Live Task Orchestration Stream
              </span>
            </div>
            <div className="px-space-sm py-space-2xs rounded-full bg-[#F9ECE7] text-[#99462A] border border-[#D97757]/30 font-label-code-sm text-label-code-sm font-semibold tracking-wide">
              PROCESSING #INC-8924
            </div>
          </div>

          <RemediationTimeline steps={timelineSteps} />

          {/* Terminal preview */}
          <div className="mt-space-md p-space-sm rounded-lg bg-[#FBF9F5] border border-[#E5DED6] font-label-code-sm text-label-code-sm text-[#6B625B] shadow-inner">
            <div className="flex items-center justify-between pb-space-2xs text-[#6B625B] border-b border-[#E5DED6] mb-space-2xs">
              <div className="flex items-center gap-space-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C34A4A]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#B87A36]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#5B7C4B]" />
                <span className="font-label-caps text-label-caps uppercase ml-space-xs text-[#6B625B] font-semibold">Agent Thought Trace</span>
              </div>
              <span className="text-[#99462A] font-mono font-medium">PID: 90242</span>
            </div>
            <div className="text-[#2D2926] font-mono leading-relaxed">
              <span className="text-[#D97757] font-semibold">[AGENT-CORE]</span> Executing npm audit fix --dry-run... AST diff verified. 0 syntax regressions.
            </div>
            <div className="text-[#6B625B] font-mono text-[10px] truncate mt-0.5">
              ➜ Sandbox container 'ephem-val-8924' health: OK (memory: 382MB, cpu: 14%)
            </div>
          </div>
        </section>
      </div>

      {/* ── Recent Incidents Table ────────────────────────────────────────── */}
      <section className="rounded-xl bg-white border border-[#E5DED6] p-4 sm:p-6 lg:p-space-lg shadow-panel flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-space-sm mb-space-base">
          <div className="flex items-center gap-space-sm">
            <div className="p-space-xs rounded-lg bg-[#F9ECE7] border border-[#D97757]/30 text-[#D97757]">
              <span className="material-symbols-outlined text-xl">security</span>
            </div>
            <div>
              <h2 className="font-headline-md text-base sm:text-headline-md text-[#2D2926] font-semibold tracking-tight">
                Recent Incidents &amp; Automated Interventions
              </h2>
              <p className="font-body-sm text-xs sm:text-body-sm text-[#6B625B]">
                Real-time incident log with AI diagnostic confidence, remediation states, and manual override channels
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-space-sm flex-wrap">
            <div className="flex items-center gap-space-2xs px-2.5 sm:px-space-sm py-1.5 sm:py-space-xs rounded-lg bg-[#F2EDE6] border border-[#E5DED6] text-[#6B625B] text-xs sm:text-body-sm cursor-pointer hover:text-[#2D2926]">
              <span className="material-symbols-outlined text-sm sm:text-base">filter_list</span>
              <span className="font-medium">Filter: All Repos</span>
              <span className="material-symbols-outlined text-xs sm:text-sm">expand_more</span>
            </div>
            <button className="px-3 sm:px-space-md py-1.5 sm:py-space-xs rounded-lg bg-[#D97757] hover:bg-[#C66849] text-white font-headline-sm text-xs sm:text-body-sm font-bold shadow-sm transition-all">
              Export Audit Trail
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left font-body-sm text-body-sm min-w-[760px]">
            <thead>
              <tr className="bg-[#FBF9F5] text-[#6B625B] border-y border-[#E5DED6] uppercase font-label-caps text-label-caps">
                {['Repository','Pipeline','Failure','Root Cause','AI Confidence','Status','Time','Actions'].map((h, i) => (
                  <th key={h} className={`py-space-sm px-space-base ${i === 7 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DED6] text-[#2D2926]">
              {incidentList.map((inc, idx) => (
                <tr key={inc.id} className={`hover:bg-[#FBF9F5] transition-colors group ${idx % 2 === 1 ? 'bg-[#FAF7F2]/60' : ''}`}>
                  <td className="py-space-base px-space-base">
                    <div className="flex items-center gap-space-xs">
                      <span className="material-symbols-outlined text-base text-[#6B625B] group-hover:text-[#D97757] transition-colors">folder</span>
                      <span className="font-label-code-md text-label-code-md font-semibold text-[#2D2926]">{inc.repo}</span>
                    </div>
                  </td>
                  <td className="py-space-base px-space-base">
                    <span className="px-space-xs py-space-2xs rounded bg-[#F2EDE6] border border-[#E5DED6] text-[#6B625B] font-label-code-sm text-label-code-sm">
                      {inc.pipeline}
                    </span>
                  </td>
                  <td className="py-space-base px-space-base">
                    <span className="text-[#C34A4A] font-medium">{inc.failure}</span>
                  </td>
                  <td className="py-space-base px-space-base">
                    <span className="font-label-code-sm text-label-code-sm text-[#6B625B] max-w-xs block truncate" title={inc.rootCause}>
                      {inc.rootCause}
                    </span>
                  </td>
                  <td className="py-space-base px-space-base">
                    <div className="flex items-center gap-space-xs">
                      <div className="w-16 bg-[#F2EDE6] rounded-full h-1.5 overflow-hidden border border-[#E5DED6]">
                        <div
                          className={`h-1.5 rounded-full ${inc.confidenceColor === 'error' ? 'bg-[#C34A4A]' : inc.confidenceColor === 'tertiary' ? 'bg-[#B87A36]' : 'bg-[#D97757]'}`}
                          style={{ width: `${inc.confidence}%` }}
                        />
                      </div>
                      <span className={`font-label-code-sm text-label-code-sm font-semibold ${inc.confidenceColor === 'error' ? 'text-[#C34A4A]' : inc.confidenceColor === 'tertiary' ? 'text-[#B87A36]' : 'text-[#D97757]'}`}>
                        {inc.confidence}%
                      </span>
                    </div>
                  </td>
                  <td className="py-space-base px-space-base">
                    <StatusBadge status={inc.status} />
                  </td>
                  <td className="py-space-base px-space-base font-label-code-sm text-label-code-sm text-[#6B625B]">
                    {inc.time}
                  </td>
                  <td className="py-space-base px-space-base text-right">
                    <Link to="/incidents">
                      <button className={`px-space-sm py-space-2xs rounded font-label-code-sm text-label-code-sm font-medium transition-colors shadow-sm ${
                        inc.actionVariant === 'primary'
                          ? 'bg-[#D97757] text-white hover:bg-[#C66849] font-bold'
                          : 'bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] text-[#2D2926]'
                      }`}>
                        {inc.actionLabel || 'View Details'}
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-space-md mt-space-sm gap-space-sm text-[#6B625B] font-label-code-sm text-label-code-sm border-t border-[#E5DED6]">
          <div className="flex items-center gap-space-xs">
            <span>Showing 5 of 14 active and resolved incidents</span>
            <span className="w-1 h-1 rounded-full bg-[#6B625B]" />
            <span className="text-[#D97757] font-semibold">Autopilot Mode Enabled</span>
          </div>
          <div className="flex items-center gap-space-xs">
            <button disabled className="px-space-sm py-space-2xs rounded bg-white border border-[#E5DED6] text-[#6B625B] transition-colors shadow-sm opacity-50" >Previous</button>
            {[1,2,3].map((p) => (
              <button key={p} className={`px-space-sm py-space-2xs rounded shadow-sm ${p === 1 ? 'bg-[#D97757] text-white font-bold' : 'bg-white border border-[#E5DED6] text-[#6B625B] hover:text-[#2D2926]'}`}>{p}</button>
            ))}
            <button className="px-space-sm py-space-2xs rounded bg-white border border-[#E5DED6] text-[#6B625B] hover:text-[#2D2926] transition-colors shadow-sm">Next</button>
          </div>
        </div>
      </section>
    </div>
  );
}
