import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import OverviewPage from './pages/OverviewPage';
import PipelinesPage from './pages/PipelinesPage';
import IncidentsPage from './pages/IncidentsPage';
import AIAgentsPage from './pages/AIAgentsPage';
import PullRequestsPage from './pages/PullRequestsPage';
import LogsPage from './pages/LogsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/pipelines" element={<PipelinesPage />} />
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/ai-agents" element={<AIAgentsPage />} />
          <Route path="/pull-requests" element={<PullRequestsPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
