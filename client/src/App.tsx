import { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { isLoggedIn } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FeedPage from './pages/FeedPage';
import WatchListPage from './pages/WatchListPage';
import IntelligencePage from './pages/IntelligencePage';

function Protected({ children }: { children: ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/feed" element={<Protected><FeedPage /></Protected>} />
      <Route path="/watchlist" element={<Protected><WatchListPage /></Protected>} />
      <Route path="/intelligence" element={<Protected><IntelligencePage /></Protected>} />
      <Route path="*" element={<Navigate to={isLoggedIn() ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}
