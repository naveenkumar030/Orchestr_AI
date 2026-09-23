import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useBackend } from '../../context/useBackend';
import { api } from '../../services/api';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const { isConnected, latency, backendVersion, mongoConnected, mongoLatency, mongoDb, recheck } = useBackend();
  const [isChaosRunning, setIsChaosRunning] = useState(false);
  const [chaosToast, setChaosToast] = useState<string | null>(null);

  const handleTriggerChaos = async () => {
    setIsChaosRunning(true);
    try {
      const inc = await api.simulateAnomaly();
      setChaosToast(`⚡ Chaos Anomaly Injected: ${inc.id} (${inc.repo})! AI triage agent dispatched.`);
      setTimeout(() => setChaosToast(null), 5000);
    } catch (err) {
      console.error('Failed to trigger chaos:', err);
    } finally {
      setIsChaosRunning(false);
    }
  };

  return (
    <header className="fixed top-0 left-0 lg:left-72 right-0 h-16 bg-white/95 backdrop-blur-2xl border-b border-[#E5DED6] shadow-header z-30 flex items-center justify-between px-3 sm:px-6 gap-2 sm:gap-4 transition-[left] duration-300 ease-in-out">
      {/* Left side: Hamburger + Search */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 max-w-xl">
        {/* Mobile Hamburger Menu Button */}
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg text-[#6B625B] hover:bg-[#F2EDE6] hover:text-[#2D2926] transition-colors shrink-0"
          aria-label="Toggle navigation menu"
        >
          <span className="material-symbols-outlined text-2xl">menu</span>
        </button>

        {/* Search */}
        <div className="relative w-full flex items-center min-w-0">
          <span className="material-symbols-outlined absolute left-3 text-[#6B625B] text-lg pointer-events-none">
            search
          </span>
          <input
            type="text"
            placeholder="Search repos, traces, PRs..."
            className="w-full h-9 sm:h-10 pl-9 sm:pl-10 pr-3 sm:pr-12 rounded-lg bg-[#F7F4EF] border border-[#E5DED6] text-[#2D2926] placeholder:text-[#6B625B] text-xs sm:text-sm focus:outline-none focus:border-[#D97757] focus:bg-white transition-all shadow-inner"
          />
          <kbd className="hidden sm:inline-block absolute right-3 px-1.5 py-0.5 bg-white border border-[#E5DED6] rounded font-label-code-sm text-[10px] text-[#6B625B] pointer-events-none shadow-sm">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* MongoDB Atlas Status Badge */}
        <button
          onClick={() => recheck()}
          title={
            mongoConnected
              ? `Connected to MongoDB Atlas database '${mongoDb || 'sentinelops'}' (Latency: ${mongoLatency !== null ? `${mongoLatency}ms` : '<50ms'}). Click to recheck.`
              : 'MongoDB Atlas is offline. Operating with SQLite fallback.'
          }
          className={`hidden md:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full border shadow-sm transition-all cursor-pointer ${
            mongoConnected
              ? 'bg-[#EBF3E8] border-[#5B7C4B]/40 text-[#3F5A31] hover:bg-[#DFEDD9]'
              : 'bg-[#FAF7F3] border-[#E5DED6] text-[#6B625B] hover:bg-[#F2EDE6]'
          }`}
        >
          <span className="relative flex h-2 w-2 shrink-0">
            {mongoConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5B7C4B] opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                mongoConnected ? 'bg-[#5B7C4B]' : 'bg-[#A89F99]'
              }`}
            />
          </span>
          <span className="font-label-code-sm text-[11px] sm:text-xs font-semibold whitespace-nowrap flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px] leading-none text-[#5B7C4B]">database</span>
            <span>
              {mongoConnected
                ? `MongoDB Atlas (${mongoLatency !== null ? `${mongoLatency}ms` : 'cloud'})`
                : 'SQLite Fallback'}
            </span>
          </span>
        </button>

        {/* Flask Backend Status Badge */}
        <button
          onClick={() => recheck()}
          title={
            isConnected
              ? `Connected to Flask API v${backendVersion || '3.1.1'} on :5000 (Latency: ${latency}ms). Click to test ping.`
              : 'Flask Backend is offline. Operating with local cached data. Click to reconnect.'
          }
          className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full border shadow-sm transition-all cursor-pointer ${
            isConnected
              ? 'bg-[#F9ECE7] border-[#D97757]/40 text-[#99462A] hover:bg-[#F4DFD7]'
              : 'bg-[#FAF7F3] border-[#E5DED6] text-[#6B625B] hover:bg-[#F2EDE6]'
          }`}
        >
          <span className="relative flex h-2 w-2 shrink-0">
            {isConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D97757] opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isConnected ? 'bg-[#D97757]' : 'bg-[#A89F99]'
              }`}
            />
          </span>
          <span className="font-label-code-sm text-[11px] sm:text-xs font-semibold whitespace-nowrap">
            <span className="hidden sm:inline">
              {isConnected
                ? `Flask API :5000 (${latency !== null ? `${latency}ms` : 'online'})`
                : 'Offline (Local Cache)'}
            </span>
            <span className="inline sm:hidden">
              {isConnected ? `${latency !== null ? `${latency}ms` : ':5000'}` : 'Offline'}
            </span>
          </span>
        </button>

        {/* Chaos Anomaly Simulator Button */}
        <button
          onClick={handleTriggerChaos}
          disabled={isChaosRunning}
          title="Chaos Simulation: Injects a live Redis starvation incident into order-orchestrator and tests autonomous agent remediation"
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-[#FDF0F0] border border-[#C34A4A]/30 text-[#C34A4A] hover:bg-[#C34A4A] hover:text-white transition-all cursor-pointer text-xs font-semibold shadow-xs disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-sm ${isChaosRunning ? 'animate-spin' : ''}`}>
            bolt
          </span>
          <span className="hidden md:inline">
            {isChaosRunning ? 'Injecting Anomaly...' : 'Chaos Anomaly'}
          </span>
        </button>

        {chaosToast && (
          <div className="fixed top-20 right-4 sm:right-6 z-50 flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-[#2D2926] text-white text-xs shadow-xl border border-[#C34A4A]/60 animate-in fade-in slide-in-from-top-2 max-w-[calc(100vw-2rem)]">
            <span className="material-symbols-outlined text-[#C34A4A] text-base animate-pulse shrink-0">warning</span>
            <span className="truncate">{chaosToast}</span>
          </div>
        )}


        {/* Agent mode badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F9ECE7] border border-[#D97757]/30 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-[#D97757]" />
          <span className="font-label-code-sm text-[11px] text-[#99462A] font-semibold whitespace-nowrap">
            Agent: Autonomous Mode
          </span>
        </div>

        {/* Notifications */}
        <div className="relative flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg text-[#6B625B] hover:bg-[#F2EDE6] hover:text-[#2D2926] transition-colors cursor-pointer border border-[#E5DED6] shadow-sm shrink-0">
          <span className="material-symbols-outlined text-lg sm:text-xl">notifications</span>
          <span className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 w-2 h-2 rounded-full bg-[#C34A4A]" />
        </div>

        {/* Profile */}
        <NavLink
          to="/profile"
          className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg text-[#6B625B] hover:bg-[#F2EDE6] hover:text-[#2D2926] transition-colors cursor-pointer border border-[#E5DED6] shadow-sm shrink-0"
          title="Operator Profile"
        >
          <span className="material-symbols-outlined text-lg sm:text-xl">account_circle</span>
        </NavLink>
      </div>
    </header>
  );
}
