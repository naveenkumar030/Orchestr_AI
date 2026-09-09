import { NavLink, useLocation } from 'react-router-dom';
import { navItems } from '../../data/mockData';
import type { NavItem } from '../../types';

function NavBadge({ badge }: { badge: NavItem['badge'] }) {
  if (!badge) return null;
  if (badge.variant === 'pulse') {
    return (
      <span className="relative flex h-2 w-2 mr-1">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D97757] opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D97757]" />
      </span>
    );
  }
  if (badge.variant === 'error') {
    return (
      <span className="font-label-code-sm text-label-code-sm px-space-xs py-space-2xs rounded-full bg-[#FDF0F0] text-[#C34A4A] border border-[#C34A4A]/30 text-[11px]">
        {badge.text}
      </span>
    );
  }
  return (
    <span className="font-label-code-sm text-label-code-sm px-space-xs py-space-2xs rounded-full bg-[#F2EDE6] text-[#6B625B] border border-[#E5DED6] text-[11px]">
      {badge.text}
    </span>
  );
}

export default function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="fixed left-0 top-0 h-full w-72 bg-white backdrop-blur-2xl z-50 flex flex-col justify-between border-r border-[#E5DED6] shadow-sidebar">
      <div className="flex flex-col">
        {/* Logo */}
        <div className="px-space-base py-space-lg flex flex-col gap-space-xs">
          <NavLink to="/" className="cursor-pointer hover:opacity-85 transition-opacity block">
            <div className="flex items-center gap-space-sm">
              <div className="w-8 h-8 rounded-lg bg-[#D97757]/10 border border-[#D97757]/25 flex items-center justify-center text-[#D97757] shadow-sm">
                <span className="material-symbols-outlined text-xl">auto_mode</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm tracking-tight text-[#2D2926] leading-tight font-semibold">
                  Autonomous DevOps
                </span>
                <span className="font-label-caps text-label-caps text-[#6B625B] uppercase tracking-wider">
                  Enterprise Platform
                </span>
              </div>
            </div>
          </NavLink>

          {/* AI Kernel pill */}
          <div className="mt-space-xs inline-flex items-center gap-space-xs px-space-sm py-space-2xs rounded-full bg-[#F9ECE7] border border-[#D97757]/30 w-fit">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D97757] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D97757]" />
            </span>
            <span className="font-label-code-sm text-label-code-sm text-[#99462A] font-semibold">
              AI KERNEL v2.4 ACTIVE
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-space-2xs px-space-sm mt-space-sm">
          {navItems.map((item) => {
            const isActive =
              item.path === '/'
                ? pathname === '/'
                : pathname.startsWith(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={[
                  'group flex items-center justify-between px-space-base py-space-sm rounded-lg border transition-all',
                  isActive
                    ? 'bg-[#D97757]/12 text-[#99462A] border-[#D97757]/25 shadow-sm font-semibold'
                    : 'text-[#6B625B] hover:bg-[#F2EDE6] hover:text-[#2D2926] border-transparent hover:border-[#E5DED6]',
                ].join(' ')}
              >
                <div className="flex items-center gap-space-md">
                  <span className={`material-symbols-outlined text-xl ${isActive ? 'text-[#D97757]' : 'text-[#6B625B] group-hover:text-[#2D2926]'}`}>
                    {item.icon}
                  </span>
                  <span className={`font-headline-sm text-headline-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>
                    {item.label}
                  </span>
                </div>
                {item.badge && <NavBadge badge={item.badge} />}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* System Telemetry card */}
      <div className="p-space-base m-space-base rounded-xl bg-[#FBF9F5] border border-[#E5DED6] shadow-sm">
        <div className="flex items-center justify-between mb-space-xs">
          <span className="font-label-caps text-label-caps text-[#6B625B] uppercase">System Telemetry</span>
          <div className="flex items-center gap-space-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D97757] animate-pulse" />
            <span className="font-label-code-sm text-label-code-sm text-[#99462A] font-medium">12ms</span>
          </div>
        </div>
        <p className="font-body-sm text-body-sm text-[#2D2926] leading-tight font-medium">
          All Autonomous Workers Nominal
        </p>
        <div className="flex items-center justify-between mt-space-sm pt-space-xs text-[#6B625B] border-t border-[#E5DED6]">
          <span className="font-label-code-sm text-label-code-sm text-[#6B625B]">Cluster US-East-1</span>
          <span className="material-symbols-outlined text-sm text-[#D97757]">speed</span>
        </div>
      </div>
    </aside>
  );
}
