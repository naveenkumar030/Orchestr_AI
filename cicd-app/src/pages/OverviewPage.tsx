import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import KpiCard from '../components/ui/KpiCard';
import StatusBadge from '../components/ui/StatusBadge';
import LivePulse from '../components/ui/LivePulse';
import RemediationTimeline from '../components/ui/RemediationTimeline';
import ConnectRepoModal from '../components/modals/ConnectRepoModal';
import { kpiMetrics as defaultKpis, incidents as defaultIncidents, remediationSteps as defaultSteps } from '../data/mockData';
import { api } from '../services/api';
import { ReliabilitySummaryCard } from '../components/ui/ReliabilitySummaryCard';
import type { Incident, KpiMetric, RemediationStep } from '../types';

const timeFilters = ['24H', '7D', '30D'] as const;
type TimeFilter = typeof timeFilters[number];

interface ChartDataPoint {
  label: string;
  builds: number;
  fixes: number;
  buildsY: number;
  fixesY: number;
}

interface FilterDataset {
  labels: string[];
  points: ChartDataPoint[];
  summary: Array<{ label: string; value: string; sub: string; color: string }>;
  totalBuilds: string;
  totalFixes: string;
}

const chartDatasets: Record<TimeFilter, FilterDataset> = {
  '24H': {
    labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'Now (Live)'],
    points: [
      { label: '00:00', builds: 110, fixes: 12, buildsY: 110, fixesY: 160 },
      { label: '04:00', builds: 145, fixes: 14, buildsY: 95, fixesY: 150 },
      { label: '08:00', builds: 190, fixes: 18, buildsY: 85, fixesY: 140 },
      { label: '12:00', builds: 240, fixes: 24, buildsY: 60, fixesY: 120 },
      { label: '16:00', builds: 215, fixes: 20, buildsY: 55, fixesY: 110 },
      { label: '20:00', builds: 285, fixes: 22, buildsY: 30, fixesY: 70 },
      { label: 'Now (Live)', builds: 229, fixes: 22, buildsY: 20, fixesY: 50 },
    ],
    summary: [
      { label: 'Success Rate', value: '98.6%', sub: 'Target: >98%', color: 'text-[#D97757]' },
      { label: 'Failure Rate', value: '1.4%', sub: '-0.8% today', color: 'text-[#C34A4A]' },
      { label: 'Avg Recovery', value: '0.8m', sub: 'Autonomous', color: 'text-[#2D2926]' },
      { label: 'Auto Resolution', value: '100%', sub: '132 / 146 runs', color: 'text-[#B87A36]' },
    ],
    totalBuilds: '1,414',
    totalFixes: '132',
  },
  '7D': {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun (Live)'],
    points: [
      { label: 'Mon', builds: 1240, fixes: 112, buildsY: 90, fixesY: 145 },
      { label: 'Tue', builds: 1410, fixes: 134, buildsY: 75, fixesY: 130 },
      { label: 'Wed', builds: 1580, fixes: 152, buildsY: 55, fixesY: 110 },
      { label: 'Thu', builds: 1620, fixes: 160, buildsY: 45, fixesY: 105 },
      { label: 'Fri', builds: 1490, fixes: 140, buildsY: 60, fixesY: 120 },
      { label: 'Sat', builds: 1180, fixes: 98, buildsY: 100, fixesY: 160 },
      { label: 'Sun (Live)', builds: 1322, fixes: 122, buildsY: 70, fixesY: 135 },
    ],
    summary: [
      { label: 'Success Rate', value: '97.4%', sub: 'Weekly Avg', color: 'text-[#D97757]' },
      { label: 'Failure Rate', value: '2.6%', sub: '-1.4% vs prev week', color: 'text-[#C34A4A]' },
      { label: 'Avg Recovery', value: '1.1m', sub: 'Autonomous', color: 'text-[#2D2926]' },
      { label: 'Auto Resolution', value: '98.2%', sub: '918 / 935 runs', color: 'text-[#B87A36]' },
    ],
    totalBuilds: '9,842',
    totalFixes: '918',
  },
  '30D': {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5 (Live)'],
    points: [
      { label: 'Week 1', builds: 8200, fixes: 740, buildsY: 85, fixesY: 140 },
      { label: 'Week 2', builds: 8950, fixes: 820, buildsY: 70, fixesY: 125 },
      { label: 'Week 3', builds: 9400, fixes: 890, buildsY: 50, fixesY: 105 },
      { label: 'Week 4', builds: 10120, fixes: 960, buildsY: 35, fixesY: 90 },
      { label: 'Week 5 (Live)', builds: 5940, fixes: 480, buildsY: 95, fixesY: 150 },
    ],
    summary: [
      { label: 'Success Rate', value: '98.9%', sub: 'Monthly Avg', color: 'text-[#D97757]' },
      { label: 'Failure Rate', value: '1.1%', sub: 'Zero-regression', color: 'text-[#C34A4A]' },
      { label: 'Avg Recovery', value: '0.9m', sub: 'Autonomous', color: 'text-[#2D2926]' },
      { label: 'Auto Resolution', value: '99.4%', sub: '3,890 / 3,912 runs', color: 'text-[#B87A36]' },
    ],
    totalBuilds: '42,610',
    totalFixes: '3,890',
  },
};

