import LandingLayout, { Reveal, SignupCard } from '../components/LandingLayout';

const FEATURES = [
  { icon: '🛰️', title: 'Alle Quellen, eine Seite', body: 'Google News, LinkedIn Posts & Company Pages, RSS-Feeds und Branchen-Newsrooms — automatisch gelesen, dedupliziert und an einem Ort statt in zehn Tabs.' },
  { icon: '🧠', title: 'Sortiert nach Wichtigkeit', body: 'Jede Meldung wird bewertet: kritisch, relevant oder nur Kontext. Die KI hebt hervor, was du heute wissen musst, und blendet das Rauschen aus.' },
  { icon: '⚔️', title: 'Behalte Konkurrenten im Blick', body: 'Beobachte konkrete Unternehmen (z. B. „Revolut", „N26") und erfahre zuerst von Produktstarts, Funding-Runden, Personalwechseln und Expansion.' },
  { icon: '👍', title: 'Lernt, was dich interessiert', body: 'Ein Daumen rauf oder runter genügt — dein Briefing passt sich sofort an, in jedem Kanal: App, Telegram und E-Mail.' },
  { icon: '🌐', title: 'Findet, was andere übersehen', body: 'Sucht parallel in fünf Sprachen (DE, EN, FR, ES, IT) und findet so auch Meldungen, die rein englische Tools verpassen. Geo-Fokus auf DACH, Österreich oder global.' },
  { icon: '🚨', title: 'Sofort-Alerts bei Kritischem', body: 'Wirklich wichtige Meldungen erreichen dich sofort per Telegram-Push — der Rest wartet aufs kuratierte Morgen-Briefing.' },
  { icon: '🗂️', title: 'Themen automatisch gebündelt', body: 'Die KI gruppiert verwandte Meldungen zu Themen-Strängen, damit du den roten Faden siehst statt Einzelmeldungen. Du behältst die Kontrolle.' },
  { icon: '📊', title: 'Trends auf einen Blick', body: 'Sieh, welche Themen gerade an Fahrt gewinnen, wie sich die Nachrichtendichte über die Zeit entwickelt und welche Art von Ereignissen dominiert.' },
  { icon: '🔗', title: 'Immer mit Quelle', body: 'Jede Meldung verlinkt direkt zur Originalquelle — keine Blackbox. Du kannst jede KI-Einschätzung gegen die Primärquelle prüfen.' },
];

const SIGNALS = [
  { de: 'Produktstart', color: '#00ba7c', desc: 'Neue Produkte, Features, Releases' },
  { de: 'Expansion', color: '#1d9bf0', desc: 'Neue Märkte, Länder, Segmente' },
  { de: 'Partnerschaft', color: '#7c5cff', desc: 'Joint Ventures, Kooperationen' },
  { de: 'Finanzierung', color: '#00ba7c', desc: 'Funding-Runden, IPO, M&A' },
  { de: 'Personal', color: '#f59e0b', desc: 'C-Level-Wechsel, Neueinstellungen' },
  { de: 'Regulatorik', color: '#f4212e', desc: 'Gesetze, Aufsicht, Compliance' },
  { de: 'Zahlen', color: '#22d3ee', desc: 'Quartalsberichte, Umsatz, KPIs' },
  { de: 'Allgemein', color: '#8b98a5', desc: 'Sonstige relevante Meldungen' },
];

const CHANNELS = [
  {
    icon: '📱', title: 'In-App-Feed', color: '#1d9bf0',
    points: ['Gerankter Stream mit Lese-Status', 'Bookmarks & Themen-Cluster', 'Desktop (3-Spalten) und Mobile'],
  },
  {
    icon: '✈️', title: 'Telegram', color: '#7c5cff',
    points: ['Push pro kuratiertem Tagesbriefing', '„Mehr Infos" Button direkt im Chat', '👍/👎 Feedback ohne App-Öffnen'],
  },
  {
    icon: '✉️', title: 'E-Mail-Newsletter', color: '#00ba7c',
    points: ['KI-kuratierter HTML-Newsletter', '1-Klick-Feedback aus der Mail', 'Takt wählbar (täglich/wöchentlich)'],
  },
];

