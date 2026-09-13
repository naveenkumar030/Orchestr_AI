import type { IncidentStatus } from '../../types';

const statusConfig: Record<IncidentStatus, { bg: string; dot: string; text: string; label: string }> = {
  Fixed:           { bg: 'bg-[#F9ECE7] border-[#D97757]/30',  dot: 'bg-[#D97757]',  text: 'text-[#99462A]',  label: 'Fixed' },
  Failed:          { bg: 'bg-[#FDF0F0] border-[#C34A4A]/40',  dot: 'bg-[#C34A4A]',  text: 'text-[#C34A4A]',  label: 'Failed' },
  Investigating:   { bg: 'bg-[#F6EFE6] border-[#B87A36]/40',  dot: 'bg-[#B87A36] animate-ping', text: 'text-[#B87A36]', label: 'Investigating' },
  'PR Created':    { bg: 'bg-[#EDE0D7] border-[#D97757]/30',  dot: 'bg-[#D97757]',  text: 'text-[#4D453F]',  label: 'PR Created' },
  'Validating':    { bg: 'bg-[#EFF6FF] border-[#3B82F6]/40',  dot: 'bg-[#3B82F6] animate-spin', text: 'text-[#1D4ED8]', label: 'Validating CI' },
  'Validating CI': { bg: 'bg-[#EFF6FF] border-[#3B82F6]/40',  dot: 'bg-[#3B82F6] animate-spin', text: 'text-[#1D4ED8]', label: 'Validating CI' },
  'Needs Approval':{ bg: 'bg-[#F9ECE7] border-[#D97757]/30',  dot: 'bg-[#D97757]',  text: 'text-[#99462A]',  label: 'Needs Approval' },
  Deploying:       { bg: 'bg-[#F0FDF4] border-[#16A34A]/40',  dot: 'bg-[#16A34A] animate-pulse', text: 'text-[#15803D]', label: 'Deploying' },
  'Verifying Health': { bg: 'bg-[#EFF6FF] border-[#2563EB]/40', dot: 'bg-[#2563EB] animate-spin', text: 'text-[#1D4ED8]', label: 'Verifying Health' },
  'Rolling Back':  { bg: 'bg-[#FFFBEB] border-[#D97706]/40',  dot: 'bg-[#D97706] animate-pulse', text: 'text-[#B45309]', label: 'Rolling Back' },
  'Verifying Rollback': { bg: 'bg-[#FFFBEB] border-[#D97706]/40', dot: 'bg-[#D97706] animate-spin', text: 'text-[#B45309]', label: 'Verifying Rollback' },
  'Rolled Back':   { bg: 'bg-[#FDF4FF] border-[#A855F7]/40',  dot: 'bg-[#A855F7]', text: 'text-[#7E22CE]', label: 'Rolled Back' },
  Resolved:        { bg: 'bg-[#EDF4EA] border-[#5B7C4B]/30',  dot: 'bg-[#5B7C4B]',  text: 'text-[#5B7C4B]',  label: 'Resolved' },
  Remediated:      { bg: 'bg-[#EAF3E7] border-[#5B7C4B]/40',  dot: 'bg-[#5B7C4B] animate-pulse', text: 'text-[#5B7C4B]',  label: 'Remediated' },
  Blocked:         { bg: 'bg-[#FDF0F0] border-[#C34A4A]/40',  dot: 'bg-[#C34A4A]',  text: 'text-[#C34A4A]',  label: 'Blocked' },
  Escalated:       { bg: 'bg-[#FEF2F2] border-[#DC2626]/40',  dot: 'bg-[#DC2626] animate-ping', text: 'text-[#DC2626]', label: 'Escalated' },
};

interface StatusBadgeProps {
  status: IncidentStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = statusConfig[status] || { bg: 'bg-[#F3F4F6] border-[#D1D5DB]', dot: 'bg-[#6B7280]', text: 'text-[#374151]', label: status || 'Unknown' };
  return (
    <span className={`inline-flex items-center gap-space-2xs px-space-sm py-0.5 rounded-full border font-label-code-sm text-label-code-sm font-semibold shadow-sm ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
