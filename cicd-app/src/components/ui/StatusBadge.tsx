import type { IncidentStatus } from '../../types';

const statusConfig: Record<IncidentStatus, { bg: string; dot: string; text: string; label: string }> = {
  Fixed:           { bg: 'bg-[#F9ECE7] border-[#D97757]/30',  dot: 'bg-[#D97757]',  text: 'text-[#99462A]',  label: 'Fixed' },
  Failed:          { bg: 'bg-[#FDF0F0] border-[#C34A4A]/40',  dot: 'bg-[#C34A4A]',  text: 'text-[#C34A4A]',  label: 'Failed' },
  Investigating:   { bg: 'bg-[#F6EFE6] border-[#B87A36]/40',  dot: 'bg-[#B87A36] animate-ping', text: 'text-[#B87A36]', label: 'Investigating' },
  'PR Created':    { bg: 'bg-[#EDE0D7] border-[#D97757]/30',  dot: 'bg-[#D97757]',  text: 'text-[#4D453F]',  label: 'PR Created' },
  'Needs Approval':{ bg: 'bg-[#F9ECE7] border-[#D97757]/30',  dot: 'bg-[#D97757]',  text: 'text-[#99462A]',  label: 'Needs Approval' },
  Resolved:        { bg: 'bg-[#EDF4EA] border-[#5B7C4B]/30',  dot: 'bg-[#5B7C4B]',  text: 'text-[#5B7C4B]',  label: 'Resolved' },
  Remediated:      { bg: 'bg-[#EAF3E7] border-[#5B7C4B]/40',  dot: 'bg-[#5B7C4B] animate-pulse', text: 'text-[#5B7C4B]',  label: 'Remediated' },
};

interface StatusBadgeProps {
  status: IncidentStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-space-2xs px-space-sm py-0.5 rounded-full border font-label-code-sm text-label-code-sm font-semibold shadow-sm ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
