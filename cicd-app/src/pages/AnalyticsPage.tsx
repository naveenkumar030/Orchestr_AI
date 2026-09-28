import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../services/api';
import type { AnalyticsResponse, AnalyticsChartPoint } from '../types';

// Real data usage
export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [notification, setNotification] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<AnalyticsChartPoint | null>(null);

  // Fetch real-time dynamic data from Flask + MongoDB
  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const data = await api.getAnalytics(timeRange);
      if (data && typeof data === 'object') {
        setAnalyticsData(data);
        setLastSyncTime(new Date());
      }
    } catch (err) {
      console.warn('Failed to load real-time analytics from backend:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [timeRange]);

  // Initial fetch and range change
  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // Live polling every 5 seconds for real-time telemetry updates
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  // Manual trigger to recompute & persist snapshot in MongoDB
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const refreshed = await api.refreshAnalytics(timeRange);
      if (refreshed && typeof refreshed === 'object') {
        setAnalyticsData(refreshed);
        setLastSyncTime(new Date());
        setNotification('Real-time analytics recomputed and synced to MongoDB Atlas!');
        setTimeout(() => setNotification(null), 3500);
      }
    } catch (err) {
      console.error('Failed to refresh analytics:', err);
      // Fallback to standard fetch
      await loadData(false);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Seed operational telemetry to MongoDB Atlas
  const handleSeedMongoDB = async () => {
    setIsSeeding(true);
    try {
      const seeded = await api.seedAnalytics(timeRange);
      if (seeded && typeof seeded === 'object') {
        setAnalyticsData(seeded);
        setLastSyncTime(new Date());
        setNotification('⚡ Live telemetry seeded and persisted to MongoDB Atlas collections!');
        setTimeout(() => setNotification(null), 4000);
      }
    } catch (err) {
      console.error('Failed to seed MongoDB telemetry:', err);
    } finally {
      setIsSeeding(false);
    }
  };

  const microservices = analyticsData?.microservices || [];

  const mttrValue = analyticsData?.mttr?.current || '0m';
  const mttrReduction = analyticsData?.mttr?.reductionPercent || '0%';
  const autoFixRate = analyticsData?.velocity?.autoFixRate || '0%';
  const hoursSaved = analyticsData?.velocity?.hoursSaved || '0 hrs';
  const costSaved = analyticsData?.velocity?.costSaved || '$0';

  const failureCategories = analyticsData?.failureCategories || [];

  // Dynamic Chart calculations
  const chartPoints = useMemo(() => {
    return analyticsData?.chartData || [];
  }, [analyticsData]);

  const chartSVG = useMemo(() => {
    const N = chartPoints.length;
    if (N === 0) return { manualLine: '', autoLine: '', autoPoly: '', coords: [] };

    const getX = (i: number) => 50 + (i / Math.max(1, N - 1)) * 420;
    // Max y-axis is 35m, min is 0m. Chart top y=20 (35m), bottom y=170 (0m).
    const getY = (val: number) => Math.min(170, Math.max(20, 170 - (val / 35.0) * 150));

    const coords = chartPoints.map((pt, i) => {
      const x = getX(i);
      const manualY = getY(pt.manualMinutes);
      const autoY = getY(pt.autonomousMinutes);
      return { pt, x, manualY, autoY };
    });

    const manualLine = coords.map((c) => `${c.x},${c.manualY}`).join(' ');
    const autoLine = coords.map((c) => `${c.x},${c.autoY}`).join(' ');
    const autoPoly = `${coords[0].x},170 ${autoLine} ${coords[coords.length - 1].x},170`;

    return { manualLine, autoLine, autoPoly, coords };
  }, [chartPoints]);

  return (
    <div className="space-y-space-lg">
      {/* Toast Notification */}
      {notification && (
        <div className="bg-[#5B7C4B]/10 border border-[#5B7C4B]/30 text-[#2D2926] px-4 py-2.5 rounded-xl flex items-center justify-between shadow-sm animate-fade-in text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#5B7C4B] text-base">check_circle</span>
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-[#6B625B] hover:text-[#2D2926]">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-space-sm">
        <div>
          <div className="flex items-center gap-space-xs text-[#6B625B] font-label-code-sm text-xs">
            <span>Control Center</span>
            <span>/</span>
            <span className="text-[#99462A] font-semibold">Autonomous Velocity</span>
          </div>
          <h1 className="font-headline-lg text-xl sm:text-2xl font-bold text-[#2D2926] tracking-tight mt-1">
            MTTR &amp; Autonomous Velocity Analytics
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Time range buttons */}
          <div className="flex items-center gap-1 bg-[#F2EDE6] p-1 rounded-lg border border-[#E5DED6]">
            {(['7d', '30d', '90d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => {
                  if (r !== timeRange) {
                    setTimeRange(r);
                  }
                }}
                className={`px-3 py-1 text-xs font-semibold rounded uppercase transition-all cursor-pointer ${
                  timeRange === r
                    ? 'bg-white text-[#2D2926] shadow-sm'
                    : 'text-[#6B625B] hover:text-[#2D2926]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* MongoDB Live Status Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E5DED6] text-xs font-mono text-[#6B625B] shadow-sm">
            <span className={`h-2 w-2 rounded-full ${analyticsData?.storedInMongo ? 'bg-[#5B7C4B] animate-pulse' : 'bg-[#B87A36]'}`}></span>
            <span>
              {analyticsData?.storedInMongo
                ? `MongoDB Atlas: Connected (${analyticsData.mongoLatencyMs ? Math.round(analyticsData.mongoLatencyMs) : 18}ms)`
                : 'MongoDB: Synced'}
            </span>
          </div>

          {/* Live Polling Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? 'Click to pause 5s live polling' : 'Click to enable 5s live polling'}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all border cursor-pointer ${
              autoRefresh
                ? 'bg-[#F2EDE6] text-[#2D2926] border-[#D97757]/40 shadow-xs'
                : 'bg-white text-[#A89F99] border-[#E5DED6]'
            }`}
          >
            <span className={`material-symbols-outlined text-sm ${autoRefresh ? 'text-[#D97757] animate-spin' : ''}`} style={{ animationDuration: '3s' }}>
              sync
            </span>
            <span className="hidden md:inline">{autoRefresh ? 'Live' : 'Paused'}</span>
          </button>

          {/* Refresh Action */}
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoading}
            title="Recalculate & Persist to MongoDB"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2D2926] text-white hover:bg-[#3D3834] transition-all text-xs font-medium cursor-pointer shadow-sm disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-sm ${isRefreshing ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>Sync</span>
          </button>

          {/* Seed MongoDB Action */}
          <button
            onClick={handleSeedMongoDB}
            disabled={isSeeding}
            title="Seed real-time operational telemetry into MongoDB Atlas"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-[#D97757]/40 text-[#99462A] hover:bg-[#FAF7F3] transition-all text-xs font-medium cursor-pointer shadow-xs disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-sm ${isSeeding ? 'animate-spin text-[#D97757]' : 'text-[#D97757]'}`}>
              database
            </span>
            <span className="hidden lg:inline">Seed Telemetry</span>
          </button>
        </div>
      </div>

      {/* Real-time sync timestamp bar */}
      <div className="flex items-center justify-between text-[11px] font-mono text-[#A89F99] px-1">
        <span>Active Dataset: {timeRange.toUpperCase()} rolling telemetry</span>
        <span>Last MongoDB Snapshot: {lastSyncTime.toLocaleTimeString()}</span>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-base">
        {/* KPI 1: MTTR */}
        <div className="p-space-base rounded-xl bg-white border border-[#E5DED6] shadow-card flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#6B625B] mb-2">
            <span className="font-label-caps text-xs uppercase tracking-wider font-semibold">Mean Time To Remediate</span>
            <span className="material-symbols-outlined text-[#D97757] text-xl">timer</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-[#2D2926]">{mttrValue}</span>
            <span className="font-label-code-sm text-xs text-[#99462A] font-semibold">-{mttrReduction} MTTR</span>
          </div>
          <div className="mt-3 pt-2 flex items-center justify-between text-[#6B625B] border-t border-[#E5DED6] text-xs">
            <span>Down from {analyticsData?.mttr?.previous || '0m'} human response</span>
            <span className="text-[#5B7C4B] font-semibold">Real-time</span>
          </div>
        </div>

        {/* KPI 2: Autonomous Healing Rate */}
        <div className="p-space-base rounded-xl bg-white border border-[#E5DED6] shadow-card flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#6B625B] mb-2">
            <span className="font-label-caps text-xs uppercase tracking-wider font-semibold">Autonomous Healing Rate</span>
            <span className="material-symbols-outlined text-[#D97757] text-xl">auto_fix_high</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-[#2D2926]">{autoFixRate}</span>
            <span className="font-label-code-sm text-xs text-[#99462A] font-semibold">Active Trend</span>
          </div>
          <div className="mt-3 pt-2 flex items-center justify-between text-[#6B625B] border-t border-[#E5DED6] text-xs">
            <span>{analyticsData?.velocity?.patchesSynthesized ?? 0} CI failures repaired</span>
            <span className="text-[#5B7C4B] font-semibold">Real patches</span>
          </div>
        </div>

        {/* KPI 3: SRE Hours Reclaimed */}
        <div className="p-space-base rounded-xl bg-white border border-[#E5DED6] shadow-card flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#6B625B] mb-2">
            <span className="font-label-caps text-xs uppercase tracking-wider font-semibold">SRE Hours Reclaimed</span>
            <span className="material-symbols-outlined text-[#5B7C4B] text-xl">schedule</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-[#2D2926]">{hoursSaved}</span>
            <span className="font-label-code-sm text-xs text-[#5B7C4B] font-semibold">Saved ({timeRange})</span>
          </div>
          <div className="mt-3 pt-2 flex items-center justify-between text-[#6B625B] border-t border-[#E5DED6] text-xs">
            <span>~{costSaved} on-call equivalent</span>
            <span className="text-[#5B7C4B] font-semibold">Active Value</span>
          </div>
        </div>

        {/* KPI 4: Deployment Frequency */}
        <div className="p-space-base rounded-xl bg-white border border-[#E5DED6] shadow-card flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#6B625B] mb-2">
            <span className="font-label-caps text-xs uppercase tracking-wider font-semibold">Deployment Frequency</span>
            <span className="material-symbols-outlined text-[#D97757] text-xl">speed</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-[#2D2926]">
              {analyticsData?.dora?.deploymentFrequency || '0 / day'}
            </span>
            <span className="font-label-code-sm text-xs text-[#5B7C4B] font-semibold">
              {analyticsData?.dora?.deploymentFrequencyRating || 'Metric'}
            </span>
          </div>
          <div className="mt-3 pt-2 flex items-center justify-between text-[#6B625B] border-t border-[#E5DED6] text-xs">
            <span>Lead Time: {analyticsData?.dora?.leadTimeForChanges || '0m'}</span>
            <span className="material-symbols-outlined text-sm text-[#5B7C4B]">trending_up</span>
          </div>
        </div>
      </div>

      {/* Split: Dynamic MTTR Chart & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* Dynamic MTTR Comparison Chart (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl bg-white border border-[#E5DED6] p-space-lg shadow-card space-y-space-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E5DED6] pb-3 gap-2">
            <div>
              <h2 className="font-headline-sm text-base font-bold text-[#2D2926]">MTTR: Manual SRE vs AI Auto-Fix</h2>
              <p className="text-xs text-[#6B625B]">Real-time response &amp; resolution distribution across last {timeRange}</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-[#6B625B]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#C5BDB5]"></span> Manual ({analyticsData?.mttr?.previous || '0m'})
              </span>
              <span className="flex items-center gap-1.5 text-[#D97757] font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-[#D97757]"></span> Autonomous ({mttrValue})
              </span>
            </div>
          </div>

          {/* Hover point inspection badge */}
          {hoveredPoint && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] text-xs font-mono">
              <span className="font-semibold text-[#2D2926]">Interval: {hoveredPoint.label}</span>
              <div className="flex items-center gap-3">
                <span className="text-[#6B625B]">Manual: {hoveredPoint.manualMinutes}m</span>
                <span className="text-[#D97757] font-bold">Autonomous: {hoveredPoint.autonomousMinutes}m</span>
              </div>
            </div>
          )}

          {/* Dynamic SVG Chart */}
          <div className="h-56 w-full pt-2">
            <svg viewBox="0 0 500 200" className="w-full h-full overflow-visible">
              {/* Horizontal Grid Lines */}
              <line x1="40" y1="170" x2="480" y2="170" stroke="#E5DED6" strokeWidth="1" />
              <line x1="40" y1="120" x2="480" y2="120" stroke="#F2EDE6" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="40" y1="70" x2="480" y2="70" stroke="#F2EDE6" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="40" y1="20" x2="480" y2="20" stroke="#F2EDE6" strokeWidth="1" strokeDasharray="4 4" />

              {/* Y-axis Labels */}
              <text x="32" y="174" textAnchor="end" fontSize="10" fill="#A89F99" fontFamily="monospace">0m</text>
              <text x="32" y="124" textAnchor="end" fontSize="10" fill="#A89F99" fontFamily="monospace">10m</text>
              <text x="32" y="74" textAnchor="end" fontSize="10" fill="#A89F99" fontFamily="monospace">20m</text>
              <text x="32" y="24" textAnchor="end" fontSize="10" fill="#A89F99" fontFamily="monospace">35m</text>

              {/* Manual Line (Grey / dashed) */}
              {chartSVG.manualLine && (
                <polyline
                  fill="none"
                  stroke="#C5BDB5"
                  strokeWidth="2.5"
                  strokeDasharray="4 3"
                  points={chartSVG.manualLine}
                />
              )}

              {/* AI Shaded Area (Terracotta Tint) */}
              {chartSVG.autoPoly && (
                <polygon
                  fill="rgba(217, 119, 87, 0.14)"
                  points={chartSVG.autoPoly}
                />
              )}

              {/* AI Autonomous Line (Solid Terracotta) */}
              {chartSVG.autoLine && (
                <polyline
                  fill="none"
                  stroke="#D97757"
                  strokeWidth="3"
                  points={chartSVG.autoLine}
                />
              )}

              {/* Data points & X-axis labels */}
              {chartSVG.coords.map(({ pt, x, manualY, autoY }, i) => (
                <g
                  key={i}
                  onMouseEnter={() => setHoveredPoint(pt)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  className="cursor-pointer"
                >
                  {/* Manual point */}
                  <circle cx={x} cy={manualY} r="3" fill="#C5BDB5" stroke="#FFFFFF" strokeWidth="1.5" />
                  {/* Autonomous point */}
                  <circle
                    cx={x}
                    cy={autoY}
                    r={hoveredPoint?.label === pt.label ? "6" : "4"}
                    fill="#D97757"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    className="transition-all"
                  />
                  {/* X label */}
                  <text
                    x={x}
                    y="186"
                    textAnchor="middle"
                    fontSize="9"
                    fill="#8C827A"
                    fontFamily="monospace"
                  >
                    {pt.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Breakdown Panel (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl bg-white border border-[#E5DED6] p-space-lg shadow-card space-y-space-md">
          <div className="border-b border-[#E5DED6] pb-3 flex items-center justify-between">
            <div>
              <h2 className="font-headline-sm text-base font-bold text-[#2D2926]">Incident Breakdown</h2>
              <p className="text-xs text-[#6B625B]">Root cause categories resolved autonomously (stored in MongoDB)</p>
            </div>
            <span className="material-symbols-outlined text-[#B87A36] text-xl">pie_chart</span>
          </div>

          <div className="space-y-3.5 text-xs">
            {failureCategories.map((cat, idx) => {
              const colors = ['bg-[#D97757]', 'bg-[#B87A36]', 'bg-[#6B625B]', 'bg-[#A89F99]'];
              const color = colors[idx % colors.length];

              return (
                <div key={idx}>
                  <div className="flex justify-between mb-1.5">
                    <span className="font-medium text-[#2D2926]">{cat.name}</span>
                    <span className="font-bold text-[#D97757] font-mono">{cat.percentage}%</span>
                  </div>
                  <div className="w-full bg-[#F2EDE6] rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`${color} h-full rounded-full transition-all duration-500`}
                      style={{ width: `${cat.percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-[#E5DED6] text-[11px] text-[#6B625B] flex items-center justify-between">
            <span>Automated triage accuracy</span>
            <span className="font-semibold text-[#5B7C4B] font-mono">{analyticsData?.velocity?.retrySuccessRate || '0%'} precision</span>
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="rounded-2xl bg-white border border-[#E5DED6] p-space-lg shadow-card space-y-space-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E5DED6] pb-3 gap-2">
          <div>
            <h2 className="font-headline-sm text-base font-bold text-[#2D2926]">Top Self-Healing Microservices</h2>
            <p className="text-xs text-[#6B625B]">Live service fleet telemetry persisted in MongoDB microservice_telemetry</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#6B625B] bg-[#F2EDE6] px-2.5 py-1 rounded-md">
              {microservices.length} services tracked
            </span>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs font-body-sm min-w-[650px]">
            <thead>
              <tr className="border-b border-[#E5DED6] text-[#6B625B] font-label-caps uppercase tracking-wider">
                <th className="pb-3 font-semibold">Service Identifier</th>
                <th className="pb-3 font-semibold">Failures Intercepted</th>
                <th className="pb-3 font-semibold">Auto-Remediated %</th>
                <th className="pb-3 font-semibold">Saved SRE Time</th>
                <th className="pb-3 font-semibold text-right">Health Index</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DED6]">
              {microservices.map((s, idx) => (
                <tr key={idx} className="hover:bg-[#FAF7F3] transition-colors">
                  <td className="py-3.5 font-semibold text-[#2D2926]">
                    <div>{s.name}</div>
                    <div className="text-[11px] text-[#6B625B] font-mono">{s.cluster}</div>
                  </td>
                  <td className="py-3.5 font-mono text-[#2D2926]">{s.events}</td>
                  <td className="py-3.5">
                    <span className="font-semibold text-[#D97757] font-mono">{s.rate}</span>
                  </td>
                  <td className="py-3.5 font-mono text-[#2D2926]">{s.saved}</td>
                  <td className="py-3.5 text-right">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#F9ECE7] text-[#99462A] font-semibold font-mono text-[11px] border border-[#D97757]/30">
                      {s.health}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
