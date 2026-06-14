import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LandingLayout, { Reveal, SignupCard } from '../components/LandingLayout';

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

function DemoCard({ item }: { item: Item }) {
  const r = RANK[item.rank];
  return (
    <div className="lp-card fade-up">
      <div className="lp-cardrow" style={{ justifyContent: 'space-between' }}>
        <div className="lp-cardrow">
          <div className="lp-avatar" style={{ background: item.src.color }}>{item.src.glyph}</div>
          <span className="lp-badge" style={{ background: `color-mix(in srgb,${r.color} 16%,transparent)`, color: r.color }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.color }} />{r.tag} · {r.de}
          </span>
        </div>
        <span className="lp-chip" style={{ background: `color-mix(in srgb,${item.sigColor} 16%,transparent)`, color: item.sigColor }}>{item.signal}</span>
      </div>
      <div className="lp-card-title">{item.title}</div>
      <div className="lp-card-meta">{item.src.name} · {item.time}</div>
    </div>
  );
}

function genResults(term: string): Item[] {
  const t = term.trim();
  return [
    { rank: 1, signal: 'Finanzierung', sigColor: '#00ba7c', title: `${t}-Anbieter sichert sich Millionen-Finanzierung — die Runde ist deutlich überzeichnet`, src: SRC.news, time: 'vor 1 Std' },
    { rank: 1, signal: 'Regulierung', sigColor: '#f4212e', title: `Neue EU-Vorgabe trifft ${t}-Anbieter — Anpassung bis Anfang 2026 nötig`, src: SRC.room, time: 'vor 4 Std' },
    { rank: 2, signal: 'Produktstart', sigColor: '#00ba7c', title: `Marktführer kündigt eine große ${t}-Produktoffensive an`, src: SRC.li, time: 'vor 6 Std' },
  ];
}

const STEPS_DETAIL = [
  {
    num: 1, icon: '🎯', title: 'Thema festlegen', color: '#1d9bf0',
    points: [
      'Ein Thema oder Unternehmen als Stichwort anlegen (etwa „Embedded Finance" oder „Revolut")',
      'Regionalen Fokus wählen: weltweit, DACH oder Österreich',
      'Mehrere Themen gleichzeitig beobachten (je nach Tarif)',
    ],
  },
  {
    num: 2, icon: '✨', title: 'Die KI wertet aus', color: '#7c5cff',
    points: [
      'Durchsucht rund um die Uhr News, LinkedIn, RSS und Branchen-Newsrooms',
      'Gewichtet jede Meldung: kritisch, relevant oder nur Kontext',
      'Ordnet sie nach Art des Ereignisses ein: Finanzierung, Produktstart, Regulierung, Personal …',
      'Führt dieselbe Meldung aus mehreren Quellen zu einer zusammen',
    ],
  },
  {
    num: 3, icon: '📬', title: 'Morgens informiert', color: '#00ba7c',
    points: [
      'Einmal täglich ein kuratiertes Briefing — in der App, per Telegram und per E-Mail',
      'Wirklich Dringendes erreicht dich sofort per Benachrichtigung',
      'Mit 👍/👎 wird dein Briefing von Tag zu Tag genauer',
      'Frequenz frei wählbar — täglich oder wöchentlich',
    ],
  },
];

