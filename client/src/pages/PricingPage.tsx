import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LandingLayout, { Reveal, SignupCard } from '../components/LandingLayout';

const PLANS = [
  {
    name: 'GRATIS', price: '0 €', per: '', sub: 'Zum Reinschnuppern', featured: false, cta: 'Kostenlos starten',
    features: [
      { yes: true, text: '1 Stichwort beobachten' },
      { yes: true, text: 'Alle 4 Quellen (News, LinkedIn, RSS, Newsroom)' },
      { yes: true, text: 'KI-Ranking P1 · P2 · P3' },
      { yes: true, text: 'Tägliches Briefing in der App' },
      { yes: false, text: 'Telegram-Push' },
      { yes: false, text: 'E-Mail-Newsletter' },
      { yes: false, text: 'Personalisierung per Feedback' },
      { yes: false, text: 'Wettbewerbsanalyse' },
      { yes: false, text: 'Themen-Cluster & Analytics' },
    ],
  },
  {
    name: 'PLUS', price: '4,99 €', per: '/ Monat', sub: 'Für aktive Marktbeobachter', featured: true, cta: 'Plus starten',
    features: [
      { yes: true, text: '3 Stichwörter beobachten' },
      { yes: true, text: 'Alle 4 Quellen' },
      { yes: true, text: 'KI-Ranking P1 · P2 · P3' },
      { yes: true, text: 'Tägliches Briefing in der App' },
      { yes: true, text: 'Telegram-Push mit 👍/👎' },
      { yes: true, text: 'E-Mail-Newsletter' },
      { yes: true, text: 'Personalisierung per Feedback' },
      { yes: false, text: 'Wettbewerbsanalyse' },
      { yes: false, text: 'Themen-Cluster & Analytics' },
    ],
  },
  {
    name: 'PRO', price: '9,99 €', per: '/ Monat', sub: 'Für volle Marktabdeckung', featured: false, cta: 'Pro starten',
    features: [
      { yes: true, text: '10 Stichwörter beobachten' },
      { yes: true, text: 'Alle 4 Quellen' },
      { yes: true, text: 'KI-Ranking P1 · P2 · P3' },
      { yes: true, text: 'Tägliches Briefing in der App' },
      { yes: true, text: 'Telegram-Push mit 👍/👎' },
      { yes: true, text: 'E-Mail-Newsletter' },
      { yes: true, text: 'Personalisierung per Feedback' },
      { yes: true, text: 'Wettbewerbsanalyse' },
      { yes: true, text: 'Themen-Cluster & Analytics' },
    ],
  },
];

const FAQ = [
  { q: 'Brauche ich eine Kreditkarte für den Gratis-Plan?', a: 'Nein. Der Gratis-Plan ist dauerhaft kostenlos und erfordert keine Zahlungsinformationen. Du kannst jederzeit upgraden, wenn du mehr Stichwörter beobachten möchtest.' },
  { q: 'Kann ich jederzeit kündigen?', a: 'Ja, monatlich kündbar — ohne Kündigungsfristen. Dein Plan läuft bis zum Ende des bezahlten Zeitraums und wechselt dann automatisch auf Gratis.' },
  { q: 'Was passiert mit meinen Daten, wenn ich den Plan wechsle?', a: 'Deine Stichwörter, Beobachtungen und Artikel-History bleiben erhalten. Beim Downgrade werden überzählige aktive Stichwörter pausiert (du wählst, welche bleiben).' },
  { q: 'Kann ich auch Unternehmen statt Themen beobachten?', a: 'Ja — Nicheletter unterscheidet zwischen Themen-Keywords (z. B. „Embedded Finance") und Unternehmens-Keywords (z. B. „Revolut"). Die Wettbewerbsanalyse ist ab dem Plus-Plan verfügbar.' },
];