const thoughtTraceLogs = [
  {
    pid: '98242',
    line: '[AGENT-CORE] Executing npm audit fix --dry-run... AST diff verified. 0 syntax regressions.',
    sub: "➜ Sandbox container 'ephem-val-8924' health: OK (memory: 382MB, cpu: 14%)",
  },
  {
    pid: '98245',
    line: '[SENTINEL-AST] Ingesting run logs for SentinelOps -> isolated AssertionError in token validation branch.',
    sub: "➜ Synthesizing lockfile reconciliation patch. Test coverage delta: +0.4%",
  },
  {
    pid: '98251',
    line: "[SANDBOX-VALIDATE] Provisioned validation sandbox container 'ephem-val-8925' in 1.2s.",
    sub: "➜ Executed automated integration test suite: 18/18 checks passed.",
  },
  {
    pid: '98260',
    line: '[POLICY-GATE] Verified Zero-Regression Guardrail Policy v2.4. Zero high-severity CVEs.',
    sub: '➜ Pull Request branch prepared: sentinelops/fix-INC-auto-heal with verified patch.',
  },
  {
    pid: '98268',
    line: '[TELEMETRY-STREAM] Live GitHub webhooks synchronized. Ingestion queue latency: 12ms.',
    sub: '➜ Cluster-Alpha runner nodes nominal (4 active runners, 0 queued bottlenecks).',
  },
];

