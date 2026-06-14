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
  const t = term.trim() || 'deiner Branche';
  return {
    entries: [
      { pri: 1, cat: 'Finanzierung', catColor: '#00ba7c', title: `${t}: Marktführer sammelt 140 Mio. € ein — größte Finanzierungsrunde der Branche in diesem Jahr`, src: 'Google News', time: 'heute, 06:12' },
      { pri: 1, cat: 'Regulierung', catColor: '#f4212e', title: `Neue EU-Vorgabe für ${t} kommt 2026 — Anbieter müssen ihre Prozesse anpassen`, src: 'Newsroom', time: 'gestern, 18:40' },
      { pri: 2, cat: 'Produktstart', catColor: '#00ba7c', title: `Direkter Wettbewerber bringt ${t}-Funktion auf den Markt — an der auch du arbeitest`, src: 'LinkedIn', time: 'heute, 07:30' },
      { pri: 2, cat: 'Personal', catColor: '#f59e0b', title: `Früherer Stripe-Manager übernimmt die ${t}-Sparte eines Großkonzerns`, src: 'LinkedIn', time: 'heute, 08:05' },
      { pri: 3, cat: 'Zahlen', catColor: '#22d3ee', title: `Studie: Markt für ${t} wächst 2026 voraussichtlich um 28 %`, src: 'Newsroom', time: 'gestern' },
    ],
    summary: `Heute zwei kritische Entwicklungen — allen voran eine Rekord-Finanzierung. Die neue EU-Vorgabe solltest du im Auge behalten.`,
  };
}

/* ────────────────────────── hero (headline + brief share one niche) ────────────────────────── */

function Hero() {
  const [term, setTerm] = useState(DEMO_NICHES[0]);       // text in the input
  const [active, setActive] = useState(DEMO_NICHES[0]);   // niche the brief + headline show
  const [phase, setPhase] = useState<'scanning' | 'ready'>('ready');
  const [run, setRun] = useState(0);
  const idx = useRef(0);
  const locked = useRef(false);                           // visitor took control → stop cycling
  const scanTimer = useRef<number>();

  const rebuild = (t: string) => {
    window.clearTimeout(scanTimer.current);
    setActive(t);
    setPhase('scanning');
    setRun((r) => r + 1);
    scanTimer.current = window.setTimeout(() => setPhase('ready'), 720);
  };

  useEffect(() => { rebuild(DEMO_NICHES[0]); /* eslint-disable-next-line */ }, []);

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

  // pointer glow
  const heroRef = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  const { entries, summary } = buildBrief(active);
  const today = new Date().toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: 'long' });

  return (
    <header className="lp-hero" ref={heroRef} onMouseMove={onMove}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(420px circle at var(--mx,70%) var(--my,30%), color-mix(in srgb,var(--acc) 15%,transparent),transparent 70%)',
      }} />
      <div className="lp-wrap lp-hero-grid">
        <div>
          <span className="lp-eyebrow"><span className="dot" /> Marktintelligenz für Gründer und Entscheider</span>

          {/* headline shares the live niche with the brief — the requested combination.
              minHeight reserves space for the tallest niche so the signup never shifts. */}
          <h1 className="lp-h1" style={{ minHeight: '5.1em' }}>
            Bleib die Person,<br />die zuerst weiß, was sich in{' '}
            <span key={active} className="lp-grad fade-up" style={{ whiteSpace: 'nowrap' }}>{active}</span>{' '}
            <span className="lp-em-serif">bewegt.</span>
          </h1>

          <p className="lp-sub">
            Nicheletter ist dein KI-Analyst: Rund um die Uhr wertet er News, LinkedIn und
            Branchenquellen aus, filtert das Wesentliche heraus und bringt es jeden Morgen
            auf den Punkt — <b style={{ color: 'var(--ink)' }}>ein Briefing, nach Wichtigkeit sortiert</b>,
            in zwei Minuten gelesen.
          </p>

          <div id="start" style={{ marginTop: 26, maxWidth: 460 }}>
            <SignupCard />
          </div>

          <div className="lp-trust">
            <span>✦ <b>Kostenlos</b></span>
            <span>⚡ In <b>60 Sekunden</b> startklar</span>
            <span>🔒 Ohne Kreditkarte</span>
          </div>
        </div>

        {/* interactive editorial brief */}
        <div>
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
                  <div className="lp-scan-line"><span className="lp-scan-spin" /> Durchsucht News, LinkedIn und Branchenquellen …</div>
                  <div className="lp-scan-bar"><span /></div>
                  <div className="lp-scan-line" style={{ color: 'var(--ink-3)', fontSize: 13 }}>Gewichtet und sortiert nach Wichtigkeit</div>
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
          <p style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 12.5, marginTop: 14 }}>
            👆 Gib deine eigene Nische ein und sieh, wie dein Briefing entsteht
          </p>
        </div>
      </div>
    </header>
  );
}

/* ────────────────────────── page content ────────────────────────── */

const SOURCE_PILLS = [
  { icon: '📰', label: 'Google News' }, { icon: '🟦', label: 'LinkedIn' },
  { icon: '🏢', label: 'Unternehmensseiten' }, { icon: '📡', label: 'RSS-Feeds' },
  { icon: '🗞️', label: 'Branchen-Newsrooms' }, { icon: '🌍', label: 'DACH & weltweit' },
  { icon: '🤖', label: 'KI-Bewertung' }, { icon: '✈️', label: 'Telegram' }, { icon: '✉️', label: 'E-Mail' },
];

