import { NavLink } from 'react-router-dom';
import { BarChart3, Eye, LineChart, Newspaper, Settings, ShieldCheck } from 'lucide-react';
import { useMe } from '../hooks/useAuth';

const BASE_ITEMS = [
  { to: '/feed',        icon: Newspaper,  label: 'Feed'          },
  { to: '/watchlist',   icon: Eye,        label: 'Beobachten'    },
  { to: '/dashboard',   icon: BarChart3,  label: 'Dashboard'     },
  { to: '/intelligence',icon: LineChart,  label: 'Intelligence'  },
  { to: '/settings',    icon: Settings,   label: 'Einstellungen' },
];

export default function BottomNav() {
  const { data: me } = useMe();
  const items = me?.role === 'admin'
    ? [...BASE_ITEMS, { to: '/admin', icon: ShieldCheck, label: 'Admin' }]
    : BASE_ITEMS;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-ink-900/95 backdrop-blur border-t border-ink-800 safe-area-pb">
      <div className="flex">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 px-1 text-[10px] font-medium transition-colors ${
                isActive
                  ? to === '/admin' ? 'text-amber-400' : 'text-accent-400'
                  : to === '/admin' ? 'text-amber-600/70 hover:text-amber-400' : 'text-slate-500 hover:text-slate-300'
              }`
            }
          >
            <Icon size={20} strokeWidth={1.8} />
            <span className="leading-none">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
