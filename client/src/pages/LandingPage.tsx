import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import LandingLayout, { Reveal, SignupCard } from '../components/LandingLayout';

/* ────────────────────────── brief content ────────────────────────── */

type Pri = 1 | 2 | 3;
const PRI: Record<Pri, { lbl: string; color: string }> = {
  1: { lbl: 'Kritisch', color: '#f4212e' },
  2: { lbl: 'Relevant', color: '#1d9bf0' },
  3: { lbl: 'Kontext', color: '#8b98a5' },
};

type Entry = { pri: Pri; cat: string; catColor: string; title: string; src: string; time: string };

/** Niches the brief cycles through on its own until the visitor types their own. */
const DEMO_NICHES = ['Embedded Finance', 'Defense Tech', 'Climate Tech', 'KI-Agenten', 'Longevity', 'Instant Payments'];

/** Plausible morning-brief for any niche term — the homepage's signature demo. */
function buildBrief(term: string): { entries: Entry[]; summary: string } {
  const t = term.trim() || 'deinem Markt';
  return {
    entries: [
      { pri: 1, cat: 'Finanzierung', catColor: '#00ba7c', title: `${t}: Marktführer sammelt 140 Mio. € ein — größte Runde des Jahres in der Branche`, src: 'Google News', time: 'heute, 06:12' },
      { pri: 1, cat: 'Regulatorik', catColor: '#f4212e', title: `Neue EU-Vorgaben für ${t} treten 2026 in Kraft — Anbieter müssen nachziehen`, src: 'Newsroom', time: 'gestern, 18:40' },
      { pri: 2, cat: 'Produktstart', catColor: '#00ba7c', title: `Direkter Wettbewerber launcht ${t}-Feature, an dem auch du arbeitest`, src: 'LinkedIn', time: 'heute, 07:30' },
      { pri: 2, cat: 'Personal', catColor: '#f59e0b', title: `Ehem. Stripe-Manager übernimmt ${t}-Sparte bei Großkonzern`, src: 'LinkedIn', time: 'heute, 08:05' },
      { pri: 3, cat: 'Zahlen', catColor: '#22d3ee', title: `Studie: ${t}-Markt wächst 2026 voraussichtlich um 28 %`, src: 'Newsroom', time: 'gestern' },
    ],
    summary: `2 kritische Entwicklungen heute — angeführt von einer Rekord-Runde. Die EU-Regulierung solltest du auf dem Schirm haben.`,
  };
}

/* ────────────────────────── interactive brief ────────────────────────── */

