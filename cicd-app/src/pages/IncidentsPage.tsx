import { useState, useEffect } from 'react';
import { incidents as initialIncidents } from '../data/mockData';
import { api, type IncidentExplanation } from '../services/api';
import type { Incident, IncidentStatus } from '../types';

export default function IncidentsPage() {
  const [incidentList, setIncidentList] = useState<Incident[]>(initialIncidents);
  const [selectedIncident, setSelectedIncident] = useState<Incident>(initialIncidents[0]);
  const [logFilter, setLogFilter] = useState('');
  const [copied, setCopied] = useState(false);
  const [merged, setMerged] = useState(false);
  const [showExplainModal, setShowExplainModal] = useState(false);
  const [explanationData, setExplanationData] = useState<IncidentExplanation | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    api.getIncidents().then((data) => {
      if (!mounted) return;
      if (data && data.length > 0) {
        setIncidentList(data);
        setSelectedIncident((prev) => data.find((i) => i.id === prev.id) || data[0]);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleStatusChange = async (newStatus: IncidentStatus) => {
    try {
      const updated = await api.updateIncidentStatus(selectedIncident.id, newStatus);
      setIncidentList((prev) =>
        prev.map((i) => (i.id === updated.id ? updated : i))
      );
      setSelectedIncident(updated);
      if (newStatus === 'Resolved') setMerged(true);
      setNotification(`Incident ${updated.id} status updated to '${newStatus}' in Flask backend!`);
      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleExplain = async () => {
    setShowExplainModal(true);
    setIsLoadingExplanation(true);
    try {
      const exp = await api.explainIncident(selectedIncident.id);
      setExplanationData(exp);
    } catch (err) {
      console.error('Failed to fetch AI explanation:', err);
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  const rawLogs = [
    { line: '01', time: '[14:22:01]', type: 'info', text: 'Triggering pipeline step: npm test -- --bail (NodeJS v20.11.0 runtime)' },
    { line: '02', time: '[14:22:04]', type: 'error', text: 'npm ERR! code ERESOLVE' },
    { line: '03', time: '[14:22:04]', type: 'error', text: 'npm ERR! ERESOLVE could not resolve peer dependency tree' },
    { line: '04', time: '[14:22:04]', type: 'error', text: 'While resolving: @stripe/stripe-node@12.1.0' },
    { line: '05', time: '[14:22:04]', type: 'warn', text: 'Found: @types/node@20.11.0 (node_modules/@types/node)' },
    { line: '06', time: '[14:22:04]', type: 'error', text: 'Conflicting peer dependency: @types/node@^18.0.0' },
    { line: '07', time: '[14:22:05]', type: 'agent', text: 'Detected exit code 1. Stack trace fingerprint: HASH_9a7d32b4f' },
    { line: '08', time: '[14:22:06]', type: 'agent', text: 'Querying AST knowledge base for fix recipes... Match found (99% similarity to CVE-RECIPE-492)' },
  ];

  const filteredLogs = rawLogs.filter((l) =>
    l.text.toLowerCase().includes(logFilter.toLowerCase())
  );

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(rawLogs.map(l => `${l.time} ${l.text}`).join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-space-lg">
      {/* Toast Notification */}
      {notification && (
        <div className="p-3 rounded-lg bg-[#EAF3E7] border border-[#5B7C4B]/40 text-[#5B7C4B] text-xs font-semibold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">task_alt</span>
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-[#5B7C4B] hover:text-[#2D2926]">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Top Breadcrumb & Incident Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
        <div>
          <div className="flex items-center gap-space-xs text-[#6B625B] font-label-code-sm text-xs">
            <span>Control Center</span>
            <span>/</span>
            <span>Incidents</span>
            <span>/</span>
            <span className="text-[#99462A] font-semibold">{selectedIncident.id}</span>
          </div>
          <div className="flex items-center gap-space-sm mt-1">
            <h1 className="font-headline-lg text-2xl font-bold text-[#2D2926] tracking-tight">
              {selectedIncident.id}: Autonomous Remediation
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#F9ECE7] border border-[#D97757]/30 text-[#99462A] font-label-code-sm text-xs font-semibold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#D97757] animate-pulse"></span>
              {selectedIncident.status.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-space-sm">
          <select
            value={selectedIncident.id}
            onChange={(e) => {
              const inc = incidentList.find(i => i.id === e.target.value);
              if (inc) setSelectedIncident(inc);
            }}
            aria-label="Select incident"
            className="px-3 py-2 rounded-lg bg-white border border-[#E5DED6] text-xs font-medium text-[#2D2926] focus:outline-none focus:border-[#D97757]"
          >
            {incidentList.map(inc => (
              <option key={inc.id} value={inc.id}>
                {inc.id} ({inc.repo} - {inc.status})
              </option>
            ))}
          </select>

          <button
            onClick={handleExplain}
            className="px-4 py-2 rounded-lg bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] text-[#2D2926] font-medium font-body-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg text-[#D97757]">psychology</span>
            <span>Explain via AI</span>
          </button>
        </div>
      </div>


      {/* Metadata Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-space-md p-space-md rounded-xl bg-white border border-[#E5DED6] shadow-card">
        <div className="flex flex-col gap-1">
          <span className="font-label-caps text-[11px] text-[#6B625B] uppercase tracking-wider font-semibold">
            Detection to Fix
          </span>
          <span className="font-label-code-sm text-xs text-[#D97757] font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">timer</span>
            2m 14s (Autonomous)
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-label-caps text-[11px] text-[#6B625B] uppercase tracking-wider font-semibold">
            Target Branch
          </span>
          <span className="font-label-code-sm text-xs text-[#2D2926] font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-[#D97757]">alt_route</span>
            refs/heads/main
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-label-caps text-[11px] text-[#6B625B] uppercase tracking-wider font-semibold">
            Agent Engine
          </span>
          <span className="font-label-code-sm text-xs text-[#D97757] font-semibold">DevOps-LLM v2.4</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-label-caps text-[11px] text-[#6B625B] uppercase tracking-wider font-semibold">
            Confidence Score
          </span>
          <span className="font-label-code-sm text-xs text-[#D97757] font-bold">
            {selectedIncident.confidence}% Certainty
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-label-caps text-[11px] text-[#6B625B] uppercase tracking-wider font-semibold">
            Blast Radius
          </span>
          <span className="font-label-code-sm text-xs text-[#2D2926] font-medium">Isolated (Module)</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-label-caps text-[11px] text-[#6B625B] uppercase tracking-wider font-semibold">
            Service Health
          </span>
          <span className="font-label-code-sm text-xs text-[#5B7C4B] font-semibold flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5B7C4B] animate-pulse"></span>
            100% Zero Downtime
          </span>
        </div>
      </div>

      {/* Main 2-Column Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 space-y-space-lg">
          {/* 1. Root Cause Analysis Card */}
          <section className="rounded-xl bg-white border border-[#E5DED6] shadow-card overflow-hidden relative">
            <div className="p-space-md bg-[#F2EDE6]/80 border-b border-[#E5DED6] flex items-center justify-between flex-wrap gap-space-sm">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[#D97757] text-xl">auto_fix_high</span>
                <span className="font-headline-sm font-semibold text-[#2D2926] tracking-tight">
                  AI Root Cause Identified
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#F9ECE7] border border-[#D97757]/30 text-[#99462A] font-label-code-sm text-xs font-semibold">
                  Deep AST Analysis
                </span>
              </div>
              <div className="flex items-center gap-space-sm">
                <span className="font-label-caps text-xs text-[#6B625B] uppercase tracking-wider font-semibold">
                  Agent Confidence
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 rounded-full bg-[#E5DED6] overflow-hidden">
                    <div className="bg-[#D97757] h-full rounded-full" style={{ width: `${selectedIncident.confidence}%` }}></div>
                  </div>
                  <span className="font-label-code-sm text-xs text-[#D97757] font-bold">
                    {selectedIncident.confidence}%
                  </span>
                </div>
              </div>
            </div>

            <div className="p-space-lg space-y-space-md">
              {/* Conflict details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                <div className="p-space-md rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-1">
                  <span className="font-label-caps text-xs text-[#6B625B] uppercase tracking-wider font-semibold">
                    Identified Root Conflict
                  </span>
                  <p className="font-body-sm text-sm text-[#2D2926] leading-relaxed">
                    Node dependency version incompatibility: <code className="font-mono text-xs text-[#99462A] font-semibold bg-[#F9ECE7] px-1 py-0.5 rounded">@stripe/stripe-node v12.1.0</code> requires <code className="font-mono text-xs text-[#6B625B]">@types/node@^18.0.0</code>, which violates workspace spec (<code className="font-mono text-xs text-[#D97757] font-semibold">v20.11.0</code>).
                  </p>
                </div>

                <div className="p-space-md rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-1">
                  <span className="font-label-caps text-xs text-[#6B625B] uppercase tracking-wider font-semibold">
                    Impacted Target Manifests
                  </span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="font-mono text-xs px-2 py-1 rounded bg-white border border-[#E5DED6] text-[#2D2926] flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-[#D97757]">description</span>
                      package.json
                    </span>
                    <span className="font-mono text-xs px-2 py-1 rounded bg-white border border-[#E5DED6] text-[#2D2926] flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-[#D97757]">lock</span>
                      package-lock.json
                    </span>
                    <span className="font-mono text-xs px-2 py-1 rounded bg-white border border-[#E5DED6] text-[#6B625B]">
                      services/payment-webhook/**
                    </span>
                  </div>
                </div>
              </div>

              {/* Recommended Solution Banner */}
              <div className="p-space-md rounded-lg bg-[#F9ECE7] border border-[#D97757]/30 space-y-1">
                <div className="flex items-center gap-1.5 text-[#99462A]">
                  <span className="material-symbols-outlined text-base text-[#D97757]">lightbulb</span>
                  <span className="font-label-caps text-xs uppercase tracking-wider font-semibold">
                    Automated Solution Strategy
                  </span>
                </div>
                <p className="font-body-sm text-sm text-[#2D2926] leading-relaxed">
                  Update <code className="font-mono text-xs text-[#99462A] font-semibold">@stripe/stripe-node</code> to version <code className="font-mono text-xs text-[#D97757] font-bold">14.1.2</code> and regenerate the deterministic lockfile with strict semantic versioning resolution flags to maintain node20 LTS parity.
                </p>
              </div>

              {/* Quick Action Bar */}
              <div className="flex items-center justify-between flex-wrap gap-space-sm pt-space-xs">
                <div className="flex items-center gap-space-xs flex-wrap">
                  <button
                    onClick={() => alert('Patch deployed to ephemeral staging namespace: staging-payment-pr184')}
                    className="px-4 py-2 rounded-lg bg-white hover:bg-[#F2EDE6] border border-[#E5DED6] text-[#2D2926] font-body-sm text-xs flex items-center gap-1.5 transition-all shadow-sm font-semibold"
                  >
                    <span className="material-symbols-outlined text-base text-[#D97757]">rocket_launch</span>
                    <span>Apply Fix to Staging</span>
                  </button>
                  <a
                    href="#unified-diff"
                    className="px-4 py-2 rounded-lg bg-white hover:bg-[#F2EDE6] border border-[#E5DED6] text-[#2D2926] font-body-sm text-xs flex items-center gap-1.5 transition-all shadow-sm font-semibold"
                  >
                    <span className="material-symbols-outlined text-base text-[#D97757]">difference</span>
                    <span>Review Unified Diff</span>
                  </a>
                </div>
                <span className="font-label-code-sm text-xs text-[#6B625B]">Synthesized in 14.8s</span>
              </div>
            </div>
          </section>

          {/* 2. Error Logs Monospace Glass Terminal */}
          <section className="rounded-xl bg-white border border-[#E5DED6] shadow-card overflow-hidden flex flex-col">
            <div className="px-space-md py-2.5 bg-[#F2EDE6] border-b border-[#E5DED6] flex items-center justify-between gap-space-md">
              <div className="flex items-center gap-space-md">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#C34A4A]/50"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#B87A36]/50"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#5B7C4B]/50"></div>
                </div>
                <div className="flex items-center gap-1 text-[#6B625B] font-mono text-xs">
                  <span className="material-symbols-outlined text-sm">terminal</span>
                  <span>build-ci.us-east-1.internal // stdout</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter logs (e.g. ERESOLVE)..."
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  className="h-7 px-2.5 rounded bg-white border border-[#E5DED6] text-xs font-mono placeholder:text-[#6B625B] focus:outline-none focus:border-[#D97757]"
                />
                <button
                  onClick={handleCopyLogs}
                  title="Copy Raw Logs"
                  className="p-1 rounded hover:bg-white text-[#6B625B] hover:text-[#2D2926] transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">
                    {copied ? 'check' : 'content_copy'}
                  </span>
                </button>
              </div>
            </div>

            <div className="p-space-md bg-[#201B18] font-mono text-xs max-h-72 overflow-y-auto space-y-1.5">
              {filteredLogs.map((log) => (
                <div
                  key={log.line}
                  className={`flex items-start gap-2.5 px-2 py-1 rounded ${
                    log.type === 'error'
                      ? 'bg-[#ba1a1a]/20 text-[#fca5a5] border-l-2 border-[#ba1a1a]'
                      : log.type === 'agent'
                      ? 'bg-[#D97757]/20 text-[#fed7aa] border-l-2 border-[#D97757]'
                      : 'text-[#D1C7BD]'
                  }`}
                >
                  <span className="text-[#8F857D] select-none">{log.line}</span>
                  <span className="text-[#D97757]">{log.time}</span>
                  <span>{log.text}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Proposed Fix & Unified Code Diff */}
          <section id="unified-diff" className="rounded-xl bg-white border border-[#E5DED6] shadow-card overflow-hidden">
            <div className="p-space-md bg-[#F2EDE6]/80 border-b border-[#E5DED6] flex items-center justify-between flex-wrap gap-space-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-[#D97757]">difference</span>
                  <span className="font-headline-sm font-semibold text-[#2D2926]">Pull Request #184 Diff</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-white border border-[#E5DED6] text-[#2D2926]">
                    package.json
                  </span>
                </div>
                <p className="font-body-sm text-xs text-[#6B625B] mt-0.5">
                  fix(deps): resolve stripe-node peer dependency conflict in payment-service
                </p>
              </div>

              <a
                href="#"
                onClick={(e) => { e.preventDefault(); alert('Pull Request #184 opened in GitHub tab.'); }}
                className="px-3 py-1.5 rounded bg-white hover:bg-[#F2EDE6] border border-[#E5DED6] text-[#2D2926] font-body-sm text-xs flex items-center gap-1 font-semibold transition-colors"
              >
                <span className="material-symbols-outlined text-sm text-[#D97757]">open_in_new</span>
                <span>Open in GitHub</span>
              </a>
            </div>

            {/* Code diff container */}
            <div className="p-space-md bg-[#201B18] font-mono text-xs overflow-x-auto space-y-1">
              <div className="text-[#8F857D] py-1 border-b border-[#3E3835]">
                @@ -28,7 +28,7 @@ "dependencies": &#123;
              </div>
              <div className="text-[#D1C7BD] pl-4">
                &nbsp;&nbsp;"@fastify/sensible": "^5.2.0",
              </div>
              <div className="bg-[#ba1a1a]/30 text-[#fca5a5] px-2 py-0.5 rounded flex items-center gap-2">
                <span>-</span>
                <span>&nbsp;&nbsp;"@stripe/stripe-node": "^12.1.0",</span>
              </div>
              <div className="bg-[#15803d]/30 text-[#86efac] px-2 py-0.5 rounded flex items-center gap-2">
                <span>+</span>
                <span>&nbsp;&nbsp;"@stripe/stripe-node": "^14.1.2",</span>
              </div>
              <div className="text-[#D1C7BD] pl-4">
                &nbsp;&nbsp;"dotenv": "^16.3.1",
              </div>
              <div className="text-[#D1C7BD] pl-4">
                &nbsp;&nbsp;"fastify": "^4.26.1"
              </div>
            </div>

            {/* Validation checks footer */}
            <div className="p-space-md border-t border-[#E5DED6] space-y-space-md">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
                <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
                  <div className="flex items-center justify-between text-xs text-[#6B625B]">
                    <span className="font-semibold">Automated Checks</span>
                    <span className="material-symbols-outlined text-[#5B7C4B] text-base">check_circle</span>
                  </div>
                  <div className="text-base font-bold text-[#2D2926] mt-1">14 / 14 Passed</div>
                  <div className="text-[11px] text-[#5B7C4B] font-semibold">All workflows green (48s)</div>
                </div>

                <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
                  <div className="flex items-center justify-between text-xs text-[#6B625B]">
                    <span className="font-semibold">Test Suite Coverage</span>
                    <span className="material-symbols-outlined text-[#D97757] text-base">fact_check</span>
                  </div>
                  <div className="text-base font-bold text-[#2D2926] mt-1">440 Tests Run</div>
                  <div className="text-[11px] text-[#6B625B]">412 unit · 28 integration</div>
                </div>

                <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6]">
                  <div className="flex items-center justify-between text-xs text-[#6B625B]">
                    <span className="font-semibold">Security Gates</span>
                    <span className="material-symbols-outlined text-[#6B625B] text-base">shield</span>
                  </div>
                  <div className="text-base font-bold text-[#2D2926] mt-1">0 Vulnerabilities</div>
                  <div className="text-[11px] text-[#6B625B]">Trivy · Snyk · SonarQube [A]</div>
                </div>
              </div>

              {/* Bottom merge action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pt-2 border-t border-[#E5DED6]">
                <div className="flex items-center gap-2 text-xs text-[#6B625B]">
                  <span className="h-2 w-2 rounded-full bg-[#D97757] animate-pulse"></span>
                  <span>Self-merge window unlocks in <strong className="text-[#2D2926]">12m 46s</strong> or approve now:</span>
                </div>
                <button
                  disabled={merged || selectedIncident.status === 'Resolved'}
                  onClick={() => handleStatusChange('Resolved')}
                  className={`px-5 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                    merged || selectedIncident.status === 'Resolved'
                      ? 'bg-[#5B7C4B] text-white cursor-default'
                      : 'bg-[#D97757] hover:bg-[#B85D3E] text-white shadow-[#D97757]/20'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">
                    {merged || selectedIncident.status === 'Resolved' ? 'task_alt' : 'done_all'}
                  </span>
                  <span>{merged || selectedIncident.status === 'Resolved' ? 'Resolved in Flask API' : 'Approve Fix & Merge PR'}</span>
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Autonomous Execution Trail (4 cols) */}
        <div className="lg:col-span-4 space-y-space-lg">
          <section className="rounded-xl bg-white border border-[#E5DED6] shadow-card overflow-hidden flex flex-col">
            <div className="p-space-md bg-[#F2EDE6]/80 border-b border-[#E5DED6] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#D97757] text-lg">timeline</span>
                <span className="font-headline-sm font-semibold text-[#2D2926]">Execution Trail</span>
              </div>
              <span className="font-label-code-sm text-xs text-[#99462A] bg-[#F9ECE7] border border-[#D97757]/30 px-2 py-0.5 rounded font-semibold">
                Live Loop
              </span>
            </div>

            <div className="p-space-md">
              <div className="relative pl-6 space-y-5">
                {/* Vertical connecting line */}
                <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-[#E5DED6]"></div>

                {/* Trail Steps */}
                <div className="relative flex items-start gap-3">
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#FDF0F0] border border-[#C34A4A]/40 text-[#C34A4A] flex items-center justify-center">
                    <span className="material-symbols-outlined text-xs">close</span>
                  </div>
                  <div className="text-xs">
                    <div className="flex items-center gap-1 text-[#6B625B]">
                      <span className="font-mono">14:22:05</span> · <span className="font-semibold text-[#2D2926]">Failure detected</span>
                    </div>
                    <p className="text-[#6B625B] mt-0.5">GitHub Actions CI pipeline failed with exit code 1</p>
                  </div>
                </div>

                <div className="relative flex items-start gap-3">
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#D97757] text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-xs">check</span>
                  </div>
                  <div className="text-xs">
                    <div className="flex items-center gap-1 text-[#6B625B]">
                      <span className="font-mono">14:22:08</span> · <span className="font-semibold text-[#2D2926]">AST analysis</span>
                    </div>
                    <p className="text-[#6B625B] mt-0.5">Captured stack trace fingerprint HASH_9a7d</p>
                  </div>
                </div>

                <div className="relative flex items-start gap-3">
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#D97757] text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-xs">check</span>
                  </div>
                  <div className="text-xs">
                    <div className="flex items-center gap-1 text-[#6B625B]">
                      <span className="font-mono">14:22:15</span> · <span className="font-semibold text-[#2D2926]">Conflict isolated</span>
                    </div>
                    <p className="text-[#6B625B] mt-0.5">Identified @stripe/stripe-node peer dependency constraint</p>
                  </div>
                </div>

                <div className="relative flex items-start gap-3">
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#D97757] text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-xs">check</span>
                  </div>
                  <div className="text-xs">
                    <div className="flex items-center gap-1 text-[#6B625B]">
                      <span className="font-mono">14:22:28</span> · <span className="font-semibold text-[#2D2926]">Synthesized patch</span>
                    </div>
                    <p className="text-[#6B625B] mt-0.5">Updated package.json and resolved lockfile</p>
                  </div>
                </div>

                <div className="relative flex items-start gap-3">
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#D97757] text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-xs">check</span>
                  </div>
                  <div className="text-xs">
                    <div className="flex items-center gap-1 text-[#6B625B]">
                      <span className="font-mono">14:23:01</span> · <span className="font-semibold text-[#2D2926]">Sandbox verification</span>
                    </div>
                    <p className="text-[#6B625B] mt-0.5">Ephemeral k8s runner passed 440/440 tests</p>
                  </div>
                </div>

                <div className="relative flex items-start gap-3">
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#5B7C4B] text-white flex items-center justify-center shadow-xs animate-pulse">
                    <span className="material-symbols-outlined text-xs">done_all</span>
                  </div>
                  <div className="text-xs">
                    <div className="flex items-center gap-1 text-[#6B625B]">
                      <span className="font-mono">14:24:19</span> · <span className="font-semibold text-[#2D2926]">PR #184 Opened</span>
                    </div>
                    <p className="text-[#6B625B] mt-0.5">Assigned reviewers: @platform-lead, auto-merge enabled</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* AI Knowledge Base Context Card */}
          <section className="rounded-xl bg-white border border-[#E5DED6] p-space-md shadow-card space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#6B625B]">
              <span className="material-symbols-outlined text-[#D97757] text-base">auto_stories</span>
              <span>KNOWLEDGE REPOSITORIES ACCESSED</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="p-2 rounded bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between">
                <span className="text-[#2D2926] font-mono">npm-resolution-recipes.db</span>
                <span className="text-[#99462A] font-semibold">99% match</span>
              </div>
              <div className="p-2 rounded bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between">
                <span className="text-[#2D2926] font-mono">stripe-migration-v14.md</span>
                <span className="text-[#99462A] font-semibold">Verified</span>
              </div>
              <div className="p-2 rounded bg-[#FAF7F3] border border-[#E5DED6] flex items-center justify-between">
                <span className="text-[#2D2926] font-mono">service-catalog/payment-service</span>
                <span className="text-[#99462A] font-semibold">Policy checked</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* AI Explanation Modal */}
      {showExplainModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E5DED6] shadow-2xl max-w-lg w-full p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-[#E5DED6] pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D97757] text-2xl">psychology</span>
                <h3 className="font-headline-sm font-bold text-lg text-[#2D2926]">
                  AI Diagnostics: {selectedIncident.id}
                </h3>
              </div>
              <button
                onClick={() => setShowExplainModal(false)}
                className="text-[#6B625B] hover:text-[#2D2926] p-1 rounded cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {isLoadingExplanation ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3 text-[#6B625B]">
                <span className="material-symbols-outlined text-3xl text-[#D97757] animate-spin">sync</span>
                <span className="font-label-code-sm text-xs">Querying SentinelOps AI Diagnostics API...</span>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-[#2D2926] leading-relaxed">
                <div className="p-3 rounded-lg bg-[#FAF7F3] border border-[#E5DED6] space-y-1">
                  <div className="font-bold text-[#99462A] uppercase tracking-wider text-[11px]">
                    Algorithmic Root Cause ({explanationData?.confidence ?? selectedIncident.confidence}% confidence)
                  </div>
                  <div className="font-medium text-[#2D2926]">{explanationData?.rootCause || selectedIncident.rootCause}</div>
                </div>

                <p className="text-sm text-[#6B625B] leading-relaxed">
                  {explanationData?.explanation || (
                    <>
                      When <code className="font-mono text-xs bg-[#F2EDE6] px-1 py-0.5 rounded">npm test</code> ran on the {selectedIncident.repo} repository, npm resolved the dependency graph and discovered conflicting peer constraints.
                    </>
                  )}
                </p>

                {explanationData?.suggestedAction && (
                  <div className="p-2.5 rounded-lg bg-[#F9ECE7] border border-[#D97757]/30 text-[#99462A] font-medium">
                    <strong>Suggested Action:</strong> {explanationData.suggestedAction}
                  </div>
                )}

                {explanationData?.policyCheck && (
                  <div className="flex items-center gap-1.5 text-[11px] text-[#5B7C4B] font-semibold">
                    <span className="material-symbols-outlined text-sm">verified_user</span>
                    <span>{explanationData.policyCheck}</span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowExplainModal(false)}
                className="px-4 py-2 rounded-lg bg-[#D97757] text-white text-xs font-semibold hover:bg-[#B85D3E] transition-all cursor-pointer shadow-sm"
              >
                Close Diagnostics
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
