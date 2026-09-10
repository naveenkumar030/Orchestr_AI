import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { AnalyticsResponse, MicroserviceTelemetry } from '../types';

const defaultMicroservices: MicroserviceTelemetry[] = [
  { name: 'auth-gateway-edge', cluster: 'k8s/prod-us-east-1', events: '86 events', rate: '97.6%', saved: '114.2 hrs', health: '99.8 / 100' },
  { name: 'payment-service', cluster: 'k8s/prod-us-east-1', events: '64 events', rate: '95.3%', saved: '82.6 hrs', health: '99.2 / 100' },
  { name: 'order-orchestrator', cluster: 'k8s/prod-eu-west-1', events: '48 events', rate: '91.7%', saved: '64.1 hrs', health: '98.5 / 100' },
  { name: 'inventory-api', cluster: 'k8s/prod-us-central', events: '32 events', rate: '93.8%', saved: '42.0 hrs', health: '99.0 / 100' },
  { name: 'billing-engine', cluster: 'k8s/prod-us-east-1', events: '18 events', rate: '100%', saved: '24.5 hrs', health: '100 / 100' },
];

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    api.getAnalytics(timeRange)
      .then((data) => {
        if (!mounted) return;
        setAnalyticsData(data);
      })
      .catch((err) => {
        console.warn('Failed to load analytics from Flask backend:', err);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [timeRange]);

  const microservices = analyticsData?.microservices?.length
    ? analyticsData.microservices
    : defaultMicroservices;

  const mttrValue = analyticsData?.mttr?.current || '1.8m';
  const mttrReduction = analyticsData?.mttr?.reductionPercent || '94.7%';
  const autoFixRate = analyticsData?.velocity?.autoFixRate || '92.4%';
  const hoursSaved = analyticsData?.velocity?.hoursSaved || '327.4 hrs';
  const costSaved = analyticsData?.velocity?.costSaved || '$42,560';

  const failureCategories = analyticsData?.failureCategories || [
    { name: 'Dependency Mismatch', percentage: 42 },
    { name: 'Env & Secret Missing', percentage: 28 },
    { name: 'Timeout & Leases', percentage: 16 },
    { name: 'Config & Helm Syntax', percentage: 14 },
  ];

  return (
    <div className="space-y-space-lg">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
        <div>
          <div className="flex items-center gap-space-xs text-[#6B625B] font-label-code-sm text-xs">
            <span>Control Center</span>
            <span>/</span>
            <span className="text-[#99462A] font-semibold">Autonomous Velocity</span>
          </div>
          <h1 className="font-headline-lg text-2xl font-bold text-[#2D2926] tracking-tight mt-1">
            MTTR &amp; Autonomous Velocity Analytics
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[#F2EDE6] p-1 rounded-lg border border-[#E5DED6]">
            {(['7d', '30d', '90d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
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

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E5DED6] text-xs font-mono text-[#6B625B]">
            <span className="h-2 w-2 rounded-full bg-[#5B7C4B] animate-pulse"></span>
            <span>{isLoading ? 'Fetching /api/analytics...' : 'Flask API: Live'}</span>
          </div>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-base">
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
            <span>Down from 34m human response</span>
            <span className="text-[#5B7C4B] font-semibold">Real-time</span>
          </div>
        </div>

        <div className="p-space-base rounded-xl bg-white border border-[#E5DED6] shadow-card flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#6B625B] mb-2">
            <span className="font-label-caps text-xs uppercase tracking-wider font-semibold">Autonomous Healing Rate</span>
            <span className="material-symbols-outlined text-[#D97757] text-xl">auto_fix_high</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-[#2D2926]">{autoFixRate}</span>
            <span className="font-label-code-sm text-xs text-[#99462A] font-semibold">+6.2% QoQ</span>
          </div>
          <div className="mt-3 pt-2 flex items-center justify-between text-[#6B625B] border-t border-[#E5DED6] text-xs">
            <span>{analyticsData?.velocity?.patchesSynthesized || 132} CI failures repaired</span>
            <span className="text-[#5B7C4B] font-semibold">0 Escapes</span>
          </div>
        </div>

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
            <span className="text-[#5B7C4B] font-semibold">99.6% ROI</span>
          </div>
        </div>

        <div className="p-space-base rounded-xl bg-white border border-[#E5DED6] shadow-card flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#6B625B] mb-2">
            <span className="font-label-caps text-xs uppercase tracking-wider font-semibold">Deployment Frequency</span>
            <span className="material-symbols-outlined text-[#D97757] text-xl">speed</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-[#2D2926]">
              {analyticsData?.dora?.deploymentFrequency || '18.4 / day'}
            </span>
            <span className="font-label-code-sm text-xs text-[#5B7C4B] font-semibold">
              {analyticsData?.dora?.deploymentFrequencyRating || 'Elite'}
            </span>
          </div>
          <div className="mt-3 pt-2 flex items-center justify-between text-[#6B625B] border-t border-[#E5DED6] text-xs">
            <span>Lead Time: {analyticsData?.dora?.leadTimeForChanges || '14.2m'}</span>
            <span className="material-symbols-outlined text-sm text-[#5B7C4B]">trending_up</span>
          </div>
        </div>
      </div>

      {/* Split: MTTR Chart & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* MTTR Comparison Chart (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl bg-white border border-[#E5DED6] p-space-lg shadow-card space-y-space-md">
          <div className="flex items-center justify-between border-b border-[#E5DED6] pb-3">
            <div>
              <h2 className="font-headline-sm text-base font-bold text-[#2D2926]">MTTR: Manual SRE vs AI Auto-Fix</h2>
              <p className="text-xs text-[#6B625B]">Response and resolution time distribution across last {timeRange}</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-[#6B625B]">
                <span className="h-2 w-2 rounded-full bg-[#E5DED6]"></span> Manual (34m)
              </span>
              <span className="flex items-center gap-1 text-[#D97757] font-semibold">
                <span className="h-2 w-2 rounded-full bg-[#D97757]"></span> Autonomous ({mttrValue})
              </span>
            </div>
          </div>

          {/* SVG Chart */}
          <div className="h-56 w-full pt-2">
            <svg viewBox="0 0 500 200" className="w-full h-full overflow-visible">
              <line x1="40" y1="170" x2="480" y2="170" stroke="#E5DED6" strokeWidth="1" />
              <line x1="40" y1="120" x2="480" y2="120" stroke="#F2EDE6" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="40" y1="70" x2="480" y2="70" stroke="#F2EDE6" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="40" y1="20" x2="480" y2="20" stroke="#F2EDE6" strokeWidth="1" strokeDasharray="4 4" />

              <text x="30" y="174" textAnchor="end" fontSize="10" fill="#A89F99">0m</text>
              <text x="30" y="124" textAnchor="end" fontSize="10" fill="#A89F99">10m</text>
              <text x="30" y="74" textAnchor="end" fontSize="10" fill="#A89F99">20m</text>
              <text x="30" y="24" textAnchor="end" fontSize="10" fill="#A89F99">35m</text>

              {/* Manual Line (Grey) */}
              <polyline
                fill="none"
                stroke="#C5BDB5"
                strokeWidth="2.5"
                strokeDasharray="4 3"
                points="50,30 110,40 170,35 230,45 290,38 350,42 410,35 470,30"
              />

              {/* AI Line (Terracotta) */}
              <polygon
                fill="rgba(217, 119, 87, 0.12)"
                points="50,158 110,160 170,157 230,159 290,156 350,158 410,157 470,156 470,170 50,170"
              />
              <polyline
                fill="none"
                stroke="#D97757"
                strokeWidth="3"
                points="50,158 110,160 170,157 230,159 290,156 350,158 410,157 470,156"
              />

              {/* Data points */}
              {[
                [50, 158], [110, 160], [170, 157], [230, 159], [290, 156], [350, 158], [410, 157], [470, 156]
              ].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="4" fill="#D97757" stroke="#FFFFFF" strokeWidth="2" />
              ))}
            </svg>
          </div>
        </div>

        {/* Breakdown Panel (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl bg-white border border-[#E5DED6] p-space-lg shadow-card space-y-space-md">
          <div className="border-b border-[#E5DED6] pb-3">
            <h2 className="font-headline-sm text-base font-bold text-[#2D2926]">Incident Breakdown</h2>
            <p className="text-xs text-[#6B625B]">Root cause categories resolved autonomously (from Python backend)</p>
          </div>

          <div className="space-y-3 text-xs">
            {failureCategories.map((cat, idx) => {
              const colors = ['bg-[#D97757]', 'bg-[#B87A36]', 'bg-[#6B625B]', 'bg-[#A89F99]'];
              const color = colors[idx % colors.length];

              return (
                <div key={idx}>
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-[#2D2926]">{cat.name}</span>
                    <span className="font-semibold text-[#D97757]">{cat.percentage}%</span>
                  </div>
                  <div className="w-full bg-[#F2EDE6] rounded-full h-2 overflow-hidden">
                    <div className={`${color} h-full rounded-full`} style={{ width: `${cat.percentage}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="rounded-2xl bg-white border border-[#E5DED6] p-space-lg shadow-card space-y-space-md">
        <div className="flex items-center justify-between border-b border-[#E5DED6] pb-3">
          <div>
            <h2 className="font-headline-sm text-base font-bold text-[#2D2926]">Top Self-Healing Microservices</h2>
            <p className="text-xs text-[#6B625B]">High-cadence services monitored and healed via Python data store</p>
          </div>
          <span className="text-xs font-mono text-[#6B625B]">
            {microservices.length} services reported
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-body-sm">
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
