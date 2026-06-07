import { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { isLoggedIn, useMe } from './hooks/useAuth';
import { useMediaQuery } from './lib/useMediaQuery';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import AppShell from './AppShell';
import DesktopShell from './desktop/DesktopShell';

function Protected({ children }: { children: ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />;
}

/** Wide viewports get the 3-column desktop shell; phones/tablets keep the
 *  unchanged mobile shell. The mobile experience is byte-for-byte identical. */
function ResponsiveShell() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  return isDesktop ? <DesktopShell /> : <AppShell />;
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  if (me && me.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin" element={<AdminOnly><AdminPage /></AdminOnly>} />
      <Route path="*" element={<Protected><ResponsiveShell /></Protected>} />
    </Routes>
  );
}