const WITHOUT = [
  'Ein Dutzend offene Tabs, fünf Newsletter und ein Postfach voller nutzloser Alerts.',
  'Stunden im LinkedIn-Feed — und das Wichtige rauscht trotzdem an dir vorbei.',
  'Von der Finanzierungsrunde des Wettbewerbers erfährst du, wenn sie längst alle kennen.',
  'Eine neue Vorschrift trifft dein Geschäft — und du bekommst es viel zu spät mit.',
];
const WITH = [
  'Ein Briefing, nach Wichtigkeit sortiert. Jeden Morgen, pünktlich zum Kaffee.',
  'News, LinkedIn und Branchenquellen automatisch ausgewertet — du liest nur das Ergebnis.',
  'Wichtige Entwicklungen erreichen dich sofort — bevor sie alle anderen kennen.',
  'In jedes Gespräch gehst du bestens vorbereitet, statt dich hinterher zu rechtfertigen.',
];

const FEATURES_TEASER = [
  { icon: '🎯', title: 'Nur das, was zählt', body: 'Die KI hebt hervor, was heute wirklich wichtig ist — und lässt den Rest einfach weg.' },
  { icon: '🛰️', title: 'Alle Quellen, eine Seite', body: 'News, LinkedIn, RSS und Branchen-Newsrooms — automatisch ausgewertet und übersichtlich an einem Ort, statt verstreut über ein Dutzend Tabs.' },
  { icon: '⚔️', title: 'Wettbewerber im Blick', body: 'Beobachte einzelne Unternehmen und erfahre als Erster von Produktstarts, Finanzierungen, Personalwechseln und Expansionen.' },
];

export default function LandingPage() {
  return (
    <LandingLayout>

      <Hero />

      {/* ─── Ohne / Mit (replaces vanity stats) ─── */}
      <section className="lp-section" style={{ paddingTop: 40 }}>
        <div className="lp-wrap">
          <Reveal>
            <span className="lp-kicker">Das eigentliche Problem</span>
            <h2 className="lp-h2">Nicht zu wenig Information ist das Problem.<br />Sondern zu viel.</h2>
          </Reveal>
          <div className="lp-vs">
            <Reveal>
              <div className="lp-vs-card bad">
                <span className="lp-vs-tag">Ohne Nicheletter</span>
                <h3>Du suchst überall — und übersiehst trotzdem das Entscheidende.</h3>
                {WITHOUT.map((r) => (
                  <div key={r} className="lp-vs-row"><span className="ic">✕</span>{r}</div>
                ))}
              </div>
            </Reveal>
            <Reveal delay={90}>
              <div className="lp-vs-card good">
                <span className="lp-vs-tag">Mit Nicheletter</span>
                <h3>Das Wichtige kommt zu dir — schon vorsortiert.</h3>
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
          <span className="lp-kicker">Was du dir sonst aus einem Dutzend Tabs zusammensuchst</span>
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
            <span className="lp-kicker">So einfach geht's</span>
            <h2 className="lp-h2">In unter einer Minute startklar.</h2>
            <p className="lp-lead">Kein Einrichten, kein Filter-Basteln. Du nennst dein Thema — den Rest übernimmt die KI: lesen, gewichten, zusammenfassen.</p>
          </Reveal>
          <div className="lp-steps">
            {[
              { icon: '🎯', title: 'Thema festlegen', body: 'Ein Stichwort genügt: ein Thema wie „Embedded Finance" oder ein Unternehmen wie „Revolut". Dazu der regionale Fokus — DACH, Österreich oder weltweit.' },
              { icon: '✨', title: 'Die KI wertet aus', body: 'Sie durchsucht alle Quellen rund um die Uhr, gewichtet jede Meldung nach Wichtigkeit und fasst Doppeltes zusammen.' },
              { icon: '📬', title: 'Morgens bestens informiert', body: 'Dein Briefing wartet in der App, per Telegram und per E-Mail. Wirklich Dringendes erreicht dich sofort.' },
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
            <span className="lp-kicker">Dein Vorsprung</span>
            <h2 className="lp-h2">Mehr Überblick.<br />In deutlich weniger Zeit.</h2>
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
                Alle Funktionen ansehen →
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
            <h2 className="lp-h2">Starte kostenlos. Wachse, wenn du willst.</h2>
            <p className="lp-lead">Für den Einstieg brauchst du keine Kreditkarte. Wer mehr zahlt, behält einfach mehr Themen gleichzeitig im Blick — keine versteckten Kosten, kein Kleingedrucktes.</p>
          </Reveal>
          <div className="lp-price-grid">
            {[
              { name: 'GRATIS', price: '0 €', per: '', sub: 'Zum Ausprobieren', features: ['1 Thema im Blick', 'Alle Quellen', 'KI-Gewichtung', 'Tägliches Briefing'], cta: 'Kostenlos starten', featured: false },
              { name: 'PLUS', price: '4,99 €', per: '/Mo', sub: 'Für aktive Marktbeobachter', features: ['3 Themen im Blick', 'Push per Telegram', 'Briefing per E-Mail', 'Passt sich dir an'], cta: 'Plus wählen', featured: true },
              { name: 'PRO', price: '9,99 €', per: '/Mo', sub: 'Für den vollen Überblick', features: ['10 Themen im Blick', 'Wettbewerber im Blick', 'Sofort-Benachrichtigung', 'Themen gebündelt'], cta: 'Pro wählen', featured: false },
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
                Zur vollständigen Preisübersicht →
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
                In 30 Sekunden startklar — kostenlos und ohne Kreditkarte.
              </p>
              <SignupCard compact />
            </div>
          </Reveal>
        </div>
      </section>

    </LandingLayout>
  );
}
