import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LandingLayout, { Reveal, SignupCard } from '../components/LandingLayout';

const PLANS = [
  {
    name: 'GRATIS', price: '0 €', per: '', sub: 'Zum Ausprobieren', featured: false, cta: 'Kostenlos starten',
    features: [
      { yes: true, text: '1 Thema im Blick' },
      { yes: true, text: 'Alle Quellen: News, LinkedIn, RSS, Newsrooms' },
      { yes: true, text: 'KI-Gewichtung nach Wichtigkeit' },
      { yes: true, text: 'Tägliches Briefing in der App' },
      { yes: false, text: 'Push per Telegram' },
      { yes: false, text: 'Briefing per E-Mail' },
      { yes: false, text: 'Passt sich dir an' },
      { yes: false, text: 'Wettbewerber im Blick' },
      { yes: false, text: 'Themen gebündelt & Auswertungen' },
    ],
  },
  {
    name: 'PLUS', price: '4,99 €', per: '/ Monat', sub: 'Für aktive Marktbeobachter', featured: true, cta: 'Plus wählen',
    features: [
      { yes: true, text: '3 Themen im Blick' },
      { yes: true, text: 'Alle Quellen' },
      { yes: true, text: 'KI-Gewichtung nach Wichtigkeit' },
      { yes: true, text: 'Tägliches Briefing in der App' },
      { yes: true, text: 'Push per Telegram (mit Bewertung)' },
      { yes: true, text: 'Briefing per E-Mail' },
      { yes: true, text: 'Passt sich dir an' },
      { yes: false, text: 'Wettbewerber im Blick' },
      { yes: false, text: 'Themen gebündelt & Auswertungen' },
    ],
  },
  {
    name: 'PRO', price: '9,99 €', per: '/ Monat', sub: 'Für den vollen Überblick', featured: false, cta: 'Pro wählen',
    features: [
      { yes: true, text: '10 Themen im Blick' },
      { yes: true, text: 'Alle Quellen' },
      { yes: true, text: 'KI-Gewichtung nach Wichtigkeit' },
      { yes: true, text: 'Tägliches Briefing in der App' },
      { yes: true, text: 'Push per Telegram (mit Bewertung)' },
      { yes: true, text: 'Briefing per E-Mail' },
      { yes: true, text: 'Passt sich dir an' },
      { yes: true, text: 'Wettbewerber im Blick' },
      { yes: true, text: 'Themen gebündelt & Auswertungen' },
    ],
  },
];

const FAQ = [
  { q: 'Brauche ich für den Gratis-Tarif eine Kreditkarte?', a: 'Nein. Der Gratis-Tarif ist dauerhaft kostenlos und verlangt keine Zahlungsdaten. Du kannst jederzeit wechseln, wenn du mehr Themen gleichzeitig im Blick behalten möchtest.' },
  { q: 'Kann ich jederzeit kündigen?', a: 'Ja, monatlich kündbar — ohne Frist und ohne Haken. Dein Tarif läuft bis zum Ende des bezahlten Zeitraums und wechselt danach automatisch auf Gratis.' },
  { q: 'Was passiert mit meinen Daten, wenn ich den Tarif wechsle?', a: 'Deine Themen, Beobachtungen und der bisherige Verlauf bleiben erhalten. Wechselst du nach unten, werden überzählige Themen pausiert — du entscheidest, welche aktiv bleiben.' },
  { q: 'Kann ich auch Unternehmen statt Themen beobachten?', a: 'Ja. Nicheletter unterscheidet zwischen Themen (etwa „Embedded Finance") und Unternehmen (etwa „Revolut"). Die Wettbewerber-Beobachtung gibt es ab dem Plus-Tarif.' },
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
            Starte kostenlos — ohne Kreditkarte. Bezahl erst, wenn du mehr Themen gleichzeitig im Blick behalten willst.
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
              In allen Tarifen enthalten: SSL-Verschlüsselung · DSGVO-konform · Server in der EU
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
                Heute kostenlos starten.
              </h2>
              <p className="lp-lead" style={{ margin: '14px auto 26px', textAlign: 'center' }}>
                Ohne Kreditkarte. Ohne Kündigungsfrist. Dauerhaft gratis möglich.
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

