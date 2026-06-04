import { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { isLoggedIn, useMe } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FeedPage from './pages/FeedPage';
import WatchListPage from './pages/WatchListPage';
import IntelligencePage from './pages/IntelligencePage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';

function Protected({ children }: { children: ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  if (me && me.role !== 'admin') return <Navigate to="/feed" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/feed" element={<Protected><FeedPage /></Protected>} />
      <Route path="/watchlist" element={<Protected><WatchListPage /></Protected>} />
      <Route path="/intelligence" element={<Protected><IntelligencePage /></Protected>} />
      <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
      <Route path="/admin" element={<AdminOnly><AdminPage /></AdminOnly>} />
      <Route path="*" element={<Navigate to={isLoggedIn() ? '/feed' : '/login'} replace />} />
    </Routes>
  );
}
