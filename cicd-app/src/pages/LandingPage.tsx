import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<'control' | 'dag' | 'incident' | 'fleet'>('control');
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F7F4EF] text-[#2D2926] selection:bg-[#D97757]/20 font-body-lg antialiased overflow-x-hidden">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-[#D97757]/8 blur-[120px]" />
        <div className="absolute top-1/3 -right-32 w-[550px] h-[550px] rounded-full bg-[#B87A36]/8 blur-[140px]" />
        <div className="absolute -bottom-40 left-1/4 w-[700px] h-[700px] rounded-full bg-[#D97757]/6 blur-[150px]" />
      </div>

      {/* ─── Sticky Glassmorphism Header ─── */}
      <header className="sticky top-0 z-50 bg-[#F7F4EF]/90 backdrop-blur-xl border-b border-[#E5DED6] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          {/* Logo & Status */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#D97757] text-white flex items-center justify-center shadow-[0_4px_16px_rgba(217,119,87,0.35)] group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-xl sm:text-2xl">security</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-md text-lg sm:text-xl tracking-tight text-[#2D2926] font-bold">
                  SentinelOps
                </span>
                <span className="font-label-caps text-[9px] sm:text-[10px] text-[#6B625B] uppercase tracking-widest -mt-1">
                  Autonomous DevOps Platform
                </span>
              </div>
            </Link>

            <div className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F9ECE7] border border-[#D97757]/30">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D97757] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D97757]" />
              </span>
              <span className="font-label-code-sm text-[11px] text-[#99462A] font-semibold">
                Autonomous Engine v2.4 Active
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-[#6B625B]">
            <a href="#features" className="hover:text-[#D97757] transition-colors">Features</a>
            <a href="#fleet" className="hover:text-[#D97757] transition-colors">AI Fleet</a>
            <a href="#workflow" className="hover:text-[#D97757] transition-colors">Self-Healing</a>
            <a href="#metrics" className="hover:text-[#D97757] transition-colors">DORA Impact</a>
            <a href="#security" className="hover:text-[#D97757] transition-colors">Enterprise</a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="https://github.com/naveenkumar030/SentinelOps"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-white border border-[#E5DED6] text-xs font-semibold text-[#2D2926] hover:bg-[#F2EDE6] hover:border-[#D97757]/40 transition-all shadow-sm"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>GitHub</span>
            </a>

            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-[#D97757] hover:bg-[#C66849] text-white text-[11px] sm:text-xs font-bold uppercase tracking-wider shadow-[0_4px_16px_rgba(217,119,87,0.35)] hover:shadow-[0_6px_20px_rgba(217,119,87,0.45)] transition-all transform hover:-translate-y-0.5"
            >
              <span>Launch</span>
              <span className="material-symbols-outlined text-sm sm:text-base">arrow_forward</span>
            </Link>

            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-[#6B625B] hover:text-[#2D2926] hover:bg-[#F2EDE6] transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              <span className="material-symbols-outlined text-2xl">
                {isMobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden px-6 py-4 bg-[#F7F4EF] border-b border-[#E5DED6] flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 shadow-lg">
            <a
              href="#features"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-sm font-medium text-[#2D2926] hover:text-[#D97757] py-1.5 transition-colors"
            >
              Features &amp; Previews
            </a>
            <a
              href="#fleet"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-sm font-medium text-[#2D2926] hover:text-[#D97757] py-1.5 transition-colors"
            >
              AI Fleet Nodes
            </a>
            <a
              href="#workflow"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-sm font-medium text-[#2D2926] hover:text-[#D97757] py-1.5 transition-colors"
            >
              Self-Healing Loop
            </a>
            <a
              href="#metrics"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-sm font-medium text-[#2D2926] hover:text-[#D97757] py-1.5 transition-colors"
            >
              DORA Impact
            </a>
            <a
              href="#security"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-sm font-medium text-[#2D2926] hover:text-[#D97757] py-1.5 transition-colors"
            >
              Enterprise Security
            </a>
            <div className="pt-3 border-t border-[#E5DED6] flex items-center gap-3">
              <a
                href="https://github.com/naveenkumar030/SentinelOps"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center py-2 rounded-lg bg-white border border-[#E5DED6] text-xs font-semibold text-[#2D2926]"
              >
                GitHub Repo
              </a>
              <Link
                to="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex-1 text-center py-2 rounded-lg bg-[#D97757] text-white text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                Launch Console
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ─── Hero Section ─── */}
      <section className="relative z-10 pt-16 pb-24 md:pt-24 md:pb-32 px-6">
        <div className="max-w-5xl mx-auto text-center flex flex-col items-center">
          {/* Announcement pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 border border-[#E5DED6] shadow-sm mb-8 hover:border-[#D97757]/40 transition-all cursor-pointer">
            <span className="w-2 h-2 rounded-full bg-[#5B7C4B] animate-pulse" />
            <span className="text-xs font-semibold text-[#6B625B]">
              Autonomous Incident Healing & DAG Workflows
            </span>
            <span className="text-xs text-[#D97757] font-bold flex items-center">
              Explore Live Demo <span className="material-symbols-outlined text-sm ml-0.5">chevron_right</span>
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="font-headline-xl text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-[#2D2926] leading-[1.08] mb-6">
            Autonomous DevOps.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D97757] via-[#B87A36] to-[#99462A]">
              Self-Healing Pipelines.
            </span><br />
            Zero Human Latency.
          </h1>

          {/* Subtitle */}
          <p className="max-w-3xl text-lg sm:text-xl text-[#6B625B] leading-relaxed mb-10 font-normal">
            SentinelOps coordinates specialized autonomous AI agents across your cloud infrastructure to predict pipeline bottlenecks, resolve production anomalies in under 3 minutes, and enforce policy guardrails without on-call burnout.
          </p>

          {/* Call to Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mb-16">
            <Link
              to="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-[#D97757] hover:bg-[#C66849] text-white font-bold text-base shadow-[0_8px_24px_rgba(217,119,87,0.35)] hover:shadow-[0_12px_32px_rgba(217,119,87,0.45)] transition-all transform hover:-translate-y-0.5"
            >
              <span className="material-symbols-outlined text-xl">rocket_launch</span>
              <span>Open Control Center</span>
            </Link>

            <Link
              to="/pipelines"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-7 py-4 rounded-xl bg-white hover:bg-[#F2EDE6] text-[#2D2926] border border-[#E5DED6] hover:border-[#D97757]/40 font-semibold text-base shadow-sm hover:shadow transition-all"
            >
              <span className="material-symbols-outlined text-xl text-[#D97757]">account_tree</span>
              <span>Inspect DAG Pipelines</span>
            </Link>
          </div>

          {/* Value Highlights Pill Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl pt-8 border-t border-[#E5DED6]/80 text-left">
            <div className="p-4 rounded-xl bg-white/70 border border-[#E5DED6] backdrop-blur-sm shadow-sm">
              <div className="text-2xl font-bold text-[#D97757] font-headline-md">99.98%</div>
              <div className="text-xs text-[#6B625B] font-medium mt-0.5">Autonomous Fix Accuracy</div>
            </div>
            <div className="p-4 rounded-xl bg-white/70 border border-[#E5DED6] backdrop-blur-sm shadow-sm">
              <div className="text-2xl font-bold text-[#5B7C4B] font-headline-md">&lt; 1.8 min</div>
              <div className="text-xs text-[#6B625B] font-medium mt-0.5">Mean Time to Recover (MTTR)</div>
            </div>
            <div className="p-4 rounded-xl bg-white/70 border border-[#E5DED6] backdrop-blur-sm shadow-sm">
              <div className="text-2xl font-bold text-[#B87A36] font-headline-md">0 Downtime</div>
              <div className="text-xs text-[#6B625B] font-medium mt-0.5">Progressive Canary Rollbacks</div>
            </div>
            <div className="p-4 rounded-xl bg-white/70 border border-[#E5DED6] backdrop-blur-sm shadow-sm">
              <div className="text-2xl font-bold text-[#2D2926] font-headline-md">4 AI Agents</div>
              <div className="text-xs text-[#6B625B] font-medium mt-0.5">Collaborative Fleet Specialists</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Interactive Product Preview Frame ─── */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 pb-28">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="font-label-caps text-xs text-[#D97757] uppercase tracking-widest font-bold">
            Interactive Product Preview
          </span>
          <h2 className="font-headline-lg text-3xl sm:text-4xl font-bold text-[#2D2926] mt-2 mb-4">
            Unified Mission Control for High-Velocity Teams
          </h2>
          <p className="text-base text-[#6B625B]">
            Switch between views to experience how SentinelOps monitors clusters, visualizes DAG workflows, remediates incidents, and orchestrates AI agents in real time.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex overflow-x-auto pb-2 sm:pb-0 sm:flex-wrap items-center justify-start sm:justify-center gap-2 mb-6 scrollbar-none">
          <button
            onClick={() => setActiveTab('control')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'control'
                ? 'bg-[#D97757] text-white shadow-md'
                : 'bg-white text-[#6B625B] hover:bg-[#F2EDE6] border border-[#E5DED6]'
            }`}
          >
            <span className="material-symbols-outlined text-base">dashboard</span>
            <span>Control Center</span>
          </button>
          <button
            onClick={() => setActiveTab('dag')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'dag'
                ? 'bg-[#D97757] text-white shadow-md'
                : 'bg-white text-[#6B625B] hover:bg-[#F2EDE6] border border-[#E5DED6]'
            }`}
          >
            <span className="material-symbols-outlined text-base">account_tree</span>
            <span>DAG Workflows</span>
          </button>
          <button
            onClick={() => setActiveTab('incident')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'incident'
                ? 'bg-[#D97757] text-white shadow-md'
                : 'bg-white text-[#6B625B] hover:bg-[#F2EDE6] border border-[#E5DED6]'
            }`}
          >
            <span className="material-symbols-outlined text-base">warning</span>
            <span>Self-Healing (INC-8924)</span>
          </button>
          <button
            onClick={() => setActiveTab('fleet')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'fleet'
                ? 'bg-[#D97757] text-white shadow-md'
                : 'bg-white text-[#6B625B] hover:bg-[#F2EDE6] border border-[#E5DED6]'
            }`}
          >
            <span className="material-symbols-outlined text-base">smart_toy</span>
            <span>Agent Fleet</span>
          </button>
        </div>

        {/* Browser Mock Frame */}
        <div className="bg-white rounded-2xl border border-[#E5DED6] shadow-[0_20px_50px_rgba(45,41,38,0.08)] overflow-hidden">
          {/* Mock Window Top Bar */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-[#FBF9F5] border-b border-[#E5DED6] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#C34A4A]/70" />
              <div className="w-3 h-3 rounded-full bg-[#B87A36]/70" />
              <div className="w-3 h-3 rounded-full bg-[#5B7C4B]/70" />
              <div className="ml-4 px-4 py-1 rounded-md bg-white border border-[#E5DED6] text-[11px] font-label-code-sm text-[#6B625B] flex items-center gap-2 shadow-inner">
                <span className="material-symbols-outlined text-xs text-[#5B7C4B]">lock</span>
                <span>sentinelops.enterprise.internal/{activeTab}</span>
              </div>
            </div>
            <Link
              to={`/${activeTab === 'control' ? 'dashboard' : activeTab === 'dag' ? 'pipelines' : activeTab === 'incident' ? 'incidents' : 'ai-agents'}`}
              className="text-xs font-bold text-[#D97757] hover:text-[#99462A] flex items-center gap-1"
            >
              <span>Open in Full Screen</span>
              <span className="material-symbols-outlined text-sm">open_in_new</span>
            </Link>
          </div>

          {/* Interactive Screen Container */}
          <div className="p-6 md:p-8 bg-[#F7F4EF]/50 min-h-[460px]">
            {activeTab === 'control' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Metrics Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-white border border-[#E5DED6] shadow-sm">
                    <div className="text-xs text-[#6B625B] font-semibold">Active Pipelines</div>
                    <div className="text-2xl font-bold text-[#2D2926] mt-1 font-headline-sm">1,428</div>
                    <div className="text-[11px] text-[#5B7C4B] font-semibold mt-1">↑ 12.4% vs last week</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-[#E5DED6] shadow-sm">
                    <div className="text-xs text-[#6B625B] font-semibold">Autonomous Success Rate</div>
                    <div className="text-2xl font-bold text-[#5B7C4B] mt-1 font-headline-sm">99.4%</div>
                    <div className="text-[11px] text-[#6B625B] mt-1">1,392 auto-resolved</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-[#E5DED6] shadow-sm">
                    <div className="text-xs text-[#6B625B] font-semibold">Mean Time to Recover</div>
                    <div className="text-2xl font-bold text-[#D97757] mt-1 font-headline-sm">1.8m</div>
                    <div className="text-[11px] text-[#5B7C4B] font-semibold mt-1">↓ 74% reduction</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-[#E5DED6] shadow-sm">
                    <div className="text-xs text-[#6B625B] font-semibold">Fleet Agent Health</div>
                    <div className="text-2xl font-bold text-[#2D2926] mt-1 font-headline-sm">4 / 4 Active</div>
                    <div className="text-[11px] text-[#D97757] font-semibold mt-1">All workers nominal</div>
                  </div>
                </div>

                {/* Live Activity Banner */}
                <div className="p-4 rounded-xl bg-white border border-[#E5DED6] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="p-2 rounded-lg bg-[#F9ECE7] text-[#D97757] material-symbols-outlined">auto_fix_high</span>
                    <div>
                      <div className="text-sm font-bold text-[#2D2926]">Incident INC-8924: Memory leak auto-remediated</div>
                      <div className="text-xs text-[#6B625B]">Healer-Alpha generated hotfix PR #318 • Passed 100% sandbox regression</div>
                    </div>
                  </div>
                  <Link
                    to="/incidents"
                    className="px-4 py-2 rounded-lg bg-[#D97757] text-white text-xs font-bold whitespace-nowrap shadow-sm hover:bg-[#C66849]"
                  >
                    View Incident Diff
                  </Link>
                </div>
              </div>
            )}

            {activeTab === 'dag' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="p-6 rounded-xl bg-white border border-[#E5DED6] shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-base font-bold text-[#2D2926]">pipeline-core-checkout #1042</h4>
                      <p className="text-xs text-[#6B625B]">Production Deployment Workflow • Triggered by Git Push (main)</p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-[#5B7C4B]/10 text-[#5B7C4B] text-xs font-bold">
                      RUNNING (Step 3/4)
                    </span>
                  </div>

                  {/* DAG Visual Nodes */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
                    <div className="p-4 rounded-xl bg-[#FBF9F5] border border-[#5B7C4B]/30 relative">
                      <div className="flex items-center justify-between">
                        <span className="font-label-code-sm text-xs font-bold text-[#2D2926]">1. Code Lint & Typecheck</span>
                        <span className="material-symbols-outlined text-sm text-[#5B7C4B]">check_circle</span>
                      </div>
                      <div className="text-[11px] text-[#6B625B] mt-2">Passed in 24s • 0 warnings</div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#FBF9F5] border border-[#5B7C4B]/30 relative">
                      <div className="flex items-center justify-between">
                        <span className="font-label-code-sm text-xs font-bold text-[#2D2926]">2. Multi-Platform Build</span>
                        <span className="material-symbols-outlined text-sm text-[#5B7C4B]">check_circle</span>
                      </div>
                      <div className="text-[11px] text-[#6B625B] mt-2">Passed in 1m 12s • Docker AMD64/ARM64</div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#F9ECE7] border border-[#D97757] relative shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-label-code-sm text-xs font-bold text-[#99462A]">3. AI Security & SAST</span>
                        <span className="material-symbols-outlined text-sm text-[#D97757] animate-spin">sync</span>
                      </div>
                      <div className="text-[11px] text-[#99462A] mt-2">Running • 82% evaluated</div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#F2EDE6]/50 border border-[#E5DED6] opacity-70">
                      <div className="flex items-center justify-between">
                        <span className="font-label-code-sm text-xs font-semibold text-[#6B625B]">4. Canary Progressive Deploy</span>
                        <span className="material-symbols-outlined text-sm text-[#6B625B]">schedule</span>
                      </div>
                      <div className="text-[11px] text-[#6B625B] mt-2">Queued • CanaryGuard Gatekeeper</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'incident' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="p-6 rounded-xl bg-white border border-[#E5DED6] shadow-sm">
                  <div className="flex items-center justify-between mb-4 border-b border-[#E5DED6] pb-4">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-full bg-[#C34A4A]/10 text-[#C34A4A] text-xs font-bold">
                        P1 CRITICAL
                      </span>
                      <h4 className="text-base font-bold text-[#2D2926]">INC-8924: Unhandled goroutine leak in auth worker</h4>
                    </div>
                    <span className="text-xs text-[#5B7C4B] font-bold">
                      RESOLVED AUTONOMOUSLY
                    </span>
                  </div>

                  {/* Incident diff preview */}
                  <div className="rounded-lg bg-[#2D2926] text-white p-4 font-label-code-sm text-xs overflow-x-auto">
                    <div className="text-[#6B625B] mb-2">// diff generated by Healer-Alpha (confidence: 99.4%)</div>
                    <div className="text-[#C34A4A]">- go func() &#123; worker.Listen(ctx) &#125;() // unmanaged lifetime</div>
                    <div className="text-[#5B7C4B]">+ g, ctx := errgroup.WithContext(ctx)</div>
                    <div className="text-[#5B7C4B]">+ g.Go(func() error &#123; return worker.ListenWithDrain(ctx) &#125;)</div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-[#6B625B]">
                    <span>Sandbox verification: 48/48 integration tests passed</span>
                    <span className="text-[#5B7C4B] font-bold">Total time to fix: 1m 42s</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'fleet' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
                <div className="p-5 rounded-xl bg-white border border-[#E5DED6] shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#2D2926]">Sentinel-Core</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#5B7C4B]/10 text-[#5B7C4B]">ACTIVE</span>
                  </div>
                  <p className="text-xs text-[#6B625B]">Orchestration kernel & policy governance engine. Synchronizes distributed cluster states.</p>
                  <div className="mt-3 text-xs font-semibold text-[#D97757]">Throughput: 142 workflows / hr</div>
                </div>

                <div className="p-5 rounded-xl bg-white border border-[#E5DED6] shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#2D2926]">Healer-Alpha</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#5B7C4B]/10 text-[#5B7C4B]">ACTIVE</span>
                  </div>
                  <p className="text-xs text-[#6B625B]">Real-time telemetry diagnostic specialist. Generates semantic patch diffs in &lt;90 seconds.</p>
                  <div className="mt-3 text-xs font-semibold text-[#D97757]">Fix Accuracy: 99.8%</div>
                </div>

                <div className="p-5 rounded-xl bg-white border border-[#E5DED6] shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#2D2926]">TestForge</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#5B7C4B]/10 text-[#5B7C4B]">ACTIVE</span>
                  </div>
                  <p className="text-xs text-[#6B625B]">Spawns isolated ephemeral sandbox test environments to prove patches before staging.</p>
                  <div className="mt-3 text-xs font-semibold text-[#D97757]">Avg Run: 45s</div>
                </div>

                <div className="p-5 rounded-xl bg-white border border-[#E5DED6] shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#2D2926]">CanaryGuard</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#5B7C4B]/10 text-[#5B7C4B]">ACTIVE</span>
                  </div>
                  <p className="text-xs text-[#6B625B]">Progressive traffic routing guardrail. Instant zero-downtime rollback on 0.1% error spike.</p>
                  <div className="mt-3 text-xs font-semibold text-[#D97757]">Rollbacks: 0 manual required</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── Autonomous AI Agent Fleet (Deep Dive) ─── */}
      <section id="fleet" className="relative z-10 py-24 bg-white border-y border-[#E5DED6]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="font-label-caps text-xs text-[#D97757] uppercase tracking-widest font-bold">
              Collaborative Intelligence
            </span>
            <h2 className="font-headline-lg text-3xl sm:text-4xl font-bold text-[#2D2926] mt-2 mb-4">
              Meet Your 24/7 Autonomous AI DevOps Fleet
            </h2>
            <p className="text-base text-[#6B625B]">
              Each agent is engineered with domain specialization to handle the entire lifecycle of software delivery—from code commit to telemetry self-healing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Agent 1 */}
            <div className="p-6 rounded-2xl bg-[#FBF9F5] border border-[#E5DED6] hover:border-[#D97757]/40 hover:shadow-lg transition-all group flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#D97757]/10 text-[#D97757] flex items-center justify-center mb-4 group-hover:bg-[#D97757] group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-2xl">hub</span>
                </div>
                <h3 className="font-headline-sm text-lg font-bold text-[#2D2926] mb-1">Sentinel-Core</h3>
                <span className="font-label-code-sm text-xs text-[#D97757] font-semibold block mb-3">Orchestration & Governance</span>
                <p className="text-sm text-[#6B625B] leading-relaxed">
                  Controls DAG pipeline flow, verifies cryptographic commit signatures, and enforces security compliance policies across all cluster nodes.
                </p>
              </div>
              <div className="pt-4 mt-6 border-t border-[#E5DED6] text-xs font-semibold text-[#2D2926] flex items-center justify-between">
                <span>Task Queue</span>
                <span className="text-[#5B7C4B]">0 ms latency</span>
              </div>
            </div>

            {/* Agent 2 */}
            <div className="p-6 rounded-2xl bg-[#FBF9F5] border border-[#E5DED6] hover:border-[#D97757]/40 hover:shadow-lg transition-all group flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#D97757]/10 text-[#D97757] flex items-center justify-center mb-4 group-hover:bg-[#D97757] group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-2xl">healing</span>
                </div>
                <h3 className="font-headline-sm text-lg font-bold text-[#2D2926] mb-1">Healer-Alpha</h3>
                <span className="font-label-code-sm text-xs text-[#D97757] font-semibold block mb-3">Incident Triage & Patching</span>
                <p className="text-sm text-[#6B625B] leading-relaxed">
                  Listens to production telemetry spikes, pinpoints stack traces, and synthesizes candidate fix diffs ready for review or auto-apply.
                </p>
              </div>
              <div className="pt-4 mt-6 border-t border-[#E5DED6] text-xs font-semibold text-[#2D2926] flex items-center justify-between">
                <span>Fix Confidence</span>
                <span className="text-[#5B7C4B]">99.8%</span>
              </div>
            </div>

            {/* Agent 3 */}
            <div className="p-6 rounded-2xl bg-[#FBF9F5] border border-[#E5DED6] hover:border-[#D97757]/40 hover:shadow-lg transition-all group flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#D97757]/10 text-[#D97757] flex items-center justify-center mb-4 group-hover:bg-[#D97757] group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-2xl">science</span>
                </div>
                <h3 className="font-headline-sm text-lg font-bold text-[#2D2926] mb-1">TestForge</h3>
                <span className="font-label-code-sm text-xs text-[#D97757] font-semibold block mb-3">Ephemeral Sandbox Verification</span>
                <p className="text-sm text-[#6B625B] leading-relaxed">
                  Generates regression test suites on-the-fly and runs them in micro-VM sandboxes to guarantee no breaking changes reach staging.
                </p>
              </div>
              <div className="pt-4 mt-6 border-t border-[#E5DED6] text-xs font-semibold text-[#2D2926] flex items-center justify-between">
                <span>Avg Sandbox Test</span>
                <span className="text-[#5B7C4B]">45 seconds</span>
              </div>
            </div>

            {/* Agent 4 */}
            <div className="p-6 rounded-2xl bg-[#FBF9F5] border border-[#E5DED6] hover:border-[#D97757]/40 hover:shadow-lg transition-all group flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#D97757]/10 text-[#D97757] flex items-center justify-center mb-4 group-hover:bg-[#D97757] group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-2xl">shield</span>
                </div>
                <h3 className="font-headline-sm text-lg font-bold text-[#2D2926] mb-1">CanaryGuard</h3>
                <span className="font-label-code-sm text-xs text-[#D97757] font-semibold block mb-3">Progressive Traffic & Safety</span>
                <p className="text-sm text-[#6B625B] leading-relaxed">
                  Orchestrates blue/green and canary shifts (2% &rarr; 10% &rarr; 50% &rarr; 100%). Triggers sub-second rollback if telemetry breaches threshold.
                </p>
              </div>
              <div className="pt-4 mt-6 border-t border-[#E5DED6] text-xs font-semibold text-[#2D2926] flex items-center justify-between">
                <span>Rollback Latency</span>
                <span className="text-[#5B7C4B]">&lt; 300ms</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How Self-Healing Works (The 4-Step Autonomous Loop) ─── */}
      <section id="workflow" className="relative z-10 py-24 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="font-label-caps text-xs text-[#D97757] uppercase tracking-widest font-bold">
            Autonomous Resilience
          </span>
          <h2 className="font-headline-lg text-3xl sm:text-4xl font-bold text-[#2D2926] mt-2 mb-4">
            How SentinelOps Resolves Production Incidents in &lt; 3 Minutes
          </h2>
          <p className="text-base text-[#6B625B]">
            From anomaly detection to verified production deployment without requiring engineers to wake up at 3 AM.
          </p>
        </div>

        {/* Step Progression Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div
            onClick={() => setActiveStep(1)}
            className={`cursor-pointer p-6 rounded-2xl border transition-all ${
              activeStep === 1
                ? 'bg-white border-[#D97757] shadow-[0_8px_30px_rgba(217,119,87,0.12)]'
                : 'bg-white/60 border-[#E5DED6] hover:bg-white'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-[#D97757] text-white text-xs font-bold flex items-center justify-center mb-4">
              01
            </div>
            <h4 className="font-headline-sm text-base font-bold text-[#2D2926] mb-2">Anomaly Detected</h4>
            <p className="text-xs text-[#6B625B] leading-relaxed">
              Continuous telemetry monitors detect a memory leak or crash loop within 4 seconds of initial spike.
            </p>
          </div>

          <div
            onClick={() => setActiveStep(2)}
            className={`cursor-pointer p-6 rounded-2xl border transition-all ${
              activeStep === 2
                ? 'bg-white border-[#D97757] shadow-[0_8px_30px_rgba(217,119,87,0.12)]'
                : 'bg-white/60 border-[#E5DED6] hover:bg-white'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-[#D97757] text-white text-xs font-bold flex items-center justify-center mb-4">
              02
            </div>
            <h4 className="font-headline-sm text-base font-bold text-[#2D2926] mb-2">Root Cause Traced</h4>
            <p className="text-xs text-[#6B625B] leading-relaxed">
              Healer-Alpha isolates the unmanaged goroutine and correlates recent commit metadata.
            </p>
          </div>

          <div
            onClick={() => setActiveStep(3)}
            className={`cursor-pointer p-6 rounded-2xl border transition-all ${
              activeStep === 3
                ? 'bg-white border-[#D97757] shadow-[0_8px_30px_rgba(217,119,87,0.12)]'
                : 'bg-white/60 border-[#E5DED6] hover:bg-white'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-[#D97757] text-white text-xs font-bold flex items-center justify-center mb-4">
              03
            </div>
            <h4 className="font-headline-sm text-base font-bold text-[#2D2926] mb-2">Sandbox Dry-Run</h4>
            <p className="text-xs text-[#6B625B] leading-relaxed">
              TestForge synthesizes an automated fix PR and executes 48 integration tests in an isolated sandbox.
            </p>
          </div>

          <div
            onClick={() => setActiveStep(4)}
            className={`cursor-pointer p-6 rounded-2xl border transition-all ${
              activeStep === 4
                ? 'bg-white border-[#D97757] shadow-[0_8px_30px_rgba(217,119,87,0.12)]'
                : 'bg-white/60 border-[#E5DED6] hover:bg-white'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-[#D97757] text-white text-xs font-bold flex items-center justify-center mb-4">
              04
            </div>
            <h4 className="font-headline-sm text-base font-bold text-[#2D2926] mb-2">Canary Self-Heal</h4>
            <p className="text-xs text-[#6B625B] leading-relaxed">
              CanaryGuard progressively rolls out the verified patch to production nodes with zero user impact.
            </p>
          </div>
        </div>
      </section>

      {/* ─── DORA & Enterprise Impact Metrics ─── */}
      <section id="metrics" className="relative z-10 py-24 bg-[#2D2926] text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="font-label-caps text-xs text-[#D97757] uppercase tracking-widest font-bold">
              Proven DORA Outcomes
            </span>
            <h2 className="font-headline-lg text-3xl sm:text-4xl font-bold text-white mt-2 mb-4">
              Engineered for Extreme Velocity & Reliability
            </h2>
            <p className="text-base text-[#EDE0D7]/70">
              Transform your engineering culture with measurable operational gains across all standard DORA benchmarks.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-5xl font-bold text-[#D97757] font-headline-xl mb-2">-74%</div>
              <h4 className="text-base font-bold mb-1">Mean Time to Recover</h4>
              <p className="text-xs text-[#EDE0D7]/60 leading-relaxed">
                Reduced average production incident resolution time from 58 minutes down to 1.8 minutes.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-5xl font-bold text-[#5B7C4B] font-headline-xl mb-2">12x</div>
              <h4 className="text-base font-bold mb-1">Deployment Frequency</h4>
              <p className="text-xs text-[#EDE0D7]/60 leading-relaxed">
                Empowered teams to release 18+ high-confidence deployments daily with automated policy validation.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-5xl font-bold text-[#B87A36] font-headline-xl mb-2">&lt;0.01%</div>
              <h4 className="text-base font-bold mb-1">Change Failure Rate</h4>
              <p className="text-xs text-[#EDE0D7]/60 leading-relaxed">
                CanaryGuard auto-rollback caught 100% of faulty deployments before customer traffic was impacted.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-5xl font-bold text-white font-headline-xl mb-2">100%</div>
              <h4 className="text-base font-bold mb-1">Audit Compliance</h4>
              <p className="text-xs text-[#EDE0D7]/60 leading-relaxed">
                Every autonomous agent decision is cryptographically signed and stored in immutable audit logs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Enterprise Security & Governance ─── */}
      <section id="security" className="relative z-10 py-24 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="font-label-caps text-xs text-[#D97757] uppercase tracking-widest font-bold">
            Enterprise Ready
          </span>
          <h2 className="font-headline-lg text-3xl sm:text-4xl font-bold text-[#2D2926] mt-2 mb-4">
            Security & Governance Without Compromise
          </h2>
          <p className="text-base text-[#6B625B]">
            SentinelOps is designed to run in highly regulated environments with complete privacy and zero telemetry leakage.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-2xl bg-white border border-[#E5DED6] shadow-sm">
            <span className="material-symbols-outlined text-3xl text-[#D97757] mb-4">vpn_lock</span>
            <h4 className="font-headline-sm text-lg font-bold text-[#2D2926] mb-2">VPC & Air-Gapped</h4>
            <p className="text-sm text-[#6B625B] leading-relaxed">
              Deploy fully inside your AWS, GCP, or Azure VPC. AI models run locally or via private endpoint tunnels with zero third-party data transmission.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-white border border-[#E5DED6] shadow-sm">
            <span className="material-symbols-outlined text-3xl text-[#D97757] mb-4">verified_user</span>
            <h4 className="font-headline-sm text-lg font-bold text-[#2D2926] mb-2">Human-in-the-Loop Controls</h4>
            <p className="text-sm text-[#6B625B] leading-relaxed">
              Define strict confidence thresholds. Autonomous agents can be required to request manual operator sign-off before modifying core production clusters.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-white border border-[#E5DED6] shadow-sm">
            <span className="material-symbols-outlined text-3xl text-[#D97757] mb-4">badge</span>
            <h4 className="font-headline-sm text-lg font-bold text-[#2D2926] mb-2">Role-Based Access (RBAC)</h4>
            <p className="text-sm text-[#6B625B] leading-relaxed">
              Granular access control, SAML / Okta SSO integration, and fine-grained agent permission scopes mapped to Git repositories.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Final CTA Banner ─── */}
      <section className="relative z-10 py-20 px-6 max-w-7xl mx-auto">
        <div className="rounded-3xl bg-gradient-to-br from-[#D97757] via-[#C66849] to-[#99462A] text-white p-10 md:p-16 text-center relative overflow-hidden shadow-[0_20px_50px_rgba(217,119,87,0.35)]">
          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="font-headline-lg text-3xl sm:text-5xl font-bold mb-4 tracking-tight leading-tight">
              Ready to eliminate on-call burnout with autonomous DevOps?
            </h2>
            <p className="text-base sm:text-lg text-white/90 mb-8 max-w-2xl mx-auto">
              Experience the SentinelOps mission control center now. Inspect live pipelines, trigger autonomous remediation simulations, and see the agent fleet in action.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-white text-[#99462A] font-bold text-base shadow-lg hover:bg-[#FBF9F5] transition-all transform hover:-translate-y-0.5"
              >
                <span className="material-symbols-outlined text-xl">rocket_launch</span>
                <span>Launch Operations Console</span>
              </Link>

              <a
                href="https://github.com/naveenkumar030/SentinelOps"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-[#99462A]/60 hover:bg-[#99462A] text-white border border-white/20 font-semibold text-base transition-all"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span>Star on GitHub</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="relative z-10 bg-white border-t border-[#E5DED6] py-12 px-6 text-sm text-[#6B625B]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#D97757] text-white flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">security</span>
            </div>
            <div>
              <span className="font-bold text-[#2D2926]">SentinelOps</span>
              <span className="text-xs text-[#6B625B] ml-2">Autonomous DevOps CI/CD Platform</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-medium">
            <Link to="/dashboard" className="hover:text-[#D97757] transition-colors">Control Center</Link>
            <Link to="/pipelines" className="hover:text-[#D97757] transition-colors">DAG Pipelines</Link>
            <Link to="/incidents" className="hover:text-[#D97757] transition-colors">Incidents</Link>
            <Link to="/ai-agents" className="hover:text-[#D97757] transition-colors">AI Agents</Link>
            <Link to="/pull-requests" className="hover:text-[#D97757] transition-colors">Code Reviews</Link>
            <Link to="/analytics" className="hover:text-[#D97757] transition-colors">DORA Analytics</Link>
            <a
              href="https://github.com/naveenkumar030/SentinelOps"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#D97757] transition-colors"
            >
              GitHub Repo
            </a>
          </div>

          <div className="text-xs text-[#6B625B]">
            © {new Date().getFullYear()} SentinelOps • Open Source Apache 2.0
          </div>
        </div>
      </footer>
    </div>
  );
}
