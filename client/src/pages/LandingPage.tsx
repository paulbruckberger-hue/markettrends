import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import LandingLayout, { Reveal, SignupCard, Stat } from '../components/LandingLayout';
import { BrandGlyph } from '../components/ui';

/* ────────────────────────── data ────────────────────────── */

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

type Src = { glyph: string; color: string; name: string };
const SRC: Record<string, Src> = {
  news: { glyph: 'G', color: '#4285F4', name: 'Google News' },
  li: { glyph: 'in', color: '#0a66c2', name: 'LinkedIn' },
  room: { glyph: '◆', color: '#f59e0b', name: 'Newsroom' },
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

const SOURCE_PILLS = [
  { icon: '🟦', label: 'LinkedIn Posts' }, { icon: '📰', label: 'Google News' },
  { icon: '🏢', label: 'Company Pages' }, { icon: '📡', label: 'RSS-Feeds' },
  { icon: '🗞️', label: 'Newsrooms' }, { icon: '🌍', label: 'DACH & Global' },
  { icon: '🤖', label: 'KI-Klassifikation' }, { icon: '📬', label: 'Telegram Push' },
  { icon: '✉️', label: 'E-Mail Briefing' }, { icon: '⚡', label: 'Breaking-Alerts' },
];

const FEATURES_TEASER = [
  { icon: '🛰️', title: '4 Quellen, eine Ansicht', body: 'Google News, LinkedIn, RSS und Newsrooms — gebündelt, dedupliziert, an einem Ort statt in zehn Tabs.' },
  { icon: '🧠', title: 'KI-Priorisierung P1–P3', body: 'Kritisch, relevant oder nur Kontext? Die KI sortiert das Rauschen heraus, bevor es deine Zeit kostet.' },
  { icon: '⚔️', title: 'Wettbewerbsanalyse', body: 'Beobachte konkrete Unternehmen und verfolge Produktstarts, Funding, Personalwechsel und Expansion.' },
];

/* ────────────────────────── sub-components ────────────────────────── */

function FeedCard({ item }: { item: Item }) {
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
        <span className="lp-chip" style={{ background: `color-mix(in srgb, ${item.sigColor} 16%, transparent)`, color: item.sigColor }}>
          {item.signal}
        </span>
      </div>
      <div className="lp-card-title">{item.title}</div>
      <div className="lp-card-meta">{item.src.name} · {item.time}</div>
    </div>
  );
}

/* ────────────────────────── page ────────────────────────── */

