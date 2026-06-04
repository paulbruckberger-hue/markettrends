import { NavLink } from 'react-router-dom';
import { BarChart3, Eye, LineChart, LogOut, Newspaper, Radar, Settings, ShieldCheck } from 'lucide-react';
import { useMe, useLogout } from '../hooks/useAuth';

const NAV_ITEMS = [
  { to: '/feed',         icon: Newspaper,  label: 'Feed'          },
  { to: '/watchlist',    icon: Eye,        label: 'Beobachtungen' },
  { to: '/dashboard',    icon: BarChart3,  label: 'Dashboard'     },
  { to: '/intelligence', icon: LineChart,  label: 'Intelligence'  },
  { to: '/settings',     icon: Settings,   label: 'Einstellungen' },
];

const linkBase = 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition';

export default function Sidebar() {
  const { data: me } = useMe();
  const logout = useLogout();
  const isAdmin = me?.role === 'admin';

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-900 h-screen sticky top-0 p-4 overflow-y-auto">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2 px-1">
        <Radar className="text-accent-400 shrink-0" size={22} />
        <div>
          <div className="text-sm font-bold leading-tight text-slate-100">Markttrends</div>
          <div className="text-xs text-slate-500">Scouting</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `${linkBase} ${isActive ? 'bg-accent-600/20 text-accent-300' : 'text-slate-300 hover:bg-ink-800'}`
            }
          >
            <Icon size={18} /> {label}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? 'bg-amber-600/20 text-amber-300' : 'text-amber-500/70 hover:bg-ink-800 hover:text-amber-400'}`
            }
          >
            <ShieldCheck size={18} /> Admin
          </NavLink>
        )}
      </nav>

      {/* User + Logout */}
      <div className="mt-auto border-t border-ink-800 pt-4">
        <div className="mb-2 px-1 text-xs text-slate-500">
          Angemeldet als <span className="font-semibold text-slate-300">{me?.username ?? '…'}</span>
          {isAdmin && <span className="ml-1 text-amber-500/70">(admin)</span>}
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-ink-800 hover:text-slate-200"
        >
          <LogOut size={16} /> Abmelden
        </button>
      </div>
    </aside>
  );
}
