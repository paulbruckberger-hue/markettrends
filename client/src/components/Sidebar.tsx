import { NavLink } from 'react-router-dom';
import { Eye, LogOut, Newspaper, Radar } from 'lucide-react';
import { useMe, useLogout } from '../hooks/useAuth';

const linkBase =
  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition';

export default function Sidebar() {
  const { data: me } = useMe();
  const logout = useLogout();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-900 p-4">
      <div className="mb-8 flex items-center gap-2 px-1">
        <Radar className="text-accent-400" size={22} />
        <div>
          <div className="text-sm font-bold leading-tight text-slate-100">Markttrends</div>
          <div className="text-xs text-slate-500">Scouting</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        <NavLink
          to="/feed"
          className={({ isActive }) =>
            `${linkBase} ${isActive ? 'bg-accent-600/20 text-accent-300' : 'text-slate-300 hover:bg-ink-800'}`
          }
        >
          <Newspaper size={18} /> Feed
        </NavLink>
        <NavLink
          to="/watchlist"
          className={({ isActive }) =>
            `${linkBase} ${isActive ? 'bg-accent-600/20 text-accent-300' : 'text-slate-300 hover:bg-ink-800'}`
          }
        >
          <Eye size={18} /> Beobachtungen
        </NavLink>
      </nav>

      <div className="mt-auto border-t border-ink-800 pt-4">
        <div className="mb-2 px-1 text-xs text-slate-500">
          Angemeldet als <span className="font-semibold text-slate-300">{me?.username ?? '…'}</span>
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
