import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

interface LayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function Layout({ title, subtitle, actions, children }: LayoutProps) {
  return (
    <div className="flex min-h-screen h-full bg-ink-950">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex md:w-60 md:shrink-0">
        <Sidebar />
      </div>

      {/* Content column */}
      <div className="flex flex-col flex-1 min-h-screen overflow-x-hidden">
        {/* Sticky top header */}
        <header className="sticky top-0 z-20 border-b border-ink-800 bg-ink-950/90 backdrop-blur px-4 md:px-8 py-3 md:py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-slate-100 leading-tight truncate">{title}</h1>
              {subtitle && <p className="mt-0.5 text-xs md:text-sm text-slate-400 leading-snug line-clamp-1">{subtitle}</p>}
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
          </div>
        </header>

        {/* Scrollable content — extra bottom padding on mobile for bottom nav */}
        <main className="flex-1 px-4 md:px-8 py-4 md:py-6 pb-24 md:pb-6 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav — hidden on desktop */}
      <BottomNav />
    </div>
  );
}
