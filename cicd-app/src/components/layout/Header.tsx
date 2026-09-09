import { NavLink } from 'react-router-dom';

export default function Header() {
  return (
    <header className="fixed top-0 left-72 right-0 h-16 bg-white/95 backdrop-blur-2xl border-b border-[#E5DED6] shadow-header z-40 flex items-center justify-between px-space-lg gap-space-base">
      {/* Search */}
      <div className="flex items-center gap-space-base flex-1 max-w-xl">
        <div className="relative w-full flex items-center">
          <span className="material-symbols-outlined absolute left-space-md text-[#6B625B] text-lg pointer-events-none">
            search
          </span>
          <input
            type="text"
            placeholder="Search repositories, traces, PRs, or agent logs..."
            className="w-full h-10 pl-10 pr-12 rounded-lg bg-[#F7F4EF] border border-[#E5DED6] text-[#2D2926] placeholder:text-[#6B625B] font-body-sm text-body-sm focus:outline-none focus:border-[#D97757] focus:bg-white transition-all shadow-inner"
          />
          <kbd className="absolute right-space-md px-space-xs py-space-2xs bg-white border border-[#E5DED6] rounded font-label-code-sm text-label-code-sm text-[#6B625B] pointer-events-none shadow-sm">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-space-md">
        {/* Repo selector */}
        <div className="hidden xl:flex items-center gap-space-2xs px-space-md py-space-xs rounded-lg bg-white border border-[#E5DED6] text-[#6B625B] hover:text-[#2D2926] hover:bg-[#F2EDE6] transition-colors cursor-pointer shadow-sm">
          <span className="material-symbols-outlined text-base text-[#D97757]">source</span>
          <span className="font-label-code-md text-label-code-md text-[#2D2926] font-medium">github.com/enterprise-core</span>
          <span className="font-label-code-sm text-label-code-sm text-[#6B625B]">(12 repos)</span>
          <span className="material-symbols-outlined text-sm text-[#6B625B] ml-space-2xs">expand_more</span>
        </div>

        {/* Cluster selector */}
        <div className="hidden md:flex items-center gap-space-xs px-space-md py-space-xs rounded-lg bg-white border border-[#E5DED6] text-[#6B625B] hover:text-[#2D2926] hover:bg-[#F2EDE6] transition-colors cursor-pointer shadow-sm">
          <span className="h-2 w-2 rounded-full bg-[#D97757] shadow-[0_0_6px_rgba(217,119,87,0.4)]" />
          <span className="font-label-code-md text-label-code-md text-[#2D2926] font-medium">Prod-Cluster-Alpha</span>
          <span className="material-symbols-outlined text-sm text-[#6B625B]">expand_more</span>
        </div>

        {/* Agent mode badge */}
        <div className="flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-[#F9ECE7] border border-[#D97757]/30 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-[#D97757] animate-ping" />
          <span className="font-label-code-sm text-label-code-sm text-[#99462A] font-semibold whitespace-nowrap">
            Agent: Autonomous Mode
          </span>
        </div>

        {/* Notifications */}
        <div className="relative flex items-center justify-center w-10 h-10 rounded-lg text-[#6B625B] hover:bg-[#F2EDE6] hover:text-[#2D2926] transition-colors cursor-pointer border border-[#E5DED6] shadow-sm">
          <span className="material-symbols-outlined text-xl">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#C34A4A]" />
        </div>

        {/* Profile */}
        <NavLink
          to="/profile"
          className="flex items-center justify-center w-10 h-10 rounded-lg text-[#6B625B] hover:bg-[#F2EDE6] hover:text-[#2D2926] transition-colors cursor-pointer border border-[#E5DED6] shadow-sm"
          title="Operator Profile"
        >
          <span className="material-symbols-outlined text-xl">account_circle</span>
        </NavLink>
      </div>
    </header>
  );
}