export default function PricingPage() {
  const navigate = useNavigate();

  return (
    <LandingLayout>

      {/* page hero */}
      <section className="lp-section" style={{ paddingBottom: 40, textAlign: 'center' }}>
        <div className="lp-wrap">
          <span className="lp-kicker">Preise</span>
          <h1 className="lp-h2" style={{ fontSize: 'clamp(36px,5.5vw,62px)', marginTop: 14 }}>
            Einfach. Transparent.<br />Kein Kleingedrucktes.
          </h1>
          <p className="lp-lead" style={{ margin: '18px auto 0', textAlign: 'center' }}>
            Starte gratis — keine Kreditkarte nötig. Upgrade, wenn du mehr Stichwörter brauchst.
          </p>
        </div>
      </section>

      {/* pricing cards */}
      <section className="lp-section" style={{ paddingTop: 16 }}>
        <div className="lp-wrap">
          <div className="lp-price-grid">
            {PLANS.map((p, i) => (
              <Reveal key={p.name} delay={i * 90} style={{ display: 'flex' }}>
                <div className={`lp-price${p.featured ? ' feat' : ''}`} style={{ width: '100%' }}>
                  {p.featured && <span className="lp-price-tag">Beliebteste Wahl</span>}
                  <div className="lp-price-name">{p.name}</div>
                  <div className="lp-price-amt">{p.price}<small>{p.per ? ` ${p.per}` : ''}</small></div>
                  <div style={{ color: 'var(--ink-3)', fontSize: 13.5, fontWeight: 600, marginBottom: 18 }}>{p.sub}</div>
                  <ul style={{ marginBottom: 24 }}>
                    {p.features.map((f) => (
                      <li key={f.text} style={{ opacity: f.yes ? 1 : 0.35 }}>
                        <span className="ck" style={{ color: f.yes ? 'var(--acc)' : 'var(--ink-3)' }}>
                          {f.yes ? '✓' : '✕'}
                        </span>
                        {f.text}
                      </li>
                    ))}
                  </ul>
                  <button
                    className={`lp-btn ${p.featured ? 'lp-btn-primary' : 'lp-btn-ghost'}`}
                    style={{ width: '100%', marginTop: 'auto' }}
                    onClick={() => navigate('/register')}>
                    {p.cta}
                  </button>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <p style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 14, marginTop: 24 }}>
              Alle Pläne beinhalten: SSL-Verschlüsselung · DSGVO-konform · Hosted in EU
            </p>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section">
        <div className="lp-wrap">
          <Reveal>
            <span className="lp-kicker">Häufige Fragen</span>
            <h2 className="lp-h2">Alles Wichtige auf einen Blick.</h2>
          </Reveal>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 36 }}>
            {FAQ.map((f, i) => (
              <Reveal key={f.q} delay={i * 60}>
                <FaqItem q={f.q} a={f.a} />
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
                Starte heute kostenlos.
              </h2>
              <p className="lp-lead" style={{ margin: '14px auto 26px', textAlign: 'center' }}>
                Keine Kreditkarte · Keine Kündigungsfalle · Dauerhaft Gratis möglich
              </p>
              <SignupCard compact />
            </div>
          </Reveal>
        </div>
      </section>

    </LandingLayout>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16,
        overflow: 'hidden', transition: 'border-color .2s',
        borderColor: open ? 'var(--line-strong)' : undefined,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--ink)', fontWeight: 700, fontSize: 16, textAlign: 'left', gap: 16,
          fontFamily: 'var(--font)',
        }}
      >
        {q}
        <span style={{
          width: 28, height: 28, borderRadius: '50%', background: 'var(--chip)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, transition: 'transform .2s', transform: open ? 'rotate(45deg)' : 'none',
        }}>+</span>
      </button>
      {open && (
        <div style={{ padding: '0 22px 18px', color: 'var(--ink-2)', fontSize: 15, lineHeight: 1.6 }}>
          {a}
        </div>
      )}
    </div>
  );
}

