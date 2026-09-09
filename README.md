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

- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Dev Server**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Design System**: Tailored Warm Cream & Dark Modern Enterprise Glassmorphism UI

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or pnpm or yarn

### Installation & Run

1. **Clone the repository**:
   ```bash
   git clone https://github.com/naveenkumar030/SentinelOps.git
   cd SentinelOps/cicd-app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

4. **Build for production**:
   ```bash
   npm run build
   ```

---

## 📁 Repository Structure

```
SentinelOps/
├── cicd-app/               # React 19 + TypeScript + Vite application
│   ├── src/
│   │   ├── components/     # UI components & layouts (Header, Sidebar, Modals, Cards)
│   │   ├── pages/          # Complete dashboard pages (Overview, Pipelines, Agents, etc.)
│   │   ├── data/           # Mock telemetry, mock incidents, DAG models, agents data
│   │   ├── types/          # TypeScript interface definitions
│   │   └── index.css       # Custom design system tokens & Tailwind utilities
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── README.md               # SentinelOps project documentation
└── .gitignore              # Git ignore rules
```

---

## 🔒 Security & Governance

SentinelOps operates on strict least-privilege principles. Automated agents require signed validation hashes and policy approval before modifying production infrastructure.
