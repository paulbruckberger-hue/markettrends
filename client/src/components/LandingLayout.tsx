import { CSSProperties, ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useRegister } from '../hooks/useAuth';
import { apiError } from '../lib/api';
import { useTheme } from '../lib/theme';
import { BrandGlyph } from './ui';

/* ── shared hook ── */
export function useScrolled(threshold = 8): boolean {
  const [s, setS] = useState(false);
  useEffect(() => {
    const fn = () => setS(window.scrollY > threshold);
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, [threshold]);
  return s;
}

/* ── Reveal on scroll ── */
export function Reveal({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { el.classList.add('in'); io.unobserve(el); } }),
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className="lp-reveal" style={{ transitionDelay: `${delay}ms`, ...style }}>{children}</div>;
}

/* ── Animated counter ── */
export function Stat({ to, suffix = '', label }: { to: number; suffix?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const dur = 1400;
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / dur);
        setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  return (
    <div className="lp-stat" ref={ref}>
      <div className="lp-stat-num">{n.toLocaleString('de-AT')}{suffix}</div>
      <div className="lp-stat-lbl">{label}</div>
    </div>
  );
}

/* ── Signup form (re-exported so each page can embed it) ── */
export function SignupCard({ compact = false }: { compact?: boolean }) {
  const register = useRegister();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register.mutateAsync({ email: email.trim(), password });
      navigate('/');
    } catch { /* shown below */ }
  };

  return (
    <form onSubmit={onSubmit} className="lp-signup" style={compact ? { maxWidth: 440, margin: '0 auto' } : undefined}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        <input className="lp-field" type="email" required placeholder="Deine E-Mail-Adresse"
          autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="lp-field" type="password" required placeholder="Passwort (min. 6 Zeichen)"
          autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {register.isError && <div className="lp-err">{apiError(register.error, 'Registrierung fehlgeschlagen')}</div>}
        <button type="submit" className="lp-btn lp-btn-primary" disabled={register.isPending}
          style={{ width: '100%', padding: '14px 0', fontSize: 15.5, opacity: register.isPending ? 0.6 : 1 }}>
          {register.isPending ? 'Konto wird erstellt …' : 'Kostenlos starten →'}
        </button>
      </div>
      <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: 'var(--ink-3)' }}>
        Schon ein Konto?{' '}
        <Link to="/login" style={{ color: 'var(--acc)', fontWeight: 700, textDecoration: 'none' }}>Anmelden</Link>
        <span style={{ margin: '0 8px', opacity: 0.4 }}>·</span>
        Keine Kreditkarte nötig
      </div>
    </form>
  );
}

/* ── Shared layout: aurora bg + nav + footer ── */
export default function LandingLayout({ children }: { children: ReactNode }) {
  useTheme();
  const scrolled = useScrolled();
  const location = useLocation();
  const navigate = useNavigate();

  // Scroll to top on page navigation
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  const goSignup = () => {
    if (location.pathname === '/') {
      document.getElementById('start')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/register');
    }
  };

  const NAV_LINKS = [
    { to: '/how-it-works', label: 'So funktioniert\'s' },
    { to: '/features', label: 'Features' },
    { to: '/pricing', label: 'Preise' },
  ];

  return (
    <div className="lp">
      {/* animated backdrop */}
      <div className="lp-bg">
        <div className="lp-grid" />
        <div className="lp-aurora a" />
        <div className="lp-aurora b" />
        <div className="lp-aurora c" />
        <div className="lp-noise" />
      </div>

      <div className="lp-content">
        {/* top nav */}
        <nav className={`lp-nav${scrolled ? ' scrolled' : ''}`}>
          <div className="lp-wrap lp-nav-inner">
            <Link to="/" className="lp-brand">
              <span style={{ display: 'inline-flex', color: 'var(--acc)' }}><BrandGlyph size={26} /></span>
              Nicheletter<span style={{ color: 'var(--acc)' }}>.ai</span>
            </Link>
            <div className="lp-navlinks">
              {NAV_LINKS.map((l) => (
                <Link key={l.to} to={l.to}
                  className={`lp-navlink hide-sm${location.pathname === l.to ? ' active' : ''}`}>
                  {l.label}
                </Link>
              ))}
              {/* Login — proper ghost button, always visible */}
              <Link to="/login" className="lp-btn lp-btn-ghost" style={{ padding: '9px 18px', fontSize: 14 }}>
                Anmelden
              </Link>
              <button className="lp-btn lp-btn-primary" style={{ padding: '9px 18px', fontSize: 14 }} onClick={goSignup}>
                Kostenlos starten
              </button>
            </div>
          </div>
        </nav>

        {/* page content */}
        {children}

        {/* footer */}
        <footer className="lp-footer">
          <div className="lp-wrap" style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between' }}>
            <Link to="/" className="lp-brand" style={{ fontSize: 17 }}>
              <span style={{ display: 'inline-flex', color: 'var(--acc)' }}><BrandGlyph size={22} /></span>
              Nicheletter<span style={{ color: 'var(--acc)' }}>.ai</span>
            </Link>
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              <Link to="/how-it-works">So funktioniert's</Link>
              <Link to="/features">Features</Link>
              <Link to="/pricing">Preise</Link>
              <Link to="/login" style={{ fontWeight: 700, color: 'var(--acc)' }}>Anmelden</Link>
              <Link to="/register">Kostenlos starten</Link>
            </div>
            <div>© {new Date().getFullYear()} Nicheletter.ai · Content Intelligence</div>
          </div>
        </footer>
      </div>
    </div>
  );
}
