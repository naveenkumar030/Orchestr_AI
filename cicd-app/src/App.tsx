import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BackendProvider } from './context/BackendContext';
import AppLayout from './components/layout/AppLayout';
import LandingPage from './pages/LandingPage';
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
    <BackendProvider>
      <HashRouter>

      <Routes>
        {/* Public Product Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Operations Console & Internal App Routes */}
        <Route
          path="/dashboard"
          element={
            <AppLayout>
              <OverviewPage />
            </AppLayout>
          }
        />
        <Route
          path="/pipelines"
          element={
            <AppLayout>
              <PipelinesPage />
            </AppLayout>
          }
        />
        <Route
          path="/incidents"
          element={
            <AppLayout>
              <IncidentsPage />
            </AppLayout>
          }
        />
        <Route
          path="/ai-agents"
          element={
            <AppLayout>
              <AIAgentsPage />
            </AppLayout>
          }
        />
        <Route
          path="/pull-requests"
          element={
            <AppLayout>
              <PullRequestsPage />
            </AppLayout>
          }
        />
        <Route
          path="/logs"
          element={
            <AppLayout>
              <LogsPage />
            </AppLayout>
          }
        />
        <Route
          path="/analytics"
          element={
            <AppLayout>
              <AnalyticsPage />
            </AppLayout>
          }
        />
        <Route
          path="/settings"
          element={
            <AppLayout>
              <SettingsPage />
            </AppLayout>
          }
        />
        <Route
          path="/profile"
          element={
            <AppLayout>
              <ProfilePage />
            </AppLayout>
          }
        />

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  </BackendProvider>
  );
}


