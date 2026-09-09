import type { KpiMetric } from '../../types';

interface KpiCardProps {
  metric: KpiMetric;
}

export default function KpiCard({ metric }: KpiCardProps) {
  const trendIcon = metric.trendDirection === 'up' ? 'trending_up' : 'trending_down';
  const trendBg   = metric.trendPositive && metric.trendDirection === 'up'
    ? 'bg-[#F9ECE7] text-[#99462A] border-[#D97757]/30'
    : metric.trendPositive && metric.trendDirection === 'down'
    ? 'bg-[#F9ECE7] text-[#99462A] border-[#D97757]/30'
    : 'bg-[#FDF0F0] text-[#C34A4A] border-[#C34A4A]/30';

  return (
    <div className={`relative overflow-hidden rounded-xl bg-white border border-[#E5DED6] p-space-base shadow-card transition-transform hover:-translate-y-1 ${metric.hoverBorder} hover:shadow-md`}>
      {/* Glow blob */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl pointer-events-none opacity-50"
           style={{ backgroundColor: metric.progressColor.replace('bg-[', '').replace(']', '') + '22' }} />

      <div className="flex items-start justify-between">
        <span className="font-label-caps text-label-caps uppercase text-[#6B625B] tracking-wider font-semibold">
          {metric.label}
        </span>
        <div className={`p-space-xs rounded-lg ${metric.iconBg} ${metric.iconColor} border border-current/30 shadow-sm`}>
          <span className="material-symbols-outlined text-xl">{metric.icon}</span>
        </div>
      </div>

      <div className="mt-space-md flex items-baseline gap-space-sm">
        <span className="font-headline-xl text-headline-xl text-[#2D2926] font-bold tracking-tight">
          {metric.value}
        </span>
        <span className={`inline-flex items-center gap-space-2xs px-space-xs py-space-2xs rounded-full border font-label-code-sm text-label-code-sm font-semibold ${trendBg}`}>
          <span className="material-symbols-outlined text-xs">{trendIcon}</span>
          {metric.trend}
        </span>
      </div>

      <div className="mt-space-sm pt-space-xs flex items-center justify-between text-[#6B625B] border-t border-[#E5DED6]">
        <span className="font-body-sm text-body-sm">{metric.sub}</span>
        <span className="font-label-code-sm text-label-code-sm text-[#99462A] font-medium">{metric.subRight}</span>
      </div>

      <div className="mt-space-xs w-full bg-[#F2EDE6] rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-1.5 rounded-full ${metric.progressColor}`}
          style={{ width: `${metric.progress}%` }}
        />
      </div>
    </div>
  );
}
