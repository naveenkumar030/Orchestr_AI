import React, { useState } from 'react';
import { useBackend } from '../../context/useBackend';

export const StatusBanner: React.FC = () => {
  const { isConnected, isMockMode, setMockMode, recheck } = useBackend();
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  // If in Demo Mode, show prominent Sandbox banner
  if (isMockMode) {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="w-full bg-gradient-to-r from-[#2A2438] via-[#352B4D] to-[#2A2438] border-b border-[#7C65C1]/40 text-[#E8E1F8] px-4 py-2.5 shadow-md flex items-center justify-between gap-4 transition-all duration-300"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#7C65C1]/20 border border-[#7C65C1]/50 text-[#C4B5FD] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-base">science</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-xs text-[#FAF8F5] uppercase tracking-wider font-label-code-sm px-2 py-0.5 rounded bg-[#7C65C1]/30 border border-[#7C65C1]/40">
                Demo Mode Active
              </span>
              <p className="text-xs text-[#DDD6FE] truncate font-body-sm">
                Operating in local sandbox mode. External operations are simulated and will not affect live repositories.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMockMode(false)}
            className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#7C65C1] hover:bg-[#8B5CF6] text-white shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">exit_to_app</span>
            <span>Exit Demo Mode</span>
          </button>
        </div>
      </div>
    );
  }

  // If disconnected in Live Production Mode and not dismissed
  if (!isConnected && !isDismissed) {
    const handleRetry = async () => {
      setIsRetrying(true);
      try {
        await recheck();
      } finally {
        setIsRetrying(false);
      }
    };

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="w-full bg-[#FFF5F2] border-b border-[#D97757]/30 text-[#2D2926] px-4 py-2.5 shadow-sm flex items-center justify-between gap-4 transition-all duration-300"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#F9ECE7] border border-[#D97757]/40 text-[#D97757] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-base">cloud_off</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-xs text-[#99462A] uppercase tracking-wider font-label-code-sm px-2 py-0.5 rounded bg-[#F9ECE7] border border-[#D97757]/40">
                Backend Disconnected
              </span>
              <p className="text-xs text-[#6B625B] truncate font-body-sm">
                Flask API (<code className="font-mono text-[#2D2926] bg-[#EFE8E1] px-1 py-0.5 rounded">:5000</code>) is offline. Live mutations are blocked. Showing cached telemetry.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMockMode(true)}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#F2EDE6] hover:bg-[#E5DED6] text-[#2D2926] border border-[#D5CDC5] transition-colors flex items-center gap-1.5"
            title="Switch to simulated local demo mode"
          >
            <span className="material-symbols-outlined text-sm text-[#7C65C1]">science</span>
            <span>Switch to Demo Mode</span>
          </button>

          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#D97757] hover:bg-[#C26243] text-white shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-sm ${isRetrying ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>{isRetrying ? 'Retrying...' : 'Retry Connection'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded-lg text-[#8F857D] hover:text-[#2D2926] hover:bg-[#EFE8E1] transition-colors"
            title="Dismiss notice"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default StatusBanner;