function MorningBrief() {
  const [term, setTerm] = useState(DEMO_NICHES[0]);
  const [active, setActive] = useState(DEMO_NICHES[0]);
  const [phase, setPhase] = useState<'scanning' | 'ready'>('ready');
  const [run, setRun] = useState(0);
  const idx = useRef(0);
  const locked = useRef(false); // visitor has taken control → stop auto-cycling
  const scanTimer = useRef<number>();

  const rebuild = (t: string) => {
    window.clearTimeout(scanTimer.current);
    setActive(t);
    setPhase('scanning');
    setRun((r) => r + 1);
    scanTimer.current = window.setTimeout(() => setPhase('ready'), 720);
  };

  // initial assemble
  useEffect(() => { rebuild(DEMO_NICHES[0]); /* eslint-disable-next-line */ }, []);

  // auto-cycle through example niches until the visitor interacts
  useEffect(() => {
    const id = window.setInterval(() => {
      if (locked.current) return;
      idx.current = (idx.current + 1) % DEMO_NICHES.length;
      const next = DEMO_NICHES[idx.current];
      setTerm(next);
      rebuild(next);
    }, 4200);
    return () => window.clearInterval(id);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    locked.current = true;
    rebuild(term.trim() || active);
  };

  const { entries, summary } = buildBrief(active);
  const today = new Date().toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: 'long' });

  return (
    <div className="lp-brief" aria-label="Beispiel-Briefing">
      <div className="lp-brief-top">
        <span className="lp-brief-date">Morgen-Briefing · {today}</span>
        <span className="lp-brief-live"><span className="d" /> LIVE</span>
      </div>

      <form className="lp-niche" onSubmit={submit}>
        <span className="lp-niche-hash">#</span>
        <input
          className="lp-niche-input"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onFocus={() => { locked.current = true; }}
          placeholder="Deine Nische eingeben …"
          aria-label="Deine Nische"
        />
        <button className="lp-niche-go" type="submit" aria-label="Briefing erstellen">→</button>
      </form>

      <div className="lp-brief-body">
        <div className="lp-brief-h">Heute in <b>{active}</b></div>

        {phase === 'scanning' ? (
          <div className="lp-scan" key={`scan-${run}`}>
            <div className="lp-scan-line"><span className="lp-scan-spin" /> Durchsucht News, LinkedIn &amp; Newsrooms …</div>
            <div className="lp-scan-bar"><span /></div>
            <div className="lp-scan-line" style={{ color: 'var(--ink-3)', fontSize: 13 }}>Bewertet &amp; sortiert nach Wichtigkeit</div>
          </div>
        ) : (
          <div key={`brief-${run}`}>
            {entries.map((e, i) => {
              const p = PRI[e.pri];
              return (
                <div
                  key={i}
                  className={`lp-entry${i === 0 ? ' lead' : ''} fade-up`}
                  style={{ ['--mk' as string]: p.color, animationDelay: `${i * 70}ms` }}
                >
                  <div className="bar" />
                  <div>
                    <span className="lp-entry-pri">{p.lbl}</span>
                    <div className="lp-entry-title">{e.title}</div>
                    <div className="lp-entry-meta">
                      <span className="lp-entry-cat" style={{ background: `color-mix(in srgb, ${e.catColor} 16%, transparent)`, color: e.catColor }}>{e.cat}</span>
                      {e.src} · {e.time}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="lp-brief-foot">
              <span className="ai">KI-Fazit</span>
              <span>{summary}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────── page ────────────────────────── */

const SOURCE_PILLS = [
  { icon: '📰', label: 'Google News' }, { icon: '🟦', label: 'LinkedIn Posts' },
  { icon: '🏢', label: 'Company Pages' }, { icon: '📡', label: 'RSS-Feeds' },
  { icon: '🗞️', label: 'Branchen-Newsrooms' }, { icon: '🌍', label: 'DACH & Global' },
  { icon: '🤖', label: 'KI-Bewertung' }, { icon: '✈️', label: 'Telegram' }, { icon: '✉️', label: 'E-Mail' },
];

const WITHOUT = [
  '14 offene Tabs, 6 Newsletter und ein Google-Alerts-Postfach voller Spam',
  'Stundenlanges LinkedIn-Scrollen — und trotzdem das Wichtige übersehen',
  'Die Funding-Runde des Konkurrenten erst erfahren, wenn alle darüber reden',
  'Eine Regulierung verpasst, die dein Geschäftsmodell betrifft',
];
const WITH = [
  'Ein Briefing. Nach Wichtigkeit sortiert. Jeden Morgen um 7 Uhr.',
  'News, LinkedIn & Newsrooms automatisch gelesen — du liest nur das Ergebnis',
  'Kritische Moves erreichen dich sofort, noch bevor sie Mainstream werden',
  'Du gehst in jedes Meeting als die best-informierte Person im Raum',
];

const FEATURES_TEASER = [
  { icon: '🎯', title: 'Nur das, was zählt', body: 'Die KI hebt hervor, was du heute wissen musst — kritisch, relevant oder nur Kontext — und blendet den Rest aus.' },
  { icon: '🛰️', title: 'Alle Quellen, eine Seite', body: 'Google News, LinkedIn, RSS und Branchen-Newsrooms — automatisch gelesen, dedupliziert, auf einer Seite zusammengeführt.' },
  { icon: '⚔️', title: 'Behalte Konkurrenten im Blick', body: 'Beobachte konkrete Unternehmen und erfahre zuerst von Produktstarts, Funding, Personalwechseln und Expansion.' },
];

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const onHeroMove = (e: React.MouseEvent) => {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <LandingLayout>

      {/* ─── Hero ─── */}
      <header className="lp-hero" ref={heroRef} onMouseMove={onHeroMove}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(420px circle at var(--mx,70%) var(--my,30%), color-mix(in srgb,var(--acc) 15%,transparent),transparent 70%)',
        }} />
        <div className="lp-wrap lp-hero-grid">
          <div>
            <span className="lp-eyebrow"><span className="dot" /> Marktintelligenz für Gründer &amp; Experten</span>
            <h1 className="lp-h1">
              Bleib die Person,<br />die <span className="lp-grad">zuerst</span> weiß,<br />
              was den Markt <span className="lp-em-serif">bewegt.</span>
            </h1>
            <p className="lp-sub">
              Nicheletter ist dein KI-Analyst für deine Nische. Er liest rund um die Uhr
              News, LinkedIn und Branchen-Newsrooms, trennt das Wichtige vom Rauschen und
              legt dir <b style={{ color: 'var(--ink)' }}>jeden Morgen ein Briefing</b> auf den Tisch —
              sortiert nach dem, was du heute wirklich wissen musst.
            </p>

            <div id="start" style={{ marginTop: 28, maxWidth: 460 }}>
              <SignupCard />
            </div>

            <div className="lp-trust">
              <span>✦ <b>Gratis</b> starten</span>
              <span>⚡ Erstes Briefing in <b>~60 Sek.</b></span>
              <span>🔒 Keine Kreditkarte</span>
            </div>
          </div>

          {/* interactive editorial brief */}
          <div>
            <MorningBrief />
            <p style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 12.5, marginTop: 14 }}>
              👆 Tippe deine eigene Nische ein und sieh dein Briefing entstehen
            </p>
          </div>
        </div>
      </header>

      {/* ─── Ohne / Mit (replaces vanity stats) ─── */}
      <section className="lp-section" style={{ paddingTop: 40 }}>
        <div className="lp-wrap">
          <Reveal>
            <span className="lp-kicker">Der Unterschied</span>
            <h2 className="lp-h2">Informiert sein war noch nie<br />das Problem. Lärm ist es.</h2>
          </Reveal>
          <div className="lp-vs">
            <Reveal>
              <div className="lp-vs-card bad">
                <span className="lp-vs-tag">Ohne Nicheletter</span>
                <h3>Du suchst — und verpasst trotzdem.</h3>
                {WITHOUT.map((r) => (
                  <div key={r} className="lp-vs-row"><span className="ic">✕</span>{r}</div>
                ))}
              </div>
            </Reveal>
            <Reveal delay={90}>
              <div className="lp-vs-card good">
                <span className="lp-vs-tag">Mit Nicheletter</span>
                <h3>Es kommt zu dir — vorsortiert.</h3>
                {WITH.map((r) => (
                  <div key={r} className="lp-vs-row"><span className="ic">✓</span>{r}</div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── Sources strip ─── */}
      <section className="lp-section" style={{ paddingTop: 24, paddingBottom: 28 }}>
        <div className="lp-wrap" style={{ textAlign: 'center', marginBottom: 22 }}>
          <span className="lp-kicker">Was du sonst in 14 Tabs öffnen müsstest</span>
        </div>
        <div className="lp-marquee">
          <div className="lp-marquee-track">
            {[...SOURCE_PILLS, ...SOURCE_PILLS].map((s, i) => (
              <span key={i} className="lp-source-pill"><span style={{ fontSize: 17 }}>{s.icon}</span>{s.label}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="lp-section">
        <div className="lp-wrap">
          <Reveal>
            <span className="lp-kicker">So funktioniert's</span>
            <h2 className="lp-h2">Vom Stichwort zum Briefing —<br />in unter einer Minute.</h2>
            <p className="lp-lead">Kein Setup, keine Filter-Bastelei. Du nennst deine Nische — die KI übernimmt das Lesen, Bewerten und Zusammenfassen.</p>
          </Reveal>
          <div className="lp-steps">
            {[
              { icon: '🎯', title: 'Nische nennen', body: 'Ein Thema („Embedded Finance") oder ein Unternehmen („Revolut"). Geo-Fokus auf DACH, Österreich oder global — fertig.' },
              { icon: '✨', title: 'KI liest & gewichtet', body: 'Sie durchsucht alle Quellen rund um die Uhr, bewertet jede Meldung nach Wichtigkeit und führt Duplikate zusammen.' },
              { icon: '📬', title: 'Morgens informiert', body: 'Dein Briefing landet in der App, per Telegram und per E-Mail. Wirklich kritische Meldungen erreichen dich sofort.' },
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
                Genauer ansehen →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Features teaser ─── */}
      <section className="lp-section">
        <div className="lp-wrap">
          <Reveal>
            <span className="lp-kicker">Dein unfairer Vorteil</span>
            <h2 className="lp-h2">Mehr Überblick.<br />Weniger Zeit verschwendet.</h2>
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
            <p className="lp-lead">Keine Kreditkarte für den Einstieg. Upgrade bringt dir mehr Themen im Blick — sonst nichts Verstecktes.</p>
          </Reveal>
          <div className="lp-price-grid">
            {[
              { name: 'GRATIS', price: '0 €', per: '', sub: 'Zum Reinschnuppern', features: ['1 Thema im Blick', 'Alle Quellen', 'KI-Gewichtung', 'Tägliches Briefing'], cta: 'Kostenlos starten', featured: false },
              { name: 'PLUS', price: '4,99 €', per: '/Mo', sub: 'Für aktive Marktbeobachter', features: ['3 Themen im Blick', 'Telegram-Push', 'E-Mail-Briefing', 'Lernt aus Feedback'], cta: 'Plus wählen', featured: true },
              { name: 'PRO', price: '9,99 €', per: '/Mo', sub: 'Für volle Marktabdeckung', features: ['10 Themen im Blick', 'Konkurrenz-Tracking', 'Sofort-Alerts', 'Themen-Cluster'], cta: 'Pro wählen', featured: false },
            ].map((p, i) => (
              <Reveal key={p.name} delay={i * 90} style={{ display: 'flex' }}>
                <div className={`lp-price${p.featured ? ' feat' : ''}`} style={{ width: '100%' }}>
                  {p.featured && <span className="lp-price-tag">Beliebteste Wahl</span>}
                  <div className="lp-price-name">{p.name}</div>
                  <div className="lp-price-amt">{p.price}<small> {p.per}</small></div>
                  <div style={{ color: 'var(--ink-3)', fontSize: 13.5, fontWeight: 600 }}>{p.sub}</div>
                  <ul>{p.features.map((f) => <li key={f}><span className="ck">✓</span>{f}</li>)}</ul>
                  <Link to="/register" className={`lp-btn ${p.featured ? 'lp-btn-primary' : 'lp-btn-ghost'}`}
                    style={{ width: '100%', marginTop: 'auto' }}>{p.cta}</Link>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <Link to="/pricing" style={{ color: 'var(--ink-3)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                Vollständige Preisübersicht →
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
                Dein Markt verändert sich gerade.<br />Sei der Erste, der es weiß.
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