export default function LandingPage() {
  // rotating niche word in headline
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

  const goSignup = () => document.getElementById('start')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <LandingLayout>

      {/* ─── Hero ─── */}
      <header className="lp-hero" ref={heroRef} onMouseMove={onHeroMove}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(380px circle at var(--mx,50%) var(--my,30%), color-mix(in srgb,var(--acc) 16%,transparent),transparent 70%)',
        }} />
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

          {/* floating phone mock */}
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
                  {[...FEED, ...FEED].map((it, i) => <FeedCard key={i} item={it} />)}
                </div>
                <div className="lp-phone-fade bot" />
              </div>
            </div>
          </div>
        </div>

        {/* stats row */}
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

      {/* ─── Sources marquee ─── */}
      <section className="lp-section" style={{ paddingTop: 28, paddingBottom: 28 }}>
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

      {/* ─── How it works teaser ─── */}
      <section className="lp-section">
        <div className="lp-wrap">
          <Reveal>
            <span className="lp-kicker">So funktioniert's</span>
            <h2 className="lp-h2">In 60 Sekunden vom Stichwort<br />zum gerankten Briefing.</h2>
            <p className="lp-lead">Kein Setup, keine Filter-Bastelei. Du nennst deine Nische — die KI übernimmt den Rest.</p>
          </Reveal>
          <div className="lp-steps">
            {[
              { icon: '🎯', title: 'Nische beobachten', body: 'Themen oder Unternehmen anlegen — von „Embedded Finance" bis „Revolut". Geo-Filter für DACH, Österreich oder global.' },
              { icon: '✨', title: 'KI rankt & klassifiziert', body: 'Jede Meldung wird auf P1–P3 bewertet und nach Signaltyp sortiert. Duplikate über alle Quellen werden zusammengeführt.' },
              { icon: '📬', title: 'Briefing erhalten', body: 'Ein kuratiertes Tagesbriefing — in der App, per Telegram und als Newsletter. Breaking-Signale kommen sofort.' },
            ].map((s, i) => (
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
          <Reveal>
            <div style={{ textAlign: 'center', marginTop: 28 }}>
              <Link to="/how-it-works" className="lp-btn lp-btn-ghost" style={{ padding: '11px 22px' }}>
                Interaktive Demo ansehen →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Features teaser ─── */}
      <section className="lp-section">
        <div className="lp-wrap">
          <Reveal>
            <span className="lp-kicker">Warum Nicheletter</span>
            <h2 className="lp-h2">Mehr Marktüberblick.<br />Weniger Lärm.</h2>
          </Reveal>
          <div className="lp-feat-grid">
            {FEATURES_TEASER.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <div className="lp-feat">
                  <div className="lp-feat-ico">{f.icon}</div>
                  <h4>{f.title}</h4>
                  <p>{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <div style={{ textAlign: 'center', marginTop: 28 }}>
              <Link to="/features" className="lp-btn lp-btn-ghost" style={{ padding: '11px 22px' }}>
                Alle Features ansehen →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Pricing teaser ─── */}
      <section className="lp-section">
        <div className="lp-wrap">
          <Reveal>
            <span className="lp-kicker">Preise</span>
            <h2 className="lp-h2">Starte gratis. Wachse, wenn du willst.</h2>
            <p className="lp-lead">Keine Kreditkarte für den Einstieg. Upgrade bringt dir mehr Stichwörter — sonst nichts Verstecktes.</p>
          </Reveal>
          <div className="lp-price-grid">
            {[
              { name: 'GRATIS', price: '0 €', per: '', sub: 'Zum Reinschnuppern', features: ['1 Stichwort', 'Alle 4 Quellen', 'KI-Ranking P1–P3', 'Tägliches Briefing'], cta: 'Kostenlos starten', featured: false },
              { name: 'PLUS', price: '4,99 €', per: '/Mo', sub: 'Für aktive Marktbeobachter', features: ['3 Stichwörter', 'Telegram-Push', 'E-Mail-Newsletter', 'Personalisierung'], cta: 'Plus wählen', featured: true },
              { name: 'PRO', price: '9,99 €', per: '/Mo', sub: 'Für volle Marktabdeckung', features: ['10 Stichwörter', 'Wettbewerbsanalyse', 'Breaking-Alerts', 'Themen-Cluster'], cta: 'Pro wählen', featured: false },
            ].map((p, i) => (
              <Reveal key={p.name} delay={i * 90} style={{ display: 'flex' }}>
                <div className={`lp-price${p.featured ? ' feat' : ''}`} style={{ width: '100%' }}>
                  {p.featured && <span className="lp-price-tag">Beliebteste Wahl</span>}
                  <div className="lp-price-name">{p.name}</div>
                  <div className="lp-price-amt">{p.price}<small> {p.per}</small></div>
                  <div style={{ color: 'var(--ink-3)', fontSize: 13.5, fontWeight: 600 }}>{p.sub}</div>
                  <ul>{p.features.map((f) => <li key={f}><span className="ck">✓</span>{f}</li>)}</ul>
                  <button className={`lp-btn ${p.featured ? 'lp-btn-primary' : 'lp-btn-ghost'}`}
                    style={{ width: '100%', marginTop: 'auto' }} onClick={goSignup}>{p.cta}</button>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <Link to="/pricing" style={{ color: 'var(--ink-3)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                Vollständige Preisübersicht ansehen →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
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

    </LandingLayout>
  );
}