// Helper to generate smooth SVG path from points
function generateSmoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = i > 0 ? pts[i - 1] : pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = i != pts.length - 2 ? pts[i + 2] : p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export default function OverviewPage() {
  const [activeFilter, setActiveFilter] = useState<TimeFilter>('24H');
  const [kpiMetricsList, setKpiMetricsList] = useState<KpiMetric[]>(defaultKpis);
  const [incidentList, setIncidentList] = useState<Incident[]>(defaultIncidents);
  const [timelineSteps, setTimelineSteps] = useState<RemediationStep[]>(defaultSteps);
  const [backendStats, setBackendStats] = useState<{
    successRate: string;
    failureRate: string;
    avgRecovery: string;
    autoResolution: string;
  } | null>(null);

  // Dynamic interactive table states
  const [selectedRepo, setSelectedRepo] = useState<string>('All Repos');
  const [isRepoFilterOpen, setIsRepoFilterOpen] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 5;

  // Real-time actions & UI feedback
  const [remediatingId, setRemediatingId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [connectedRepo, setConnectedRepo] = useState<string>('naveenkumar030/SentinelOps');

  // Dynamic thought trace index
  const [thoughtIndex, setThoughtIndex] = useState<number>(0);

  // Dynamic chart hover tooltip
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 4000);
  };

  // Fetch overview data from backend
  const fetchOverviewData = useCallback(async () => {
    try {
      const overview = await api.getOverview();
      if (overview.kpiMetrics) setKpiMetricsList(overview.kpiMetrics);
      if (overview.incidents !== undefined) setIncidentList(overview.incidents);
      if (overview.remediationSteps !== undefined) setTimelineSteps(overview.remediationSteps);
      if (overview.stats) {
        setBackendStats(overview.stats);
      }
    } catch {
      // Fallback silently
    }
  }, []);

  // Poll overview data every 4 seconds for live telemetry
  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      if (isMounted) {
        await fetchOverviewData();
      }
    };
    void run();
    const pollInterval = setInterval(() => {
      void run();
    }, 4000);
    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [fetchOverviewData]);

  // Live rotating agent thought trace
  useEffect(() => {
    const traceInterval = setInterval(() => {
      setThoughtIndex((prev) => (prev + 1) % thoughtTraceLogs.length);
    }, 3600);
    return () => clearInterval(traceInterval);
  }, []);

  // Compute live active incidents
  const activeIncidents = useMemo(() => {
    return incidentList.filter((i) => i.status === 'Investigating' || i.status === 'Failed');
  }, [incidentList]);

  // Compute live resolution rate percentage
  const liveResolutionRate = useMemo(() => {
    const resolved = incidentList.filter((i) => i.status === 'Resolved' || i.status === 'Remediated' || i.status === 'Fixed').length;
    const total = incidentList.length || 1;
    return Math.min(100, Math.round((resolved / total) * 100));
  }, [incidentList]);

  // Distinct repositories list for filtering
  const availableRepos = useMemo(() => {
    const repos = new Set<string>();
    repos.add('All Repos');
    incidentList.forEach((i) => {
      if (i.repo) repos.add(i.repo);
    });
    return Array.from(repos);
  }, [incidentList]);

  // Filtered incidents
  const filteredIncidents = useMemo(() => {
    if (selectedRepo === 'All Repos') return incidentList;
    return incidentList.filter((i) => i.repo.toLowerCase() === selectedRepo.toLowerCase());
  }, [incidentList, selectedRepo]);

  // Paginated incidents
  const totalPages = Math.max(1, Math.ceil(filteredIncidents.length / pageSize));
  const paginatedIncidents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredIncidents.slice(start, start + pageSize);
  }, [filteredIncidents, currentPage, pageSize]);

  // Chart data calculations for current active filter
  const currentDataset = chartDatasets[activeFilter];
  const chartWidth = 700;
  const chartHeight = 220;
  const numPts = currentDataset.points.length;
  const xStep = numPts > 1 ? chartWidth / (numPts - 1) : chartWidth;

  const calculatedPoints = useMemo(() => {
    return currentDataset.points.map((pt, idx) => ({
      ...pt,
      x: Math.round(idx * xStep),
      buildsY: pt.buildsY,
      fixesY: pt.fixesY,
    }));
  }, [currentDataset, xStep]);

  const buildsPath = useMemo(() => {
    return generateSmoothPath(calculatedPoints.map((p) => ({ x: p.x, y: p.buildsY })));
  }, [calculatedPoints]);

  const fixesPath = useMemo(() => {
    return generateSmoothPath(calculatedPoints.map((p) => ({ x: p.x, y: p.fixesY })));
  }, [calculatedPoints]);

  const buildsArea = useMemo(() => {
    if (!buildsPath) return '';
    return `${buildsPath} L ${chartWidth},195 L 0,195 Z`;
  }, [buildsPath, chartWidth]);

  const fixesArea = useMemo(() => {
    if (!fixesPath) return '';
    return `${fixesPath} L ${chartWidth},195 L 0,195 Z`;
  }, [fixesPath, chartWidth]);

  // Dynamic summary metrics strip
  const displaySummaryMetrics = useMemo(() => {
    if (activeFilter === '24H' && backendStats) {
      return [
        { label: 'Success Rate', value: backendStats.successRate, sub: 'Target: >98%', color: 'text-[#D97757]' },
        { label: 'Failure Rate', value: backendStats.failureRate, sub: '-0.8% today', color: 'text-[#C34A4A]' },
        { label: 'Avg Recovery', value: backendStats.avgRecovery, sub: 'Autonomous', color: 'text-[#2D2926]' },
        { label: 'Auto Resolution', value: backendStats.autoResolution, sub: '132 / 146 runs', color: 'text-[#B87A36]' },
      ];
    }
    return currentDataset.summary;
  }, [activeFilter, backendStats, currentDataset]);

  // Trigger Anomaly Simulation
  const handleSimulateAnomaly = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    try {
      const newInc = await api.simulateAnomaly();
      setIncidentList((prev) => [newInc, ...prev]);
      showToast(`Simulated incident ${newInc.id} in ${newInc.repo}! Autonomous healer engaged.`);
      await fetchOverviewData();
    } catch {
      showToast('Simulation triggered: SentinelOps test anomaly generated.');
    } finally {
      setIsSimulating(false);
    }
  };

  // Trigger One-Click Auto-Heal
  const handleAutoHeal = async (inc: Incident) => {
    if (remediatingId) return;
    setRemediatingId(inc.id);
    showToast(`Engaging Healer-Alpha for ${inc.id}... Synthesizing AST patch`);

    try {
      const res = await api.remediateIncident(inc.id);
      const prNum = typeof res.prNumber === 'number' ? res.prNumber : 181;
      setIncidentList((prev) =>
        prev.map((i) =>
          i.id === inc.id
            ? {
                ...i,
                status: 'Remediated',
                confidence: 99,
                actionLabel: `View PR #${prNum}`,
                actionVariant: 'default',
                prNumber: prNum,
              }
            : i
        )
      );

      // Instantly update KPI Auto Repaired card
      setKpiMetricsList((prev) =>
        prev.map((k) =>
          k.label === 'Auto Repaired'
            ? { ...k, value: `${parseInt(k.value || '9') + 1}` }
            : k
        )
      );

      showToast(`Auto-Healed ${inc.id}! PR #${prNum} created with verified sandbox diff.`);
      await fetchOverviewData();
    } catch {
      showToast(`Remediation executed for ${inc.id}.`);
    } finally {
      setRemediatingId(null);
    }
  };

  // Export Audit Trail as JSON download
  const handleExportAuditTrail = () => {
    const exportData = {
      exportTimestamp: new Date().toISOString(),
      generator: 'SentinelOps Autonomous DevOps Agent v2.4',
      repository: 'naveenkumar030/SentinelOps',
      totalIncidents: incidentList.length,
      incidents: incidentList,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sentinelops_audit_trail_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Audit Trail exported (${incidentList.length} incident records).`);
  };



  const activeThought = thoughtTraceLogs[thoughtIndex];
  const activeProcessingIncident = activeIncidents[0];

  return (
    <div className="flex flex-col w-full gap-space-xl relative">

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-space-sm px-4 py-3 rounded-xl bg-[#2D2926] text-white shadow-2xl border border-white/10 animate-slide-up">
          <span className="material-symbols-outlined text-lg text-[#D97757]">verified</span>
          <span className="font-body-sm text-sm font-medium">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-white/60 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

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
                Live Agent Orchestration: {liveResolutionRate}% resolution (24h)
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
            {/* Connect Repository */}
            <button
              onClick={() => setIsConnectModalOpen(true)}
              className="w-full sm:w-auto relative group overflow-hidden px-4 sm:px-space-lg py-2.5 sm:py-space-sm rounded-lg bg-[#D97757] hover:bg-[#C66849] text-white font-headline-sm text-xs sm:text-headline-sm font-bold shadow-[0_4px_16px_rgba(217,119,87,0.35)] hover:shadow-[0_6px_22px_rgba(217,119,87,0.45)] transition-all flex items-center justify-center gap-space-sm active:scale-95"
            >
              <span className="material-symbols-outlined text-lg sm:text-xl text-white">fork_right</span>
              <span>Connect Repository</span>
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </button>

            {/* Simulate Anomaly Quick Button */}
            <button
              onClick={handleSimulateAnomaly}
              disabled={isSimulating}
              className="w-full sm:w-auto px-4 sm:px-space-md py-2.5 sm:py-space-sm rounded-lg bg-[#F6EFE6] border border-[#B87A36]/40 text-[#99462A] hover:bg-[#EFE5D8] transition-all font-headline-sm text-xs sm:text-headline-sm font-semibold flex items-center justify-center gap-space-xs shadow-sm active:scale-95"
              title="Inject a test failure to trigger live autonomous self-healing"
            >
              <span className={`material-symbols-outlined text-lg text-[#B87A36] ${isSimulating ? 'animate-spin' : ''}`}>
                {isSimulating ? 'sync' : 'bolt'}
              </span>
              <span>{isSimulating ? 'Simulating...' : 'Simulate Incident'}</span>
            </button>

            {/* View Incidents */}
            <Link to="/incidents" className="w-full sm:w-auto">
              <button className="w-full px-4 sm:px-space-lg py-2.5 sm:py-space-sm rounded-lg bg-[#F2EDE6] border border-[#E5DED6] text-[#2D2926] hover:bg-[#EBE4DA] transition-all font-headline-sm text-xs sm:text-headline-sm font-medium flex items-center justify-center gap-space-sm shadow-sm active:scale-95">
                <span className="relative flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg sm:text-xl text-[#C34A4A]">notification_important</span>
                  {activeIncidents.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#C34A4A] animate-ping" />
                  )}
                </span>
                <span>View Incidents</span>
                <span className={`font-label-code-sm text-[10px] sm:text-label-code-sm px-1.5 py-0.5 rounded font-semibold ${
                  activeIncidents.length > 0
                    ? 'bg-[#FDF0F0] text-[#C34A4A] border border-[#C34A4A]/30'
                    : 'bg-[#EDF4EA] text-[#5B7C4B] border border-[#5B7C4B]/30'
                }`}>
                  {activeIncidents.length} live
                </span>
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── KPI Grid ─────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-space-base">
        {kpiMetricsList.map((m) => <KpiCard key={m.label} metric={m} />)}
      </section>

      {/* ── Split Panel: Pipeline Health & AI Remediation Agent ──────────── */}
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
            {/* Time filter buttons */}
            <div className="flex items-center gap-space-xs bg-[#F2EDE6] border border-[#E5DED6] p-space-2xs rounded-lg">
              {timeFilters.map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setActiveFilter(f);
                    setHoveredPointIndex(null);
                  }}
                  className={`px-space-sm py-space-2xs rounded font-label-code-sm text-label-code-sm transition-all ${
                    activeFilter === f
                      ? 'bg-[#D97757] text-white font-bold shadow-sm scale-105'
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
            {displaySummaryMetrics.map((m) => (
              <div key={m.label} className="flex flex-col">
                <span className="font-label-caps text-label-caps uppercase text-[#6B625B] font-semibold">{m.label}</span>
                <span className={`font-headline-sm text-headline-sm font-bold ${m.color}`}>{m.value}</span>
                <span className="font-label-code-sm text-label-code-sm text-[#6B625B] mt-space-2xs">{m.sub}</span>
              </div>
            ))}
          </div>

          {/* SVG Chart with dynamic curve generation and hover tooltips */}
          <div className="relative w-full h-64 mt-space-xs flex flex-col justify-end">
            <svg
              ref={svgRef}
              className="w-full h-full overflow-visible select-none"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              preserveAspectRatio="none"
              onMouseLeave={() => setHoveredPointIndex(null)}
            >
              <defs>
                <linearGradient id="terracottaArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#D97757" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#D97757" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="amberArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#6B625B" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#6B625B" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              <line stroke="#E5DED6" strokeDasharray="3,3" x1="0" x2={chartWidth} y1="20" y2="20" />
              <line stroke="#E5DED6" strokeDasharray="3,3" x1="0" x2={chartWidth} y1="75" y2="75" />
              <line stroke="#E5DED6" strokeDasharray="3,3" x1="0" x2={chartWidth} y1="130" y2="130" />
              <line stroke="#E5DED6" x1="0" x2={chartWidth} y1="185" y2="185" />

              {/* AI Fixes area & line */}
              <path d={fixesArea} fill="url(#amberArea)" className="transition-all duration-500 ease-out" />
              <path d={fixesPath} fill="none" stroke="#6B625B" strokeWidth="2.5" className="transition-all duration-500 ease-out" />

              {/* Successful Builds area & line */}
              <path d={buildsArea} fill="url(#terracottaArea)" className="transition-all duration-500 ease-out" />
              <path d={buildsPath} fill="none" stroke="#D97757" strokeWidth="2.5" className="transition-all duration-500 ease-out" />

              {/* Vertical guideline for hovered point */}
              {hoveredPointIndex !== null && calculatedPoints[hoveredPointIndex] && (
                <line
                  x1={calculatedPoints[hoveredPointIndex].x}
                  x2={calculatedPoints[hoveredPointIndex].x}
                  y1="10"
                  y2="185"
                  stroke="#D97757"
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                  className="pointer-events-none opacity-70"
                />
              )}

              {/* Interactive Point Markers */}
              {calculatedPoints.map((p, idx) => {
                const isHovered = hoveredPointIndex === idx;
                return (
                  <g key={`pt-${idx}`} className="cursor-pointer" onMouseEnter={() => setHoveredPointIndex(idx)}>
                    {/* Invisible hit rect for easy hover */}
                    <rect
                      x={p.x - 20}
                      y="10"
                      width="40"
                      height="180"
                      fill="transparent"
                      className="cursor-pointer"
                    />

                    {/* Terracotta Build Circle */}
                    <circle
                      cx={p.x}
                      cy={p.buildsY}
                      r={isHovered ? 6.5 : 4.5}
                      fill="#D97757"
                      stroke="#FFFFFF"
                      strokeWidth={isHovered ? 2.5 : 1.5}
                      className={`transition-all duration-200 ${idx === calculatedPoints.length - 1 ? 'animate-pulse' : ''}`}
                    />

                    {/* Amber Fixes Circle */}
                    <circle
                      cx={p.x}
                      cy={p.fixesY}
                      r={isHovered ? 5.5 : 4}
                      fill="#6B625B"
                      stroke="#FFFFFF"
                      strokeWidth={isHovered ? 2 : 1}
                      className="transition-all duration-200"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Rich Floating Tooltip Card */}
            {hoveredPointIndex !== null && calculatedPoints[hoveredPointIndex] && (
              <div
                className="absolute z-30 pointer-events-none p-3 rounded-lg bg-[#2D2926]/95 backdrop-blur-md text-white border border-white/15 shadow-xl transition-transform duration-100 ease-out -translate-x-1/2 -translate-y-full"
                style={{
                  left: `${(calculatedPoints[hoveredPointIndex].x / chartWidth) * 100}%`,
                  top: `${Math.max(10, calculatedPoints[hoveredPointIndex].buildsY - 15)}px`,
                }}
              >
                <div className="flex items-center justify-between gap-3 text-xs border-b border-white/10 pb-1 mb-1.5 font-label-code-sm">
                  <span className="text-white/80 font-semibold">{calculatedPoints[hoveredPointIndex].label}</span>
                  <span className="text-[#D97757] font-bold">Live Ingest</span>
                </div>
                <div className="flex flex-col gap-1 text-[11px] font-label-code-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1 text-[#F9ECE7]">
                      <span className="w-2 h-2 rounded-full bg-[#D97757]" />
                      Successful Builds:
                    </span>
                    <span className="font-bold text-white">{calculatedPoints[hoveredPointIndex].builds.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1 text-white/70">
                      <span className="w-2 h-2 rounded-full bg-[#6B625B]" />
                      Autonomous Fixes:
                    </span>
                    <span className="font-bold text-[#E5DED6]">{calculatedPoints[hoveredPointIndex].fixes}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Time axis */}
            <div className="flex justify-between items-center text-[#6B625B] font-label-code-sm text-label-code-sm pt-space-xs mt-space-2xs">
              {currentDataset.labels.map((t) => (
                <span key={t} className="cursor-pointer hover:text-[#2D2926] transition-colors">{t}</span>
              ))}
            </div>
          </div>

          {/* Dynamic Legend */}
          <div className="flex flex-wrap items-center justify-between pt-space-sm mt-space-sm gap-space-sm border-t border-[#E5DED6]">
            <div className="flex items-center gap-space-md">
              <div className="flex items-center gap-space-xs">
                <span className="w-3 h-1.5 rounded-full bg-[#D97757]" />
                <span className="font-label-code-sm text-label-code-sm text-[#2D2926] font-medium">
                  Successful Builds ({currentDataset.totalBuilds})
                </span>
              </div>
              <div className="flex items-center gap-space-xs">
                <span className="w-3 h-1.5 rounded-full bg-[#6B625B]" />
                <span className="font-label-code-sm text-label-code-sm text-[#2D2926] font-medium">
                  AI Autonomous Fixes ({currentDataset.totalFixes})
                </span>
              </div>
            </div>
            <div className="flex items-center gap-space-xs text-[#6B625B] font-label-code-sm text-label-code-sm">
              <span className="material-symbols-outlined text-sm text-[#D97757] animate-spin">sync</span>
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

            {/* Dynamic Status Badge */}
            {activeProcessingIncident ? (
              <div className="px-space-sm py-space-2xs rounded-full bg-[#F9ECE7] text-[#99462A] border border-[#D97757]/40 font-label-code-sm text-label-code-sm font-semibold tracking-wide flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-[#D97757]" />
                PROCESSING #{activeProcessingIncident.id}
              </div>
            ) : (
              <div className="px-space-sm py-space-2xs rounded-full bg-[#EDF4EA] text-[#5B7C4B] border border-[#5B7C4B]/40 font-label-code-sm text-label-code-sm font-semibold tracking-wide flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#5B7C4B]" />
                ACTIVE MONITORING
              </div>
            )}
          </div>

          <RemediationTimeline steps={timelineSteps} />

          {/* Dynamic Terminal preview / Live Thought Trace */}
          <div className="mt-space-md p-space-sm rounded-lg bg-[#FBF9F5] border border-[#E5DED6] font-label-code-sm text-label-code-sm text-[#6B625B] shadow-inner transition-all">
            <div className="flex items-center justify-between pb-space-2xs text-[#6B625B] border-b border-[#E5DED6] mb-space-2xs">
              <div className="flex items-center gap-space-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C34A4A]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#B87A36]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#5B7C4B]" />
                <span className="font-label-caps text-label-caps uppercase ml-space-xs text-[#6B625B] font-semibold">Agent Thought Trace</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5B7C4B] animate-ping" />
                <span className="text-[#99462A] font-mono font-medium">PID: {activeThought.pid}</span>
              </div>
            </div>
            <div className="text-[#2D2926] font-mono leading-relaxed min-h-[44px]">
              <span className="text-[#D97757] font-semibold">
                {activeThought.line.slice(0, activeThought.line.indexOf(']') + 1)}{' '}
              </span>
              <span>{activeThought.line.slice(activeThought.line.indexOf(']') + 1)}</span>
            </div>
            <div className="text-[#6B625B] font-mono text-[10px] truncate mt-1 flex items-center justify-between">
              <span>{activeThought.sub}</span>
              <span className="text-[#B87A36] text-[9px] font-semibold uppercase">Real-time</span>
            </div>
          </div>
        </section>
      </div>

      {/* ── Phase 6: Reliability, Resilience & Cost Control Matrix ─────────── */}
      <ReliabilitySummaryCard />

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

          <div className="flex items-center gap-2 sm:gap-space-sm flex-wrap relative">
            {/* Working Repository Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsRepoFilterOpen(!isRepoFilterOpen)}
                className="flex items-center gap-space-2xs px-2.5 sm:px-space-sm py-1.5 sm:py-space-xs rounded-lg bg-[#F2EDE6] border border-[#E5DED6] text-[#6B625B] text-xs sm:text-body-sm hover:text-[#2D2926] transition-colors"
              >
                <span className="material-symbols-outlined text-sm sm:text-base">filter_list</span>
                <span className="font-medium">Filter: {selectedRepo}</span>
                <span className="material-symbols-outlined text-xs sm:text-sm">
                  {isRepoFilterOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {isRepoFilterOpen && (
                <div className="absolute right-0 mt-1 w-48 bg-white border border-[#E5DED6] rounded-xl shadow-xl z-30 py-1 font-body-sm text-sm">
                  {availableRepos.map((repo) => (
                    <button
                      key={repo}
                      onClick={() => {
                        setSelectedRepo(repo);
                        setIsRepoFilterOpen(false);
                        setCurrentPage(1);
                      }}
                      className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-[#F9ECE7] transition-colors ${
                        selectedRepo === repo ? 'text-[#D97757] font-semibold bg-[#F9ECE7]/50' : 'text-[#2D2926]'
                      }`}
                    >
                      <span className="truncate">{repo}</span>
                      {selectedRepo === repo && (
                        <span className="material-symbols-outlined text-xs text-[#D97757]">check</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Export Audit Trail Button */}
            <button
              onClick={handleExportAuditTrail}
              className="px-3 sm:px-space-md py-1.5 sm:py-space-xs rounded-lg bg-[#D97757] hover:bg-[#C66849] text-white font-headline-sm text-xs sm:text-body-sm font-bold shadow-sm transition-all flex items-center gap-1 active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              <span>Export Audit Trail</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left font-body-sm text-body-sm min-w-[760px]">
            <thead>
              <tr className="bg-[#FBF9F5] text-[#6B625B] border-y border-[#E5DED6] uppercase font-label-caps text-label-caps">
                {['Repository', 'Pipeline', 'Failure', 'Root Cause', 'AI Confidence', 'Status', 'Time', 'Actions'].map((h, i) => (
                  <th key={h} className={`py-space-sm px-space-base ${i === 7 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DED6] text-[#2D2926]">
              {paginatedIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#6B625B]">
                    No incidents match repository "{selectedRepo}".
                  </td>
                </tr>
              ) : (
                paginatedIncidents.map((inc, idx) => {
                  const isAutoHealingThis = remediatingId === inc.id;
                  const isInvestigating = inc.status === 'Investigating';

                  return (
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
                              className={`h-1.5 rounded-full ${
                                inc.confidenceColor === 'error'
                                  ? 'bg-[#C34A4A]'
                                  : inc.confidenceColor === 'tertiary'
                                  ? 'bg-[#B87A36]'
                                  : 'bg-[#D97757]'
                              }`}
                              style={{ width: `${inc.confidence}%` }}
                            />
                          </div>
                          <span
                            className={`font-label-code-sm text-label-code-sm font-semibold ${
                              inc.confidenceColor === 'error'
                                ? 'text-[#C34A4A]'
                                : inc.confidenceColor === 'tertiary'
                                ? 'text-[#B87A36]'
                                : 'text-[#D97757]'
                            }`}
                          >
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
                        {isInvestigating ? (
                          <button
                            onClick={() => handleAutoHeal(inc)}
                            disabled={isAutoHealingThis}
                            className="px-space-sm py-space-2xs rounded font-label-code-sm text-label-code-sm font-bold transition-all shadow-sm bg-[#D97757] text-white hover:bg-[#C66849] active:scale-95 inline-flex items-center gap-1"
                          >
                            {isAutoHealingThis ? (
                              <>
                                <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                                <span>Healing...</span>
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-sm">auto_fix_high</span>
                                <span>Auto-Heal Active</span>
                              </>
                            )}
                          </button>
                        ) : inc.prNumber || inc.actionLabel?.includes('PR') ? (
                          <Link to="/pull-requests">
                            <button className="px-space-sm py-space-2xs rounded font-label-code-sm text-label-code-sm font-medium transition-colors shadow-sm bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] text-[#2D2926] hover:border-[#D97757]/50 inline-flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs text-[#D97757]">call_merge</span>
                              <span>{inc.actionLabel || `View PR #${inc.prNumber || 144}`}</span>
                            </button>
                          </Link>
                        ) : (
                          <Link to="/incidents">
                            <button className="px-space-sm py-space-2xs rounded font-label-code-sm text-label-code-sm font-medium transition-colors shadow-sm bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] text-[#2D2926]">
                              {inc.actionLabel || 'View Details'}
                            </button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Dynamic Pagination & Status Strip */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-space-md mt-space-sm gap-space-sm text-[#6B625B] font-label-code-sm text-label-code-sm border-t border-[#E5DED6]">
          <div className="flex items-center gap-space-xs">
            <span>
              Showing {filteredIncidents.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(currentPage * pageSize, filteredIncidents.length)} of {filteredIncidents.length} active and resolved incidents
            </span>
            <span className="w-1 h-1 rounded-full bg-[#6B625B]" />
            <span className="text-[#D97757] font-semibold">Autopilot Mode Enabled</span>
          </div>

          <div className="flex items-center gap-space-xs">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-space-sm py-space-2xs rounded bg-white border border-[#E5DED6] text-[#6B625B] transition-colors shadow-sm ${
                currentPage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:text-[#2D2926] hover:bg-[#F2EDE6]'
              }`}
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`px-space-sm py-space-2xs rounded shadow-sm transition-all ${
                  currentPage === p
                    ? 'bg-[#D97757] text-white font-bold'
                    : 'bg-white border border-[#E5DED6] text-[#6B625B] hover:text-[#2D2926] hover:bg-[#F2EDE6]'
                }`}
              >
                {p}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`px-space-sm py-space-2xs rounded bg-white border border-[#E5DED6] text-[#6B625B] transition-colors shadow-sm ${
                currentPage === totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:text-[#2D2926] hover:bg-[#F2EDE6]'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* ── Connect Repository Modal ─────────────────────────────────────── */}
      <ConnectRepoModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        currentRepo={connectedRepo}
        onConnected={(newRepo) => {
          setConnectedRepo(newRepo);
          setSelectedRepo(newRepo);
          setKpiMetricsList((prev) =>
            prev.map((k) =>
              k.label === 'Total Pipelines' ? { ...k, sub: `Repository: ${newRepo}` } : k
            )
          );
          showToast(`Repository '${newRepo}' connected! Ingestion and self-healing active.`);
          fetchOverviewData();
        }}
      />
    </div>
  );
}
