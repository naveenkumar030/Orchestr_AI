import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useBackend } from '../../context/BackendContext';
import { api } from '../../services/api';

export default function Header() {
  const { isConnected, latency, backendVersion, recheck } = useBackend();
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
        {/* Flask Backend Status Badge */}
        <button
          onClick={() => recheck()}
          title={
            isConnected
              ? `Connected to Flask API v${backendVersion || '3.1.1'} on :5000 (Latency: ${latency}ms). Click to test ping.`
              : 'Flask Backend is offline. Operating with local cached data. Click to reconnect.'
          }
          className={`flex items-center gap-space-xs px-space-md py-space-xs rounded-full border shadow-sm transition-all cursor-pointer ${
            isConnected
              ? 'bg-[#F9ECE7] border-[#D97757]/40 text-[#99462A] hover:bg-[#F4DFD7]'
              : 'bg-[#FAF7F3] border-[#E5DED6] text-[#6B625B] hover:bg-[#F2EDE6]'
          }`}
        >
          <span className="relative flex h-2 w-2">
            {isConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D97757] opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isConnected ? 'bg-[#D97757]' : 'bg-[#A89F99]'
              }`}
            />
          </span>
          <span className="font-label-code-sm text-label-code-sm font-semibold whitespace-nowrap">
            {isConnected
              ? `Flask API :5000 (${latency !== null ? `${latency}ms` : 'online'})`
              : 'Offline (Local Cache)'}
          </span>
        </button>

        {/* Chaos Anomaly Simulator Button */}
        <button
          onClick={handleTriggerChaos}
          disabled={isChaosRunning}
          title="Chaos Simulation: Injects a live Redis starvation incident into order-orchestrator and tests autonomous agent remediation"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FDF0F0] border border-[#C34A4A]/30 text-[#C34A4A] hover:bg-[#C34A4A] hover:text-white transition-all cursor-pointer text-xs font-semibold shadow-xs disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-sm ${isChaosRunning ? 'animate-spin' : ''}`}>
            bolt
          </span>
          <span className="hidden md:inline">
            {isChaosRunning ? 'Injecting Anomaly...' : 'Chaos Anomaly'}
          </span>
        </button>

        {chaosToast && (
          <div className="fixed top-20 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#2D2926] text-white text-xs shadow-xl border border-[#C34A4A]/60 animate-in fade-in slide-in-from-top-2">
            <span className="material-symbols-outlined text-[#C34A4A] text-base animate-pulse">warning</span>
            <span>{chaosToast}</span>
          </div>
        )}

        {/* Repo selector */}
        <div className="hidden xl:flex items-center gap-space-2xs px-space-md py-space-xs rounded-lg bg-white border border-[#E5DED6] text-[#6B625B] hover:text-[#2D2926] hover:bg-[#F2EDE6] transition-colors cursor-pointer shadow-sm">
          <span className="material-symbols-outlined text-base text-[#D97757]">source</span>
          <span className="font-label-code-md text-label-code-md text-[#2D2926] font-medium">github.com/enterprise-core</span>
          <span className="font-label-code-sm text-label-code-sm text-[#6B625B]">(12 repos)</span>
          <span className="material-symbols-outlined text-sm text-[#6B625B] ml-space-2xs">expand_more</span>
        </div>

        {/* Agent mode badge */}
        <div className="hidden lg:flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-[#F9ECE7] border border-[#D97757]/30 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-[#D97757]" />
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
