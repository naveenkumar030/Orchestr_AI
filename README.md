# SentinelOps 🛡️⚡
> **Autonomous DevOps & Self-Healing CI/CD Platform**

SentinelOps is an AI-native DevOps orchestration platform designed to automate pipeline execution, real-time observability, autonomous incident remediation, multi-agent fleet operations, and intelligent code reviews.

---

## 🌟 Key Features

### 1. 🎛️ Autonomous Control Center
- Centralized mission-control dashboard displaying live system status, pipeline throughput, MTTR, active agent status, and active incidents.
- Interactive alerts, quick-action triggers, and live telemetry feeds.

### 2. 🔀 Directed Acyclic Graph (DAG) Pipelines
- Visual workflow engine modeling complex dependency graphs for build, test, security analysis, canary evaluation, and production deployment.
- Real-time step status tracking, dynamic execution logs, and granular stage controls.

### 3. 🤖 AI Fleet Orchestration
- Multi-agent autonomous workforce:
  - **Sentinel-Core**: Autonomous pipeline orchestrator and policy enforcer.
  - **Healer-Alpha**: Real-time triage, root-cause analysis, and patch synthesis.
  - **TestForge**: Dynamic test suite generation and regression verification.
  - **CanaryGuard**: Automated progressive delivery monitor and zero-downtime rollback controller.
- Live resource monitoring, health scores, task distribution, and throughput analytics.

### 4. 🚨 Autonomous Incident Remediation (e.g. INC-8924)
- Instant AI detection and triage of production anomalies.
- Automated generation of candidate diffs, sandbox regression testing, and rollback safety validation.
- One-click approval workflows with human-in-the-loop safety switches.

### 5. 🔍 Real-Time Observability & Streaming Logs
- ANSI-compatible streaming log viewer with multi-agent tagging, severity filters, and sub-second search.
- AI log summarization to pinpoint exact stack traces and error cascades instantly.

### 6. 🐙 AI Pull Request Reviews & Security Scans
- Automated analysis of PRs for performance bottlenecks, security vulnerabilities, and code maintainability.
- Inline suggested fixes and AI confidence scoring.

### 7. 📊 DORA & Velocity Analytics
- DORA metrics tracking: Deployment Frequency, Lead Time for Changes, Change Failure Rate, and Mean Time to Recovery (MTTR).
- AI velocity impact tracking and cost-efficiency graphs.

### 8. ⚙️ Autopilot Policies & Governance
- Granular configuration of autonomous intervention rules, confidence thresholds, and canary rollout percentages.
- Human-in-the-loop verification requirements for sensitive environments.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Backend API**: [Python 3.13+](https://www.python.org/) + [Flask 3.1](https://flask.palletsprojects.com/) + [flask-cors](https://flask-cors.readthedocs.io/)
- **Bundler & Dev Server**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Design System**: Tailored Warm Cream & Dark Modern Enterprise UI

---

## 🚀 Quick Start & Running Options

### Prerequisites
- Python 3.10+ (Python 3.13 recommended)
- Node.js (v18+) & npm

---

### Option A: Unified Server (Recommended)
Single command starts Python Flask hosting both the REST API and the compiled React UI:

```bash
# Windows One-Click:
start_backend.bat

# Or via Python CLI:
python run_backend.py --open
```
- **Web UI & App**: [http://127.0.0.1:5000](http://127.0.0.1:5000)
- **API Health Check**: [http://127.0.0.1:5000/api/health](http://127.0.0.1:5000/api/health)
- **API Overview**: [http://127.0.0.1:5000/api/overview](http://127.0.0.1:5000/api/overview)

---

### Option B: Full-Stack Dev Server (Hot-Reload)
Run Flask backend and Vite dev server simultaneously with automatic proxy:

1. **Start Python Flask Backend**:
   ```bash
   python backend/app.py
   ```
   Backend listens on `http://127.0.0.1:5000`.

2. **Start Vite Dev Server**:
   ```bash
   cd cicd-app
   npm install
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173). Vite automatically proxies all `/api/*` requests to the Flask backend.

---

### 🧪 Automated Backend Test Suite
Run the comprehensive test suite verifying all 8 REST endpoints, data mutations, and schemas:

```bash
python backend/test_api.py
```

---

## 📁 Repository Structure

```
SentinelOps/
├── backend/                # Python Flask REST API & Data Store
│   ├── app.py              # Flask server, routes, CORS & SPA fallback
│   ├── data_store.py       # Enterprise in-memory state store with mutations
│   ├── test_api.py         # Automated integration test runner (36 assertions)
│   └── requirements.txt    # Python dependencies (Flask, flask-cors)
├── cicd-app/               # React 19 + TypeScript + Vite application
│   ├── src/
│   │   ├── components/     # UI components & layouts (Header, Sidebar, Modals)
│   │   ├── context/        # BackendContext (Health & latency polling)
│   │   ├── pages/          # Complete dashboard pages (Overview, Pipelines, Agents, etc.)
│   │   ├── services/       # api.ts (REST API client with fallback)
│   │   ├── types/          # TypeScript interface definitions
│   │   └── index.css       # Custom design system tokens
│   ├── package.json
│   ├── vite.config.ts      # Dev server with /api proxy to :5000
│   └── tailwind.config.js
├── run_backend.py          # Unified Python launcher (builds UI & starts Flask)
├── start_backend.bat       # Windows one-click desktop launcher
└── README.md
```

---

## 🔒 Security & Governance

SentinelOps operates on strict least-privilege principles. Automated agents require signed validation hashes and policy approval before modifying production infrastructure.
