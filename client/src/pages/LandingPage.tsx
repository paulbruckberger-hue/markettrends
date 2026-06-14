import {
  CSSProperties, FormEvent, ReactNode, useEffect, useRef, useState,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRegister } from '../hooks/useAuth';
import { apiError } from '../lib/api';
import { useTheme } from '../lib/theme';
import { BrandGlyph } from '../components/ui';

/* ────────────────────────────── data ────────────────────────────── */

const ROTOR = [
  'Embedded Finance', 'KI im Banking', 'Instant Payments',
  'Climate Tech', 'Defense Tech', 'Open Banking', 'Stablecoins',
];

type Rank = 1 | 2 | 3;
const RANK: Record<Rank, { tag: string; de: string; color: string }> = {
  1: { tag: 'P1', de: 'Kritisch', color: '#f4212e' },
  2: { tag: 'P2', de: 'Relevant', color: '#f59e0b' },
  3: { tag: 'P3', de: 'Kontext', color: '#8b98a5' },
};

const SIGNALS: { de: string; color: string }[] = [
  { de: 'Produktstart', color: '#00ba7c' },
  { de: 'Expansion', color: '#1d9bf0' },
  { de: 'Partnerschaft', color: '#7c5cff' },
  { de: 'Finanzierung', color: '#00ba7c' },
  { de: 'Personal', color: '#f59e0b' },
  { de: 'Regulatorik', color: '#f4212e' },
  { de: 'Zahlen', color: '#22d3ee' },
];

type Src = { glyph: string; color: string; name: string };
const SRC: Record<string, Src> = {
  news: { glyph: 'G', color: '#4285F4', name: 'Google News' },
  li: { glyph: 'in', color: '#0a66c2', name: 'LinkedIn' },
  room: { glyph: '◆', color: '#f59e0b', name: 'Newsroom' },
  rss: { glyph: '∿', color: '#ee802f', name: 'RSS' },
};

type Item = { rank: Rank; signal: string; sigColor: string; title: string; src: Src; time: string };
const FEED: Item[] = [
  { rank: 1, signal: 'Finanzierung', sigColor: '#00ba7c', title: 'Revolut sichert sich 500 Mio. $ — Bewertung klettert auf 45 Mrd. €', src: SRC.news, time: 'vor 2 Std' },
  { rank: 1, signal: 'Regulatorik', sigColor: '#f4212e', title: 'EU macht Instant Payments ab 2025 zur Pflicht — Banken unter Zugzwang', src: SRC.room, time: 'vor 3 Std' },
  { rank: 2, signal: 'Produktstart', sigColor: '#00ba7c', title: 'N26 startet Embedded-Lending für KMU in der DACH-Region', src: SRC.li, time: 'vor 5 Std' },
  { rank: 2, signal: 'Partnerschaft', sigColor: '#7c5cff', title: 'Stripe und Solaris bündeln Banking-as-a-Service für Europa', src: SRC.news, time: 'vor 7 Std' },
  { rank: 3, signal: 'Personal', sigColor: '#f59e0b', title: 'Ex-Klarna-CPO wechselt als Produktchef zu Trade Republic', src: SRC.li, time: 'vor 11 Std' },
  { rank: 2, signal: 'Zahlen', sigColor: '#22d3ee', title: 'Wise meldet 25 % Umsatzplus — Q3 schlägt die Analystenschätzung', src: SRC.room, time: 'vor 1 Tag' },
];

/* ────────────────────────────── hooks ────────────────────────────── */

