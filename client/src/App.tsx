import { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { isLoggedIn, useMe } from './hooks/useAuth';
import { useMediaQuery } from './lib/useMediaQuery';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LandingPage from './pages/LandingPage';
import HowItWorksPage from './pages/HowItWorksPage';
import FeaturesPage from './pages/FeaturesPage';
import PricingPage from './pages/PricingPage';
import AcceptInvitePage from './pages/AcceptInvitePage';
import MagicPage from './pages/MagicPage';
import AdminPage from './pages/AdminPage';
import AppShell from './AppShell';
import DesktopShell from './desktop/DesktopShell';

/** Wide viewports get the 3-column desktop shell. */
function ResponsiveShell() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  return isDesktop ? <DesktopShell /> : <AppShell />;
}

/** App-internal pages require login; non-logged-in users go to /login. */
function Protected({ children }: { children: ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />;
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
      {/* ── Public marketing pages ── */}
      <Route path="/" element={isLoggedIn() ? <Navigate to="/feed" replace /> : <LandingPage />} />
      <Route path="/how-it-works" element={<HowItWorksPage />} />
      <Route path="/features" element={<FeaturesPage />} />
      <Route path="/pricing" element={<PricingPage />} />

      {/* ── Auth ── */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route path="/magic" element={<MagicPage />} />

      {/* ── Admin ── */}
      <Route path="/admin" element={<AdminOnly><AdminPage /></AdminOnly>} />

      {/* ── Protected app ── */}
      <Route path="*" element={<Protected><ResponsiveShell /></Protected>} />
    </Routes>
  );
}
