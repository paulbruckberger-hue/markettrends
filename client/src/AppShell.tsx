import { useMemo, useRef, useState } from 'react';
import { BottomNav, Toast } from './components/ui';
import { useTheme } from './lib/theme';
import { useItemActions } from './hooks/useItemActions';
import { useMe, useLogout } from './hooks/useAuth';
import { useWatchlist } from './hooks/useWatchlist';
import { DisplayItem } from './lib/presenter';

import FeedScreen from './screens/FeedScreen';
import ExploreScreen from './screens/ExploreScreen';
import WatchlistScreen from './screens/WatchlistScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import DetailScreen from './screens/DetailScreen';
import CompetitorScreen from './screens/CompetitorScreen';
import WatchDetailScreen from './screens/WatchDetailScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import ComposeSheet from './screens/ComposeSheet';
import Onboarding from './screens/Onboarding';
import AdminScreen from './screens/AdminScreen';

const TAB_ROUTES = ['feed', 'explore', 'watchlist', 'analytics'];
const ONBOARD_KEY = 'nl_onboarded';
const CARD_KEY = 'nl_card';

interface Entry { name: string; params: Record<string, unknown> }

export default function AppShell() {
  const { theme, setTheme, accent, setAccent } = useTheme();
  const { data: me } = useMe();
  const logout = useLogout();
  const { data: watches } = useWatchlist();

  const [onboarded, setOnboarded] = useState(() => localStorage.getItem(ONBOARD_KEY) === '1');
  const [cardVariant, setCardVariant] = useState(() => localStorage.getItem(CARD_KEY) || 'standard');
  const setVariant = (v: string) => { localStorage.setItem(CARD_KEY, v); setCardVariant(v); };

  const [stack, setStack] = useState<Entry[]>([{ name: 'feed', params: {} }]);
  const current = stack[stack.length - 1];

  const [compose, setCompose] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1900);
  };

  const actions = useItemActions(flash);

  const nav = (name: string, params: Record<string, unknown> = {}) => {
    if (TAB_ROUTES.includes(name)) setStack([{ name, params }]);
    else setStack((s) => [...s, { name, params }]);
  };
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  const unread = useMemo(
    () => (watches ?? []).reduce((sum, w) => sum + (w.unread ?? 0), 0),
    [watches],
  );

  if (!onboarded) {
    return <Onboarding onDone={() => { localStorage.setItem(ONBOARD_KEY, '1'); setOnboarded(true); }} />;
  }

  const openDetail = (item: DisplayItem) => nav('detail', { item });

  const renderScreen = () => {
    switch (current.name) {
      case 'feed':
        return <FeedScreen actions={actions} variant={cardVariant} setVariant={setVariant} onOpen={openDetail} nav={nav} username={me?.username ?? ''} />;
      case 'explore':
        return <ExploreScreen actions={actions} onOpen={openDetail} onCompose={() => setCompose(true)} />;
      case 'watchlist':
        return <WatchlistScreen nav={nav} onCompose={() => setCompose(true)} flash={flash} />;
      case 'analytics':
        return <AnalyticsScreen nav={nav} />;
      case 'detail':
        return <DetailScreen item={current.params.item as DisplayItem} actions={actions} nav={nav} back={back} />;
      case 'competitor':
        return <CompetitorScreen id={current.params.id as string} actions={actions} nav={nav} back={back} onCompose={() => setCompose(true)} />;
      case 'watch':
        return <WatchDetailScreen id={current.params.id as string} actions={actions} nav={nav} back={back} flash={flash} />;
      case 'profile':
        return <ProfileScreen actions={actions} nav={nav} back={back} me={me} />;
      case 'settings':
        return <SettingsScreen theme={theme} setTheme={setTheme} accent={accent} setAccent={setAccent} back={back} me={me} onLogout={logout} nav={nav} />;
      case 'admin':
        return <AdminScreen back={back} />;
      default:
        return null;
    }
  };

  const activeTab = TAB_ROUTES.includes(current.name) ? current.name : '';
  const showBottomNav = !['detail', 'settings', 'admin'].includes(current.name);
  const routeKey = `${current.name}|${(current.params.id as string) ?? (current.params.item as DisplayItem | undefined)?.id ?? ''}`;

  return (
    <div className="app-root">
      <div className="app-scroll" key={routeKey}>
        {renderScreen()}
      </div>
      {showBottomNav && (
        <BottomNav active={activeTab} unread={unread} onNav={(k) => nav(k)} onCompose={() => setCompose(true)} />
      )}
      {compose && <ComposeSheet onClose={() => setCompose(false)} flash={flash} />}
      {toast && <Toast msg={toast} />}
    </div>
  );
}
