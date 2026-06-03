import { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { isLoggedIn } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import FeedPage from './pages/FeedPage';
import WatchListPage from './pages/WatchListPage';

function Protected({ children }: { children: ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/feed" element={<Protected><FeedPage /></Protected>} />
      <Route path="/watchlist" element={<Protected><WatchListPage /></Protected>} />
      <Route path="*" element={<Navigate to={isLoggedIn() ? '/feed' : '/login'} replace />} />
    </Routes>
  );
}
