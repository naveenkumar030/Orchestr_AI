import { useState, useEffect } from 'react';
import { pullRequests as initialPRs } from '../data/mockData';
import { api } from '../services/api';
import type { PullRequest } from '../types';
import CreatePRModal from '../components/modals/CreatePRModal';

export default function PullRequestsPage() {
  const [prList, setPrList] = useState<PullRequest[]>(initialPRs);
  const [selectedPR, setSelectedPR] = useState<PullRequest>(initialPRs[0]);
  const [filter, setFilter] = useState<'all' | 'staged' | 'review' | 'merged'>('all');
  const [activeTab, setActiveTab] = useState<'review' | 'diff' | 'security'>('review');
  const [notification, setNotification] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreatePRModalOpen, setIsCreatePRModalOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.getPullRequests().then((data) => {
      if (!mounted) return;
      if (data && data.length > 0) {
        setPrList(data);
        setSelectedPR((prev) => data.find((p) => p.id === prev.id) || data[0]);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleReview = async () => {
    setIsProcessing(true);
    try {
      const updated = await api.reviewPullRequest(selectedPR.id);
      setPrList((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setSelectedPR(updated);
      setNotification(`PR #${updated.number} reviewed by SentinelOps AI Engine — Score updated to ${updated.aiReviewScore}%`);
      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      console.error('Failed to review PR:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMerge = async () => {
    setIsProcessing(true);
    try {
      const updated = await api.mergePullRequest(selectedPR.id);
      setPrList((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setSelectedPR(updated);
      setNotification(`PR #${updated.number} merged into branch '${updated.branch}' via Flask backend!`);
      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      console.error('Failed to merge PR:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredPRs = prList.filter((pr) => {
    if (filter === 'all') return true;
    if (filter === 'staged') return pr.status === 'approved' || pr.status === 'reviewing';
    if (filter === 'review') return pr.status === 'changes_requested' || pr.status === 'reviewing';
    if (filter === 'merged') return pr.status === 'merged';
    return true;
  });


  return (
    <div className="space-y-space-lg">
      {/* Toast Notification */}
      {notification && (
        <div className="p-3 rounded-lg bg-[#EAF3E7] border border-[#5B7C4B]/40 text-[#5B7C4B] text-xs font-semibold flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">task_alt</span>
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-[#5B7C4B] hover:text-[#2D2926]">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-space-sm">
        <div>
          <div className="flex items-center gap-space-xs text-[#6B625B] font-label-code-sm text-xs">
            <span>Control Center</span>
            <span>/</span>
            <span className="text-[#99462A] font-semibold">Autonomous Code Review</span>
          </div>
          <h1 className="font-headline-lg text-xl sm:text-2xl font-bold text-[#2D2926] tracking-tight mt-1">
            Pull Requests &amp; Semantic Code Review
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-space-sm">
          <button 
            onClick={() => {
              setNotification("Review Policies dashboard is currently in beta. Redirecting to settings...");
              setTimeout(() => setNotification(null), 4000);
            }}
            className="px-3.5 sm:px-4 py-2 rounded-lg bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] text-[#2D2926] font-medium font-body-sm flex items-center gap-1.5 sm:gap-2 shadow-sm transition-all text-xs"
          >
            <span className="material-symbols-outlined text-base text-[#D97757]">settings</span>
            <span>Review Policies</span>
          </button>
          <button 
            onClick={() => setIsCreatePRModalOpen(true)}
            className="px-3.5 sm:px-4 py-2 rounded-lg bg-[#D97757] hover:bg-[#B85D3E] text-white font-medium font-body-sm flex items-center gap-1.5 sm:gap-2 shadow-sm transition-all text-xs"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>New PR</span>
          </button>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-base">
        <div className="p-space-base rounded-xl bg-white border border-[#E5DED6] shadow-card flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#6B625B] mb-2">
            <span className="font-label-caps text-xs uppercase tracking-wider font-semibold">Pending Autonomous PRs</span>
            <span className="material-symbols-outlined text-[#D97757] text-xl">call_merge</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-[#2D2926]">5</span>
            <span className="font-label-code-sm text-xs text-[#99462A] font-semibold">2 Staged for Merge</span>
          </div>
          <div className="mt-3 pt-2 flex items-center justify-between text-[#6B625B] border-t border-[#E5DED6] text-xs">
            <span>Avg time in review: 1m 40s</span>
            <span className="text-[#5B7C4B] font-semibold">Fast Track</span>
          </div>
        </div>

        <div className="p-space-base rounded-xl bg-white border border-[#E5DED6] shadow-card flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#6B625B] mb-2">
            <span className="font-label-caps text-xs uppercase tracking-wider font-semibold">Autonomy Index</span>
            <span className="material-symbols-outlined text-[#D97757] text-xl">auto_awesome</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-[#2D2926]">82.4%</span>
            <span className="font-label-code-sm text-xs text-[#5B7C4B] font-semibold">+14.2% this month</span>
          </div>
          <div className="mt-3 pt-2 flex items-center justify-between text-[#6B625B] border-t border-[#E5DED6] text-xs">
            <span>PRs merged with zero manual edits</span>
            <span className="material-symbols-outlined text-sm text-[#5B7C4B]">verified</span>
          </div>
        </div>

        <div className="p-space-base rounded-xl bg-white border border-[#E5DED6] shadow-card flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#6B625B] mb-2">
            <span className="font-label-caps text-xs uppercase tracking-wider font-semibold">Regression Guard</span>
            <span className="material-symbols-outlined text-[#5B7C4B] text-xl">verified_user</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-[#2D2926]">0</span>
            <span className="font-label-code-sm text-xs text-[#5B7C4B] font-semibold">Regressions</span>
          </div>
          <div className="mt-3 pt-2 flex items-center justify-between text-[#6B625B] border-t border-[#E5DED6] text-xs">
            <span>Cosign verified signature chain</span>
            <span className="text-[#5B7C4B] font-semibold">Active</span>
          </div>
        </div>

        <div className="p-space-base rounded-xl bg-white border border-[#E5DED6] shadow-card flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#6B625B] mb-2">
            <span className="font-label-caps text-xs uppercase tracking-wider font-semibold">Ephemeral Sandbox Pass</span>
            <span className="material-symbols-outlined text-[#5B7C4B] text-xl">task_alt</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-[#2D2926]">100%</span>
            <span className="font-label-code-sm text-xs text-[#5B7C4B] font-semibold">1,824 Tests</span>
          </div>
          <div className="mt-3 pt-2 flex items-center justify-between text-[#6B625B] border-t border-[#E5DED6] text-xs">
            <span>100% isolated micro-containers</span>
            <span className="h-2 w-2 rounded-full bg-[#5B7C4B] animate-pulse"></span>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="p-2 rounded-xl bg-[#F2EDE6] border border-[#E5DED6] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {(['all', 'staged', 'review', 'merged'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                filter === tab
                  ? 'bg-white text-[#2D2926] shadow-sm'
                  : 'text-[#6B625B] hover:text-[#2D2926]'
              }`}
            >
              {tab === 'all' ? 'All PRs (5)' : tab === 'staged' ? 'Staged for Merge' : tab === 'review' ? 'Needs Review' : 'Merged'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter by repo or branch..."
            className="h-8 px-3 rounded-lg bg-white border border-[#E5DED6] text-xs placeholder:text-[#6B625B] focus:outline-none focus:border-[#D97757]"
          />
        </div>
      </div>

      {/* 2-Column Split: Selected PR Review & Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* Left Column: Selected PR Details (8 cols) */}
        <div className="lg:col-span-8 space-y-space-lg">
          <div className="rounded-2xl bg-white border border-[#E5DED6] shadow-card overflow-hidden">
            {/* PR Header */}
            <div className="p-space-md bg-[#F2EDE6] border-b border-[#E5DED6] flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-white border border-[#E5DED6] text-[#D97757] font-mono text-xs font-bold">
                    PR #{selectedPR.number}
                  </span>
                  <span className="h-2 w-2 rounded-full bg-[#D97757]"></span>
                  <h2 className="font-headline-sm text-base font-bold text-[#2D2926]">{selectedPR.title}</h2>
                </div>

                <span className="px-2.5 py-0.5 rounded-full bg-[#F9ECE7] border border-[#D97757]/30 text-[#99462A] font-mono text-xs font-semibold">
                  {selectedPR.status.toUpperCase()}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-[#6B625B]">
                <span>repo: <strong className="text-[#2D2926]">{selectedPR.repo}</strong></span>
                <span>branch: <strong className="text-[#2D2926]">{selectedPR.branch}</strong></span>
                <span>author: <strong className="text-[#2D2926]">{selectedPR.author}</strong></span>
                <span>updated {selectedPR.time}</span>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-4 px-space-md border-b border-[#E5DED6] text-xs font-semibold">
              <button
                onClick={() => setActiveTab('review')}
                className={`py-3 border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'review'
                    ? 'border-[#D97757] text-[#D97757]'
                    : 'border-transparent text-[#6B625B] hover:text-[#2D2926]'
                }`}
              >
                <span className="material-symbols-outlined text-base">psychology</span>
                <span>AI Review &amp; Verdict</span>
              </button>
              <button
                onClick={() => setActiveTab('diff')}
                className={`py-3 border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'diff'
                    ? 'border-[#D97757] text-[#D97757]'
                    : 'border-transparent text-[#6B625B] hover:text-[#2D2926]'
                }`}
              >
                <span className="material-symbols-outlined text-base">difference</span>
                <span>Unified Diff (+{selectedPR.additions} / -{selectedPR.deletions})</span>
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`py-3 border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'security'
                    ? 'border-[#D97757] text-[#D97757]'
                    : 'border-transparent text-[#6B625B] hover:text-[#2D2926]'
                }`}
              >
                <span className="material-symbols-outlined text-base">shield</span>
                <span>Security &amp; AST Analysis</span>
              </button>
            </div>

            {/* Tab Body */}
            <div className="p-space-lg">
              {activeTab === 'review' && (
                <div className="space-y-space-md">
                  <div className="p-space-md rounded-xl bg-[#FAF7F3] border border-[#E5DED6] flex items-start gap-3">
                    <span className="material-symbols-outlined text-[#D97757] text-2xl">verified</span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#2D2926]">AI Reviewer Score: {selectedPR.aiReviewScore ?? 95}%</span>
                        <span className="px-2 py-0.2 rounded-full bg-[#EAF3E7] text-[#5B7C4B] font-semibold text-xs">
                          PASSED AUTOMATIC VERIFICATION
                        </span>
                      </div>
                      <p className="text-xs text-[#6B625B] leading-relaxed">
                        {selectedPR.aiComment ?? 'All semantic syntax trees match schema. No regressions or performance drops detected in ephemeral benchmark.'}
                      </p>
                    </div>
                  </div>

                  {/* Checklist */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-[#E5DED6]">
                      <span className="flex items-center gap-2 text-[#2D2926]">
                        <span className="material-symbols-outlined text-sm text-[#5B7C4B]">check_circle</span>
                        AST syntax analysis without breaking contract changes
                      </span>
                      <span className="text-[#5B7C4B] font-semibold">100% match</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-[#E5DED6]">
                      <span className="flex items-center gap-2 text-[#2D2926]">
                        <span className="material-symbols-outlined text-sm text-[#5B7C4B]">check_circle</span>
                        Deterministic lockfile resolution with no peer conflicts
                      </span>
                      <span className="text-[#5B7C4B] font-semibold">Verified</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-[#E5DED6]">
                      <span className="flex items-center gap-2 text-[#2D2926]">
                        <span className="material-symbols-outlined text-sm text-[#5B7C4B]">check_circle</span>
                        Security vulnerability scan (Trivy + Snyk)
                      </span>
                      <span className="text-[#5B7C4B] font-semibold">0 CVEs</span>
                    </div>
                  </div>

                  {/* Action bar */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#E5DED6]">
                    <span className="text-xs text-[#6B625B]">Policy: Human override is permitted at any stage</span>
                      <button
                        disabled={isProcessing}
                        onClick={handleReview}
                        className="px-3 py-1.5 rounded-lg border border-[#E5DED6] hover:bg-[#F2EDE6] text-xs font-semibold text-[#2D2926] cursor-pointer transition-all disabled:opacity-50"
                      >
                        AI Re-audit &amp; Review
                      </button>
                      <button
                        disabled={isProcessing || selectedPR.status === 'merged'}
                        onClick={handleMerge}
                        className={`px-4 py-1.5 rounded-lg text-white text-xs font-semibold shadow-sm transition-all cursor-pointer ${
                          selectedPR.status === 'merged'
                            ? 'bg-[#5B7C4B] cursor-default'
                            : 'bg-[#D97757] hover:bg-[#B85D3E]'
                        }`}
                      >
                        {selectedPR.status === 'merged' ? 'Merged into ' + selectedPR.branch : 'Approve & Merge'}
                      </button>
                  </div>
                </div>
              )}

              {activeTab === 'diff' && (
                <div className="rounded-xl bg-[#201B18] p-space-md font-mono text-xs text-[#EDE7E3] space-y-1 overflow-x-auto">
                  <div className="text-[#8F857D] pb-1 border-b border-[#3E3835]">
                    --- a/{selectedPR.repo}/package.json
                    <br />
                    +++ b/{selectedPR.repo}/package.json
                  </div>
                  <div className="text-[#D1C7BD] pl-4">@@ -15,7 +15,7 @@</div>
                  <div className="bg-[#ba1a1a]/30 text-[#fca5a5] px-2 py-0.5 rounded">
                    - "version": "1.0.4",
                  </div>
                  <div className="bg-[#15803d]/30 text-[#86efac] px-2 py-0.5 rounded">
                    + "version": "1.0.5-patch.1",
                  </div>
                  <div className="text-[#D1C7BD] pl-4"> &nbsp;&nbsp;"dependencies": &#123;</div>
                  <div className="bg-[#ba1a1a]/30 text-[#fca5a5] px-2 py-0.5 rounded">
                    - &nbsp;&nbsp;"dependency": "outdated",
                  </div>
                  <div className="bg-[#15803d]/30 text-[#86efac] px-2 py-0.5 rounded">
                    + &nbsp;&nbsp;"dependency": "resolved-latest",
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-space-sm text-xs">
                  {/* SentinelGuard UI */}
                  <div className={`p-4 rounded-lg border ${selectedPR.guard_status === 'BLOCKED' ? 'bg-[#FDF0F0] border-[#C34A4A]' : 'bg-[#EAF3E7] border-[#5B7C4B]/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`material-symbols-outlined text-lg ${selectedPR.guard_status === 'BLOCKED' ? 'text-[#C34A4A]' : 'text-[#5B7C4B]'}`}>
                        {selectedPR.guard_status === 'BLOCKED' ? 'block' : 'shield'}
                      </span>
                      <span className={`font-headline-sm font-semibold ${selectedPR.guard_status === 'BLOCKED' ? 'text-[#C34A4A]' : 'text-[#2D2926]'}`}>
                        {selectedPR.guard_status === 'BLOCKED' ? '🚫 PR Blocked by SentinelGuard' : '🛡️ SentinelGuard Safety Passed'}
                      </span>
                    </div>
                    
                    <div className="flex gap-4 mt-2">
                      <div>
                        <span className="text-[#6B625B] block mb-1 text-[10px]">Risk Level</span>
                        <span className={`font-semibold px-2 py-0.5 rounded text-xs ${
                          selectedPR.risk_level === 'LOW' ? 'bg-green-100 text-green-700' :
                          selectedPR.risk_level === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                          selectedPR.risk_level === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {selectedPR.risk_level || 'LOW'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#6B625B] block mb-1 text-[10px]">Policy</span>
                        <span className="font-semibold text-xs text-[#2D2926]">Zero-Regression + Secrets Check</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
                    <div className="font-bold text-[#2D2926] mb-1">Cosign Cryptographic Signature</div>
                    <p className="text-[#6B625B]">Signature Key: keyless.sigstore.dev // Subject: agent-patcher@autonomous.ci</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
                    <div className="font-bold text-[#2D2926] mb-1">SBOM Verification</div>
                    <p className="text-[#6B625B]">SPDX 2.3 JSON document generated and signed. Zero unlicensed dependencies added.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: PR List / Queue (4 cols) */}
        <div className="lg:col-span-4 space-y-space-md">
          <div className="rounded-2xl bg-white border border-[#E5DED6] p-space-md shadow-card space-y-3">
            <h3 className="font-headline-sm font-bold text-sm text-[#2D2926] border-b border-[#E5DED6] pb-2">
              Pull Request Queue
            </h3>

            <div className="space-y-2">
              {filteredPRs.map((pr) => (
                <div
                  key={pr.id}
                  onClick={() => setSelectedPR(pr)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedPR.id === pr.id
                      ? 'bg-[#F9ECE7]/50 border-[#D97757] shadow-sm'
                      : 'bg-white border-[#E5DED6] hover:bg-[#FAF7F3]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono font-bold text-[#D97757]">PR #{pr.number}</span>
                    <span className="text-[11px] text-[#6B625B]">{pr.time}</span>
                  </div>
                  <div className="font-semibold text-xs text-[#2D2926] line-clamp-1">{pr.title}</div>
                  <div className="flex items-center justify-between text-[11px] text-[#6B625B] mt-2 pt-1 border-t border-[#E5DED6]">
                    <span>{pr.repo}</span>
                    <span className="text-[#5B7C4B] font-semibold">+{pr.additions} / -{pr.deletions}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <CreatePRModal 
        isOpen={isCreatePRModalOpen}
        onClose={() => setIsCreatePRModalOpen(false)}
        onSuccess={(title, branch) => {
          setNotification(`Successfully requested autonomous PR "${title}" on branch ${branch}. Pipeline initiated.`);
          setTimeout(() => setNotification(null), 5000);
        }}
      />
    </div>
  );
}