export default function FeaturesPage() {
  return (
    <LandingLayout>

      {/* page hero */}
      <section className="lp-section" style={{ paddingBottom: 40, textAlign: 'center' }}>
        <div className="lp-wrap">
          <span className="lp-kicker">Features</span>
          <h1 className="lp-h2" style={{ fontSize: 'clamp(36px,5.5vw,62px)', marginTop: 14 }}>
            Alles, was du für echte<br />Marktintelligenz brauchst.
          </h1>
          <p className="lp-lead" style={{ margin: '18px auto 0', textAlign: 'center' }}>
            Nicheletter kombiniert 4 Quellen, mehrsprachige KI und drei Zustellkanäle
            zu einem durchgehend personalisiertem Briefing.
          </p>
        </div>
      </section>

      {/* feature grid */}
      <section className="lp-section" style={{ paddingTop: 16 }}>
        <div className="lp-wrap">
          <div className="lp-feat-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 70}>
                <div className="lp-feat">
                  <div className="lp-feat-ico">{f.icon}</div>
                  <h4>{f.title}</h4>
                  <p>{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* signal types */}
      <section className="lp-section">
        <div className="lp-wrap">
          <Reveal>
            <span className="lp-kicker">Automatisch erkannt</span>
            <h2 className="lp-h2">Du siehst sofort, <em className="lp-em-serif">was</em> passiert ist.</h2>
            <p className="lp-lead">
              Die KI erkennt nicht nur, wie wichtig eine Meldung ist, sondern auch die Art des Ereignisses —
              so weißt du auf einen Blick, ob es um Geld, ein Produkt oder eine neue Regel geht.
            </p>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14, marginTop: 32 }}>
            {SIGNALS.map((s, i) => (
              <Reveal key={s.de} delay={i * 50}>
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 18px',
                  background: 'var(--surface)', border: `1px solid color-mix(in srgb,${s.color} 35%,transparent)`,
                  borderRadius: 16,
                }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0, marginTop: 5 }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: s.color }}>{s.de}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 3 }}>{s.desc}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* channels */}
      <section className="lp-section">
        <div className="lp-wrap">
          <Reveal>
            <span className="lp-kicker">Zugestellt, wo du bist</span>
            <h2 className="lp-h2">Drei Kanäle, ein 👍/👎 lernt mit.</h2>
            <p className="lp-lead">Dein Feedback in einem Kanal verbessert dein Ranking in allen anderen — sofort, ohne manuelles Reranking.</p>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18, marginTop: 36 }}>
            {CHANNELS.map((ch, i) => (
              <Reveal key={ch.title} delay={i * 80}>
                <div style={{
                  background: 'var(--surface)', border: `1px solid color-mix(in srgb,${ch.color} 30%,transparent)`,
                  borderRadius: 22, padding: '26px 24px',
                  boxShadow: `0 16px 48px color-mix(in srgb,${ch.color} 12%,transparent)`,
                }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 15, fontSize: 26, marginBottom: 16,
                    background: `color-mix(in srgb,${ch.color} 16%,transparent)`,
                    border: `1px solid color-mix(in srgb,${ch.color} 35%,transparent)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{ch.icon}</div>
                  <h3 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 14px', color: ch.color }}>{ch.title}</h3>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {ch.points.map((pt) => (
                      <li key={pt} style={{ display: 'flex', gap: 9, fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.45 }}>
                        <span style={{ color: ch.color, fontWeight: 900, flexShrink: 0 }}>✓</span>{pt}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-section" style={{ paddingTop: 16 }}>
        <div className="lp-wrap">
          <Reveal>
            <div className="lp-cta">
              <h2 className="lp-h2" style={{ maxWidth: 640, margin: '0 auto' }}>
                Alle Features. Kostenlos ausprobieren.
              </h2>
              <p className="lp-lead" style={{ margin: '14px auto 26px', textAlign: 'center' }}>
                Starte heute gratis — kein Kreditkarte, kein Risiko.
              </p>
              <SignupCard compact />
            </div>
          </Reveal>
        </div>
      </section>

    </LandingLayout>
  );
}
