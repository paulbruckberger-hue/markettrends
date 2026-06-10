import { useMemo, useRef, useState } from 'react';
import { BrandMark, BrandWord, UserCircle, Verified } from '../components/ui';
import { Icon, IconName } from '../components/Icon';
import { useTheme } from '../lib/theme';
import { useItemActions } from '../hooks/useItemActions';
import { useLogout, useMe } from '../hooks/useAuth';
import { useWatchlist } from '../hooks/useWatchlist';
import { DisplayItem } from '../lib/presenter';
import { AuthUser } from '../types';
import { ComposeModal } from './deskChrome';
import { RightRail } from './RightRail';
import {
  DeskAdmin, DeskAnalytics, DeskCompetitor, DeskDetail, DeskExplore, DeskFeed,
  DeskProfile, DeskSettings, DeskWatchDetail, DeskWatchlist,
} from './DesktopScreens';

const TAB_ROUTES = ['feed', 'explore', 'watchlist', 'analytics', 'profile', 'settings'];
const CARD_KEY = 'nl_card';

interface Entry { name: string; params: Record<string, unknown> }

function DeskToast({ msg }: { msg: string }) {
  return (
    <div style={{
      position: 'fixed', left: '50%', bottom: 36, transform: 'translateX(-50%)', zIndex: 9000,
      background: 'var(--accent)', color: '#fff', padding: '12px 20px', borderRadius: 999,
      fontWeight: 700, fontSize: 14, boxShadow: '0 8px 28px rgba(0,0,0,0.35)', animation: 'pop .2s', whiteSpace: 'nowrap',
      display: 'inline-flex', alignItems: 'center', gap: 8,
    }}>
      <Icon name="check" size={16} /> {msg}
    </div>
  );
}

function Sidebar({ active, unread, me, onNav, onCompose }: {
  active: string; unread: number; me: AuthUser | undefined; onNav: (k: string) => void; onCompose: () => void;
}) {
  const items: { key: string; icon: IconName; label: string; badge?: number }[] = [
    { key: 'feed', icon: 'home', label: 'Startseite' },
    { key: 'explore', icon: 'search', label: 'Entdecken' },
    { key: 'watchlist', icon: 'watchlist', label: 'Beobachtungen', badge: unread },
    { key: 'analytics', icon: 'analytics', label: 'Analyse' },
    { key: 'profile', icon: 'home', label: 'Profil' },
    { key: 'settings', icon: 'settings', label: 'Einstellungen' },
  ];
  return (
    <div className="dt-sidebar-inner">
      <button className="press" onClick={() => onNav('feed')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px 18px', background: 'none', border: 'none', cursor: 'pointer' }}>
        <BrandMark size={34} />
        <span className="dt-brandword"><BrandWord size={20} /></span>
      </button>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((it) => {
          const on = it.key === active;
          return (
            <button key={it.key} className={'nav-item press' + (on ? ' active' : '')} onClick={() => onNav(it.key)}>
              <span style={{ position: 'relative', display: 'flex' }}>
                {it.key === 'profile'
                  ? <UserCircle name={me?.username ?? '?'} size={26} />
                  : <Icon name={it.icon} size={26} filled={on} />}
                {it.badge != null && it.badge > 0 && (
                  <span style={{ position: 'absolute', top: -3, right: -6, minWidth: 17, height: 17, padding: '0 4px', background: 'var(--accent)', color: '#fff', borderRadius: 999, fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}>{it.badge}</span>
                )}
              </span>
              <span className="lbl">{it.label}</span>
            </button>
          );
        })}
      </nav>

      <button className="dt-compose pill pill-accent press" onClick={onCompose} style={{
        marginTop: 18, height: 52, fontSize: 16.5, borderRadius: 999, width: '100%',
        boxShadow: '0 6px 18px color-mix(in srgb, var(--accent) 35%, transparent)',
      }}>
        <Icon name="plus" size={22} />
        <span className="dt-compose-lbl">Neue Beobachtung</span>
      </button>

      <div style={{ flex: 1 }} />

      <button className="press" onClick={() => onNav('profile')} style={{
        display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 999,
        background: 'transparent', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
      }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <UserCircle name={me?.username ?? '?'} size={40} />
        <div className="dt-profilemeta" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontWeight: 800, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{me?.username ?? 'Konto'}</span>
            <Verified size={14} />
          </div>
          <div style={{ color: 'var(--text-3)', fontSize: 13 }}>{me?.role === 'admin' ? 'Administrator' : 'Pro'}</div>
        </div>
        <span className="dt-profilemeta" style={{ color: 'var(--text-3)' }}><Icon name="more" size={18} /></span>
      </button>
    </div>
  );
}

export default function DesktopShell() {
  const { theme, setTheme, accent, setAccent } = useTheme();
  const { data: me } = useMe();
  const logout = useLogout();
  const { data: watches } = useWatchlist();

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

  const scrollTop = () => setTimeout(() => { document.querySelectorAll('.dt-scroll').forEach((el) => { el.scrollTop = 0; }); }, 0);
  const nav = (name: string, params: Record<string, unknown> = {}) => {
    if (TAB_ROUTES.includes(name)) setStack([{ name, params }]);
    else setStack((s) => [...s, { name, params }]);
    scrollTop();
  };
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  const unread = useMemo(() => (watches ?? []).reduce((sum, w) => sum + (w.unread ?? 0), 0), [watches]);

  const activeTab = TAB_ROUTES.includes(current.name) ? current.name
    : current.name === 'detail' ? 'feed'
      : (current.name === 'competitor' || current.name === 'watch') ? 'watchlist'
        : current.name === 'admin' ? 'settings' : '';

  const center = (() => {
    switch (current.name) {
      case 'feed': return <DeskFeed actions={actions} variant={cardVariant} setVariant={setVariant} nav={nav} />;
      case 'explore': return <DeskExplore actions={actions} nav={nav} onCompose={() => setCompose(true)} flash={flash} />;
      case 'watchlist': return <DeskWatchlist nav={nav} onCompose={() => setCompose(true)} flash={flash} />;
      case 'analytics': return <DeskAnalytics nav={nav} />;
      case 'detail': return <DeskDetail item={current.params.item as DisplayItem} actions={actions} nav={nav} back={back} />;
      case 'competitor': return <DeskCompetitor id={current.params.id as string} actions={actions} nav={nav} back={back} onCompose={() => setCompose(true)} flash={flash} />;
      case 'watch': return <DeskWatchDetail id={current.params.id as string} actions={actions} nav={nav} back={back} flash={flash} />;
      case 'profile': return <DeskProfile actions={actions} nav={nav} me={me} />;
      case 'settings': return <DeskSettings theme={theme} setTheme={setTheme} accent={accent} setAccent={setAccent} me={me} onLogout={logout} nav={nav} />;
      case 'admin': return <DeskAdmin back={back} />;
      default: return null;
    }
  })();

  return (
    <div className="dt-app">
      <div className="dt-shell">
        <aside className="dt-sidebar">
          <Sidebar active={activeTab} unread={unread} me={me} onNav={nav} onCompose={() => setCompose(true)} />
        </aside>
        <main className="dt-center">{center}</main>
        <aside className="dt-rail thin-scroll">
          <RightRail route={current.name} params={current.params} nav={nav} onCompose={() => setCompose(true)} />
        </aside>
      </div>
      {compose && <ComposeModal onClose={() => setCompose(false)} flash={flash} />}
      {toast && <DeskToast msg={toast} />}
    </div>
  );
}