export default function HowItWorksPage() {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [items, setItems] = useState<Item[]>([]);

  const run = (e?: FormEvent) => {
    e?.preventDefault();
    const t = term.trim() || 'Quantum Computing';
    if (!term.trim()) setTerm(t);
    setState('loading');
    window.setTimeout(() => { setItems(genResults(t)); setState('done'); }, 1100);
  };

  return (
    <LandingLayout>

      {/* page hero */}
      <section className="lp-section" style={{ paddingBottom: 40, textAlign: 'center' }}>
        <div className="lp-wrap">
          <span className="lp-kicker">So funktioniert's</span>
          <h1 className="lp-h2" style={{ fontSize: 'clamp(36px,5.5vw,62px)', marginTop: 14 }}>
            In unter einer Minute<br />vom Stichwort zum Briefing.
          </h1>
          <p className="lp-lead" style={{ margin: '18px auto 0', textAlign: 'center' }}>
            Kein Einrichten, kein Filter-Basteln. Du nennst dein Thema —
            den Rest übernimmt die KI: aufspüren, gewichten, zusammenfassen.
          </p>
        </div>
      </section>

      {/* detailed steps */}
      <section className="lp-section" style={{ paddingTop: 16 }}>
        <div className="lp-wrap">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {STEPS_DETAIL.map((s, i) => (
              <Reveal key={s.num} delay={i * 80}>
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 22,
                  padding: '28px 32px', display: 'grid', gridTemplateColumns: '60px 1fr', gap: 24, alignItems: 'start',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 16, fontSize: 26,
                      background: `color-mix(in srgb, ${s.color} 16%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${s.color} 35%, transparent)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                    }}>{s.icon}</div>
                    <div style={{ width: 2, height: i < STEPS_DETAIL.length - 1 ? 36 : 0, background: 'var(--line)', margin: '10px auto 0' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: s.color, letterSpacing: 1, marginBottom: 6 }}>SCHRITT {s.num}</div>
                    <h3 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 14px', letterSpacing: -0.4 }}>{s.title}</h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                      {s.points.map((pt) => (
                        <li key={pt} style={{ display: 'flex', gap: 10, color: 'var(--ink-2)', fontSize: 15, lineHeight: 1.5 }}>
                          <span style={{ color: s.color, fontWeight: 900, flexShrink: 0, marginTop: 2 }}>✓</span>{pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* interactive demo */}
      <section className="lp-section" style={{ paddingTop: 16 }}>
        <div className="lp-wrap">
          <Reveal>
            <div className="lp-try">
              <span className="lp-kicker">Gleich ausprobieren</span>
              <h2 className="lp-h2" style={{ fontSize: 'clamp(24px,3.2vw,38px)' }}>
                Gib deine Nische ein — und sieh, was reinkommt.
              </h2>
              <p style={{ color: 'var(--ink-2)', fontSize: 15, marginTop: 10 }}>
                Vorschau · dein echtes Briefing bekommst du nach der kostenlosen Anmeldung.
              </p>
              <form className="lp-try-bar" onSubmit={run}>
                <input className="lp-field" style={{ flex: 1 }} value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="z. B. Embedded Finance, Defense Tech, Wasserstoff …" />
                <button type="submit" className="lp-btn lp-btn-primary" style={{ padding: '13px 24px' }}>
                  {state === 'loading' ? 'KI liest Quellen …' : 'Briefing erstellen'}
                </button>
              </form>

              {state === 'loading' && (
                <div className="lp-try-results">
                  {[0, 1, 2].map((i) => <div key={i} className="lp-shimmer" />)}
                </div>
              )}
              {state === 'done' && (
                <>
                  <div className="lp-try-results">
                    {items.map((it, i) => <DemoCard key={i} item={{ ...it, rank: it.rank as Rank }} />)}
                  </div>
                  <div style={{ textAlign: 'center', marginTop: 22 }}>
                    <button className="lp-btn lp-btn-primary" style={{ padding: '13px 26px' }}
                      onClick={() => navigate('/register')}>
                      „{term.trim()}" jetzt dauerhaft beobachten →
                    </button>
                  </div>
                </>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-section" style={{ paddingTop: 16 }}>
        <div className="lp-wrap">
          <Reveal>
            <div className="lp-cta">
              <h2 className="lp-h2" style={{ maxWidth: 600, margin: '0 auto' }}>
                Bereit, deine Nische im Blick zu behalten?
              </h2>
              <p className="lp-lead" style={{ margin: '14px auto 26px', textAlign: 'center' }}>
                Jetzt kostenlos starten — ohne Kreditkarte.
              </p>
              <SignupCard compact />
            </div>
          </Reveal>
        </div>
      </section>

    </LandingLayout>
  );
}
