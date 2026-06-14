import LandingLayout, { Reveal, SignupCard } from '../components/LandingLayout';

const FEATURES = [
  { icon: '🛰️', title: 'Alle Quellen, eine Seite', body: 'News, LinkedIn, Unternehmensseiten, RSS und Branchen-Newsrooms — automatisch ausgewertet und übersichtlich an einem Ort, statt verstreut über ein Dutzend Tabs.' },
  { icon: '🧠', title: 'Sortiert nach Wichtigkeit', body: 'Jede Meldung wird gewichtet: kritisch, relevant oder nur Kontext. Die KI hebt hervor, was du heute wissen musst — und lässt den Rest weg.' },
  { icon: '⚔️', title: 'Wettbewerber im Blick', body: 'Beobachte einzelne Unternehmen (etwa „Revolut" oder „N26") und erfahre als Erster von Produktstarts, Finanzierungen, Personalwechseln und Expansionen.' },
  { icon: '👍', title: 'Lernt, was dich interessiert', body: 'Ein Daumen rauf oder runter genügt — dein Briefing wird mit jedem Tag genauer, über alle Kanäle hinweg: App, Telegram und E-Mail.' },
  { icon: '🌐', title: 'Findet, was andere übersehen', body: 'Sucht parallel in fünf Sprachen (Deutsch, Englisch, Französisch, Spanisch, Italienisch) und findet so auch Meldungen, die rein englische Werkzeuge verpassen. Regionaler Fokus auf DACH, Österreich oder weltweit.' },
  { icon: '🚨', title: 'Sofort, wenn es zählt', body: 'Wirklich wichtige Meldungen erreichen dich umgehend per Telegram — der Rest wartet in Ruhe auf dein Morgen-Briefing.' },
  { icon: '🗂️', title: 'Themen automatisch gebündelt', body: 'Verwandte Meldungen werden zu Themensträngen zusammengefasst, damit du den roten Faden siehst statt einzelner Schnipsel. Die Kontrolle behältst du.' },
  { icon: '📊', title: 'Entwicklungen auf einen Blick', body: 'Erkenne, welche Themen gerade an Fahrt gewinnen, wie sich die Nachrichtenlage über die Zeit verändert und welche Art von Ereignissen dominiert.' },
  { icon: '🔗', title: 'Immer mit Quelle', body: 'Jede Meldung verlinkt direkt zum Original — keine undurchsichtige Blackbox. Du kannst jede Einschätzung der KI an der Primärquelle prüfen.' },
];

const SIGNALS = [
  { de: 'Produktstart', color: '#00ba7c', desc: 'Neue Produkte, Funktionen, Releases' },
  { de: 'Expansion', color: '#1d9bf0', desc: 'Neue Märkte, Länder und Segmente' },
  { de: 'Partnerschaft', color: '#7c5cff', desc: 'Kooperationen und Allianzen' },
  { de: 'Finanzierung', color: '#00ba7c', desc: 'Finanzierungsrunden, Börsengänge, Übernahmen' },
  { de: 'Personal', color: '#f59e0b', desc: 'Führungswechsel und Schlüsselrollen' },
  { de: 'Regulierung', color: '#f4212e', desc: 'Gesetze, Aufsicht und Vorgaben' },
  { de: 'Zahlen', color: '#22d3ee', desc: 'Geschäftszahlen, Umsatz und Kennzahlen' },
  { de: 'Allgemein', color: '#8b98a5', desc: 'Weitere relevante Meldungen' },
];

const CHANNELS = [
  {
    icon: '📱', title: 'In der App', color: '#1d9bf0',
    points: ['Sortierter Überblick mit Lesestatus', 'Merken und nach Themen gebündelt', 'Am Desktop und unterwegs'],
  },
  {
    icon: '✈️', title: 'Per Telegram', color: '#7c5cff',
    points: ['Eine Nachricht pro Briefing', '„Mehr dazu" direkt im Chat', 'Bewerten mit 👍/👎, ohne die App zu öffnen'],
  },
  {
    icon: '✉️', title: 'Per E-Mail', color: '#00ba7c',
    points: ['Übersichtlich aufbereitetes Briefing', 'Bewerten mit einem Klick aus der Mail', 'Frequenz frei wählbar — täglich oder wöchentlich'],
  },
];

export default function FeaturesPage() {
  return (
    <LandingLayout>

      {/* page hero */}
      <section className="lp-section" style={{ paddingBottom: 40, textAlign: 'center' }}>
        <div className="lp-wrap">
          <span className="lp-kicker">Funktionen</span>
          <h1 className="lp-h2" style={{ fontSize: 'clamp(36px,5.5vw,62px)', marginTop: 14 }}>
            Alles, um in deiner Nische<br />nichts mehr zu verpassen.
          </h1>
          <p className="lp-lead" style={{ margin: '18px auto 0', textAlign: 'center' }}>
            Nicheletter vereint alle relevanten Quellen, eine mehrsprachige KI und drei
            Zustellwege zu einem Briefing, das sich ganz auf dich einstellt.
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
            <span className="lp-kicker">Da, wo du sowieso bist</span>
            <h2 className="lp-h2">Drei Wege zu dir.<br />Ein Tippen genügt.</h2>
            <p className="lp-lead">Deine Bewertung in einem Kanal verbessert dein Briefing in allen anderen — sofort und ohne Aufwand.</p>
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
                Alle Funktionen. Kostenlos ausprobieren.
              </h2>
              <p className="lp-lead" style={{ margin: '14px auto 26px', textAlign: 'center' }}>
                Heute kostenlos starten — ohne Kreditkarte, ohne Risiko.
              </p>
              <SignupCard compact />
            </div>
          </Reveal>
        </div>
      </section>

    </LandingLayout>
  );
}