function useScrolled(threshold = 8): boolean {
  const [s, setS] = useState(false);
  useEffect(() => {
    const onScroll = () => setS(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return s;
}

/** Adds `.in` to a `.lp-reveal` element once it scrolls into view. */
function Reveal({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { el.classList.add('in'); io.unobserve(el); }
      }),
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="lp-reveal" style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </div>
  );
}

function Stat({ to, suffix = '', label }: { to: number; suffix?: string; label: string }) {
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
        const eased = 1 - Math.pow(1 - p, 3);
        setN(Math.round(to * eased));
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

/* ────────────────────────────── pieces ────────────────────────────── */

function SignalCard({ item }: { item: Item }) {
  const r = RANK[item.rank];
  return (
    <div className="lp-card">
      <div className="lp-cardrow" style={{ justifyContent: 'space-between' }}>
        <div className="lp-cardrow">
          <div className="lp-avatar" style={{ background: item.src.color }}>{item.src.glyph}</div>
          <span className="lp-badge" style={{ background: `color-mix(in srgb, ${r.color} 16%, transparent)`, color: r.color }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.color }} />
            {r.tag} · {r.de}
          </span>
        </div>
        <span className="lp-chip" style={{ background: `color-mix(in srgb, ${item.sigColor} 16%, transparent)`, color: item.sigColor }}>{item.signal}</span>
      </div>
      <div className="lp-card-title">{item.title}</div>
      <div className="lp-card-meta">{item.src.name} · {item.time}</div>
    </div>
  );
}

function SignupCard({ compact = false }: { compact?: boolean }) {
  const register = useRegister();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = async (e: FormEvent) => {
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
        Schon dabei? <Link to="/login" style={{ color: 'var(--acc)', fontWeight: 700, textDecoration: 'none' }}>Anmelden</Link>
        <span style={{ margin: '0 8px', opacity: 0.4 }}>·</span>
        Keine Kreditkarte nötig
      </div>
    </form>
  );
}

/* ────────────────────────────── page ────────────────────────────── */

export default function LandingPage() {
  useTheme(); // sets --accent (and theme tokens) on <html>
  const scrolled = useScrolled();
  const navigate = useNavigate();

  // rotating niche word
  const [ri, setRi] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setRi((i) => (i + 1) % ROTOR.length), 2200);
    return () => clearInterval(id);
  }, []);

  // hero pointer glow
  const heroRef = useRef<HTMLDivElement>(null);
  const onHeroMove = (e: React.MouseEvent) => {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  // "try your niche" demo
  const [term, setTerm] = useState('');
  const [tryState, setTryState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [tryItems, setTryItems] = useState<Item[]>([]);
  const runTry = (e?: FormEvent) => {
    e?.preventDefault();
    const t = term.trim() || 'Quantum Computing';
    if (!term.trim()) setTerm(t);
    setTryState('loading');
    window.setTimeout(() => {
      setTryItems(genResults(t));
      setTryState('done');
    }, 1100);
  };

  const goSignup = () => document.getElementById('start')?.scrollIntoView({ behavior: 'smooth' });

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
        {/* nav */}
        <nav className={`lp-nav${scrolled ? ' scrolled' : ''}`}>
          <div className="lp-wrap lp-nav-inner">
            <a className="lp-brand" href="#top">
              <span style={{ display: 'inline-flex', color: 'var(--acc)' }}><BrandGlyph size={26} /></span>
              Nicheletter<span style={{ color: 'var(--acc)' }}>.ai</span>
            </a>
            <div className="lp-navlinks">
              <a className="lp-navlink hide-sm" href="#how">So funktioniert's</a>
              <a className="lp-navlink hide-sm" href="#features">Features</a>
              <a className="lp-navlink hide-sm" href="#pricing">Preise</a>
              <span className="lp-navlink" onClick={() => navigate('/login')}>Anmelden</span>
              <button className="lp-btn lp-btn-primary" style={{ padding: '9px 18px', fontSize: 14 }} onClick={goSignup}>
                Kostenlos starten
              </button>
            </div>
          </div>
        </nav>

        {/* hero */}
        <header id="top" className="lp-hero" ref={heroRef} onMouseMove={onHeroMove}>
          <div
            style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(380px circle at var(--mx, 50%) var(--my, 30%), color-mix(in srgb, var(--acc) 16%, transparent), transparent 70%)',
            }}
          />
          <div className="lp-wrap lp-hero-grid">
            <div>
              <span className="lp-eyebrow"><span className="dot" /> KI-Aufklärung für deine Nische</span>
              <h1 className="lp-h1">
                Sei zuerst da, wenn sich in{' '}
                <span className="lp-rotor">
                  <span key={ri} className="lp-rotor-word lp-grad fade-up">{ROTOR[ri]}</span>
                </span>{' '}
                etwas bewegt.
              </h1>
              <p className="lp-sub">
                Nicheletter durchsucht <b style={{ color: 'var(--ink)' }}>News, LinkedIn, RSS & Newsrooms</b>,
                rankt jedes Signal per KI und liefert dir ein tägliches Briefing —
                damit du nie wieder die eine Meldung verpasst, die deinen Markt verändert.
              </p>

              <div id="start" style={{ marginTop: 28, maxWidth: 440 }}>
                <SignupCard />
              </div>

              <div className="lp-trust">
                <span>✦ <b>Gratis</b> starten</span>
                <span>⚡ Erstes Briefing in <b>~60 Sek.</b></span>
                <span>🔒 Jederzeit kündbar</span>
              </div>
            </div>

            {/* phone mock */}
            <div className="lp-phone" aria-hidden="true">
              <div className="lp-phone-frame">
                <div className="lp-phone-screen">
                  <div className="lp-phone-notch" />
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 46, zIndex: 6,
                    display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px',
                    background: 'rgba(21,32,43,0.9)', borderBottom: '1px solid rgba(255,255,255,0.06)',
                    fontWeight: 800, fontSize: 14, letterSpacing: -0.3,
                  }}>
                    <span style={{ color: 'var(--acc)', display: 'inline-flex' }}><BrandGlyph size={18} /></span>
                    Dein Feed
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#00ba7c' }}>● live</span>
                  </div>
                  <div className="lp-phone-fade top" />
                  <div className="lp-feedstream">
                    {[...FEED, ...FEED].map((it, i) => <SignalCard key={i} item={it} />)}
                  </div>
                  <div className="lp-phone-fade bot" />
                </div>
              </div>
            </div>
          </div>

          {/* stats */}
          <div className="lp-wrap">
            <Reveal>
              <div className="lp-stats">
                <Stat to={4} suffix=" Quellen" label="News · LinkedIn · RSS · Newsroom" />
                <Stat to={5} suffix=" Sprachen" label="DE · EN · FR · ES · IT" />
                <Stat to={3} suffix=" Stufen" label="P1 · P2 · P3 KI-Ranking" />
                <Stat to={1} suffix="× / Tag" label="Kuratiertes Briefing" />
              </div>
            </Reveal>
          </div>
        </header>

        {/* sources marquee */}
        <section className="lp-section" style={{ paddingTop: 32, paddingBottom: 32 }}>
          <div className="lp-wrap" style={{ textAlign: 'center', marginBottom: 22 }}>
            <span className="lp-kicker">Eine Sicht auf alles, was zählt</span>
          </div>
          <div className="lp-marquee">
            <div className="lp-marquee-track">
              {[...SOURCE_PILLS, ...SOURCE_PILLS].map((s, i) => (
                <span key={i} className="lp-source-pill"><span style={{ fontSize: 17 }}>{s.icon}</span>{s.label}</span>
              ))}
            </div>
          </div>
        </section>

        {/* how it works */}
        <section id="how" className="lp-section">
          <div className="lp-wrap">
            <Reveal>
              <span className="lp-kicker">So funktioniert's</span>
              <h2 className="lp-h2">In 60 Sekunden vom Stichwort<br />zum gerankten Briefing.</h2>
              <p className="lp-lead">Kein Setup, keine Filter-Bastelei. Du nennst deine Nische — die KI übernimmt das Aufspüren, Bewerten und Zusammenfassen.</p>
            </Reveal>
            <div className="lp-steps">
              {STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 90}>
                  <div className="lp-step">
                    <div className="lp-step-num">SCHRITT {i + 1}</div>
                    <div className="lp-step-icon">{s.icon}</div>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* interactive try */}
        <section className="lp-section" style={{ paddingTop: 24 }}>
          <div className="lp-wrap">
            <Reveal>
              <div className="lp-try">
                <span className="lp-kicker">Live ausprobieren</span>
                <h2 className="lp-h2" style={{ fontSize: 'clamp(24px,3.2vw,36px)' }}>Gib deine Nische ein — sieh, was reinkommt.</h2>
                <form className="lp-try-bar" onSubmit={runTry}>
                  <input className="lp-field" style={{ flex: 1 }} value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="z. B. Embedded Finance, Defense Tech, Wasserstoff …" />
                  <button type="submit" className="lp-btn lp-btn-primary" style={{ padding: '13px 24px' }}>
                    {tryState === 'loading' ? 'KI analysiert …' : 'Signale anzeigen'}
                  </button>
                </form>

                {tryState === 'idle' && (
                  <p style={{ color: 'var(--ink-3)', fontSize: 14, marginTop: 16 }}>
                    Vorschau-Demo · echte Signale erhältst du nach der kostenlosen Anmeldung.
                  </p>
                )}
                {tryState === 'loading' && (
                  <div className="lp-try-results">
                    {[0, 1, 2].map((i) => <div key={i} className="lp-shimmer" />)}
                  </div>
                )}
                {tryState === 'done' && (
                  <>
                    <div className="lp-try-results">
                      {tryItems.map((it, i) => (
                        <div key={i} className="fade-up" style={{ animationDelay: `${i * 80}ms` }}>
                          <SignalCard item={it} />
                        </div>
                      ))}
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 22 }}>
                      <button className="lp-btn lp-btn-primary" onClick={goSignup} style={{ padding: '13px 26px' }}>
                        „{term.trim()}" jetzt dauerhaft beobachten →
                      </button>
                    </div>
                  </>
                )}
              </div>
            </Reveal>
          </div>
        </section>

        {/* features */}
        <section id="features" className="lp-section">
          <div className="lp-wrap">
            <Reveal>
              <span className="lp-kicker">Warum Nicheletter</span>
              <h2 className="lp-h2">Mehr Marktüberblick.<br />Weniger Lärm.</h2>
            </Reveal>
            <div className="lp-feat-grid">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={(i % 3) * 80}>
                  <div className="lp-feat">
                    <div className="lp-feat-ico">{f.icon}</div>
                    <h4>{f.title}</h4>
                    <p>{f.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* signal types */}
            <Reveal style={{ marginTop: 56 }}>
              <span className="lp-kicker">KI-Klassifikation</span>
              <h2 className="lp-h2" style={{ fontSize: 'clamp(22px,3vw,34px)' }}>Jedes Signal sauberer eingeordnet.</h2>
              <p className="lp-lead">Die KI erkennt nicht nur Relevanz (P1–P3), sondern auch die Art des Ereignisses — so siehst du auf einen Blick, was passiert.</p>
              <div className="lp-sig-wrap">
                {SIGNALS.map((s) => (
                  <span key={s.de} className="lp-sig" style={{ borderColor: `color-mix(in srgb, ${s.color} 55%, transparent)`, color: s.color }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />{s.de}
                  </span>
                ))}
              </div>
            </Reveal>

            {/* channels */}
            <Reveal style={{ marginTop: 56 }}>
              <span className="lp-kicker">Zugestellt, wo du bist</span>
              <h2 className="lp-h2" style={{ fontSize: 'clamp(22px,3vw,34px)' }}>Drei Kanäle, ein 👍/👎 lernt mit.</h2>
              <div className="lp-feat-grid" style={{ marginTop: 28 }}>
                {CHANNELS.map((c) => (
                  <div key={c.title} className="lp-feat">
                    <div className="lp-feat-ico">{c.icon}</div>
                    <h4>{c.title}</h4>
                    <p>{c.body}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* pricing */}
        <section id="pricing" className="lp-section">
          <div className="lp-wrap">
            <Reveal>
              <span className="lp-kicker">Preise</span>
              <h2 className="lp-h2">Starte gratis. Wachse, wenn du willst.</h2>
              <p className="lp-lead">Keine Kreditkarte für den Einstieg. Upgrade bringt dir mehr Stichwörter — sonst nichts Verstecktes.</p>
            </Reveal>
            <div className="lp-price-grid">
              {PRICING.map((p, i) => (
                <Reveal key={p.name} delay={i * 90} style={{ display: 'flex' }}>
                  <div className={`lp-price${p.featured ? ' feat' : ''}`} style={{ width: '100%' }}>
                    {p.featured && <span className="lp-price-tag">Beliebteste Wahl</span>}
                    <div className="lp-price-name">{p.name}</div>
                    <div className="lp-price-amt">{p.price}<small>{p.per}</small></div>
                    <div style={{ color: 'var(--ink-3)', fontSize: 13.5, fontWeight: 600 }}>{p.sub}</div>
                    <ul>
                      {p.features.map((f) => <li key={f}><span className="ck">✓</span>{f}</li>)}
                    </ul>
                    <button className={`lp-btn ${p.featured ? 'lp-btn-primary' : 'lp-btn-ghost'}`}
                      style={{ width: '100%', marginTop: 'auto' }} onClick={goSignup}>
                      {p.cta}
                    </button>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* final CTA */}
        <section className="lp-section" style={{ paddingTop: 24 }}>
          <div className="lp-wrap">
            <Reveal>
              <div className="lp-cta">
                <h2 className="lp-h2" style={{ maxWidth: 720, margin: '0 auto' }}>
                  Deine Nische verändert sich gerade.<br />Erfahre es zuerst.
                </h2>
                <p className="lp-lead" style={{ margin: '16px auto 28px', textAlign: 'center' }}>
                  Leg in 30 Sekunden los — kostenlos, ohne Kreditkarte.
                </p>
                <SignupCard compact />
              </div>
            </Reveal>
          </div>
        </section>

        {/* footer */}
        <footer className="lp-footer">
          <div className="lp-wrap" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="lp-brand" style={{ fontSize: 17 }}>
              <span style={{ display: 'inline-flex', color: 'var(--acc)' }}><BrandGlyph size={22} /></span>
              Nicheletter<span style={{ color: 'var(--acc)' }}>.ai</span>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <a onClick={() => navigate('/login')}>Anmelden</a>
              <a onClick={goSignup}>Registrieren</a>
              <a href="#how">So funktioniert's</a>
              <a href="#pricing">Preise</a>
            </div>
            <div>© {new Date().getFullYear()} Nicheletter.ai · Content Intelligence</div>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ────────────────────────────── content ────────────────────────────── */

const SOURCE_PILLS = [
  { icon: '🟦', label: 'LinkedIn Posts' },
  { icon: '📰', label: 'Google News' },
  { icon: '🏢', label: 'Company Pages' },
  { icon: '📡', label: 'RSS-Feeds' },
  { icon: '🗞️', label: 'Newsrooms' },
  { icon: '🌍', label: 'DACH & Global' },
  { icon: '🤖', label: 'KI-Klassifikation' },
];

const STEPS = [
  { icon: '🎯', title: 'Nische beobachten', body: 'Themen oder Unternehmen anlegen — von „Embedded Finance" bis „Revolut". Geo-Filter für DACH, Österreich oder global.' },
  { icon: '✨', title: 'KI rankt & klassifiziert', body: 'Jede Meldung wird auf P1–P3 bewertet und nach Signaltyp sortiert. Duplikate über alle Quellen werden zusammengeführt.' },
  { icon: '📬', title: 'Briefing erhalten', body: 'Ein kuratiertes Tagesbriefing — in der App, per Telegram und als Newsletter. Breaking-Signale kommen sofort.' },
];

const FEATURES = [
  { icon: '🛰️', title: '4 Quellen, eine Ansicht', body: 'Google News, LinkedIn, RSS und Newsrooms — gebündelt, dedupliziert, an einem Ort statt in zehn Tabs.' },
  { icon: '🧠', title: 'KI-Priorisierung P1–P3', body: 'Kritisch, relevant oder nur Kontext? Die KI sortiert das Rauschen heraus, bevor es deine Zeit kostet.' },
  { icon: '⚔️', title: 'Wettbewerbsanalyse', body: 'Beobachte konkrete Unternehmen und verfolge Produktstarts, Funding, Personalwechsel und Expansion.' },
  { icon: '👍', title: 'Lernt aus deinem Feedback', body: 'Ein Daumen rauf/runter genügt — dein Ranking personalisiert sich sofort, in jedem Kanal.' },
  { icon: '🌐', title: 'Mehrsprachig', body: 'Alias-Erweiterung in DE, EN, FR, ES und IT findet auch Meldungen, die andere Tools übersehen.' },
  { icon: '🚨', title: 'Breaking-Alerts', body: 'Wirklich kritische Signale erreichen dich sofort per Push — der Rest wartet aufs Tagesbriefing.' },
];

const CHANNELS = [
  { icon: '📱', title: 'In-App-Feed', body: 'Gerankter Stream mit Bookmarks, Lese-Status und Themen-Clustern.' },
  { icon: '✈️', title: 'Telegram', body: 'Push mit „Mehr Infos" und 👍/👎 direkt im Chat — verbinde den Bot in einem Tap.' },
  { icon: '✉️', title: 'E-Mail-Newsletter', body: 'Dein Takt, deine Wahl. 1-Klick-Feedback direkt aus der Mail, scanner-sicher.' },
];

const PRICING = [
  {
    name: 'GRATIS', price: '0 €', per: '', sub: 'Zum Reinschnuppern',
    features: ['1 Stichwort beobachten', 'Alle 4 Quellen', 'KI-Ranking P1–P3', 'Tägliches Briefing'],
    cta: 'Kostenlos starten', featured: false,
  },
  {
    name: 'PLUS', price: '4,99 €', per: ' / Monat', sub: 'Für aktive Marktbeobachter',
    features: ['3 Stichwörter', 'Telegram-Push', 'E-Mail-Newsletter', 'Personalisierung & Feedback'],
    cta: 'Plus wählen', featured: true,
  },
  {
    name: 'PRO', price: '9,99 €', per: ' / Monat', sub: 'Für volle Marktabdeckung',
    features: ['10 Stichwörter', 'Wettbewerbsanalyse', 'Breaking-Alerts', 'Themen-Cluster & Export'],
    cta: 'Pro wählen', featured: false,
  },
];

/* deterministic-ish mock generator for the "try your niche" demo */
function genResults(term: string): Item[] {
  const t = term.trim();
  const pool: Omit<Item, 'src'>[] = [
    { rank: 1, signal: 'Finanzierung', sigColor: '#00ba7c', title: `${t}-Startup sammelt zweistellige Millionenrunde ein — Runde überzeichnet`, time: 'vor 1 Std' },
    { rank: 1, signal: 'Regulatorik', sigColor: '#f4212e', title: `Neue EU-Vorgaben treffen ${t}-Anbieter — Frist 2025`, time: 'vor 4 Std' },
    { rank: 2, signal: 'Produktstart', sigColor: '#00ba7c', title: `Marktführer kündigt ${t}-Produktoffensive für Q3 an`, time: 'vor 6 Std' },
    { rank: 2, signal: 'Partnerschaft', sigColor: '#7c5cff', title: `Zwei Schwergewichte schließen strategische ${t}-Allianz`, time: 'vor 9 Std' },
    { rank: 3, signal: 'Zahlen', sigColor: '#22d3ee', title: `Studie: ${t}-Markt wächst 2025 voraussichtlich zweistellig`, time: 'vor 1 Tag' },
  ];
  const srcs = [SRC.news, SRC.room, SRC.li];
  return [pool[0], pool[2], pool[1]].map((p, i) => ({ ...p, src: srcs[i % srcs.length] }));
}
