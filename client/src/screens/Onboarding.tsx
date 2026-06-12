import { useState } from 'react';
import { BrandMark } from '../components/ui';
import { Icon, IconName } from '../components/Icon';
import { useCreateWatch } from '../hooks/useWatchlist';
import { WatchType } from '../types';

const SUGG: { n: string; t: WatchType; c: string }[] = [
  { n: 'Embedded Finance', t: 'topic', c: '#1d9bf0' }, { n: 'KI im Banking', t: 'topic', c: '#7c5cff' },
  { n: 'Instant Payments', t: 'topic', c: '#f59e0b' }, { n: 'Open Banking', t: 'topic', c: '#00ba7c' },
  { n: 'N26', t: 'company', c: '#00ba7c' }, { n: 'Stripe', t: 'company', c: '#635bff' },
  { n: 'Revolut', t: 'company', c: '#7c5cff' }, { n: 'Solaris', t: 'company', c: '#1d3fcc' },
];

export default function Onboarding({ onDone, maxKeywords }: { onDone: () => void; maxKeywords: number | null }) {
  // Auswahl an die Keyword-Quota des Tarifs koppeln: Gratis = 1 → es wird genau
  // ein erstes Thema gewählt (sonst würden überzählige Anlagen später an der
  // Quota scheitern). Unbegrenzt (Admin/Comp) → maxKeywords = null.
  const cap = maxKeywords == null ? Infinity : Math.max(1, maxKeywords);
  const minPick = Math.min(3, Number.isFinite(cap) ? cap : 3);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const create = useCreateWatch();

  const toggle = (n: string) => setPicked((p) => {
    if (p.includes(n)) return p.filter((x) => x !== n);
    if (p.length >= cap) return p;        // Quota erreicht → keine weitere Auswahl
    return [...p, n];
  });

  const finish = async () => {
    setBusy(true);
    try {
      const chosen = SUGG.filter((s) => picked.includes(s.n)).slice(0, Number.isFinite(cap) ? cap : undefined);
      for (const s of chosen) {
        try { await create.mutateAsync({ type: s.t, query: s.n, geo_filter: 'global' }); } catch { /* keep going */ }
      }
    } finally {
      onDone();
    }
  };

  const features: [IconName, string][] = [
    ['search', 'Aus News, LinkedIn, RSS & Newsrooms'],
    ['sparkle', 'KI rankt jedes Signal P1–P3'],
    ['swords', 'Wettbewerbsanalyse für Unternehmen'],
  ];

  return (
    <div className="app-root" style={{ background: 'var(--bg)' }}>
      <div className="scroll" style={{ flex: 1, paddingTop: 70, paddingBottom: 30 }}>
        {step === 0 && (
          <div className="fade-up" style={{ padding: '20px 28px', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ margin: '0 auto 24px' }}><BrandMark size={76} radius={22} /></div>
            <div style={{ fontWeight: 900, fontSize: 29, letterSpacing: -0.8, lineHeight: 1.1 }}>Willkommen bei<br />Nicheletter<span style={{ color: 'var(--accent)' }}>.ai</span></div>
            <div style={{ color: 'var(--text-2)', fontSize: 16, lineHeight: 1.5, maxWidth: 300, margin: '16px auto 0' }}>
              Deine KI-Aufklärung für Märkte & Wettbewerb. Beobachte Themen und Unternehmen — wir sammeln, ranken und fassen jedes Signal zusammen.
            </div>
            <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {features.map(([ic, tx]) => (
                <div key={tx} style={{ display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={ic} size={20} /></div>
                  <span style={{ fontSize: 14.5, color: 'var(--text)' }}>{tx}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="fade-up" style={{ padding: '8px 22px' }}>
            <div style={{ fontWeight: 900, fontSize: 25, letterSpacing: -0.5 }}>Was möchtest du beobachten?</div>
            <div style={{ color: 'var(--text-2)', fontSize: 14.5, marginTop: 8 }}>
              {cap === 1
                ? 'Wähle dein erstes Thema — weitere kannst du später (mit einem höheren Tarif) hinzufügen.'
                : `Wähle ${minPick === 1 ? 'ein Thema' : `mindestens ${minPick}`}${Number.isFinite(cap) ? ` (max. ${cap})` : ''} — du kannst es jederzeit ändern.`}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
              {SUGG.map((s) => {
                const on = picked.includes(s.n);
                return (
                  <button key={s.n} className="press" onClick={() => toggle(s.n)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 15px', borderRadius: 999,
                    border: '1.5px solid ' + (on ? s.c : 'var(--border-strong)'), background: on ? `color-mix(in srgb,${s.c} 14%,transparent)` : 'transparent',
                    color: on ? s.c : 'var(--text)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer',
                  }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: s.c, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>{s.t === 'topic' ? '#' : s.n[0]}</span>
                    {s.n}{on && <Icon name="check" size={15} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="fade-up" style={{ padding: '20px 28px', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'color-mix(in srgb, var(--pos) 18%, transparent)', color: 'var(--pos)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}><Icon name="check" size={42} /></div>
            <div style={{ fontWeight: 900, fontSize: 27, letterSpacing: -0.6 }}>Alles startklar</div>
            <div style={{ color: 'var(--text-2)', fontSize: 15.5, lineHeight: 1.5, maxWidth: 300, margin: '14px auto 0' }}>
              {picked.length || minPick} Beobachtung{(picked.length || minPick) === 1 ? '' : 'en'} {(picked.length || minPick) === 1 ? 'wird' : 'werden'} angelegt. Die erste Aufklärung läuft gleich los — dein Feed füllt sich mit gerankten Signalen.
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '14px 22px calc(20px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 7, justifyContent: 'center', marginBottom: 16 }}>
          {[0, 1, 2].map((i) => <span key={i} style={{ width: i === step ? 22 : 7, height: 7, borderRadius: 999, background: i === step ? 'var(--accent)' : 'var(--border-strong)', transition: 'width .2s' }} />)}
        </div>
        <button className="pill pill-accent press" disabled={(step === 1 && picked.length < minPick) || busy}
          onClick={() => (step < 2 ? setStep(step + 1) : finish())}
          style={{ width: '100%', padding: '15px 0', fontSize: 16, opacity: ((step === 1 && picked.length < minPick) || busy) ? 0.5 : 1 }}>
          {busy ? 'Lege an …' : step === 0 ? 'Los geht’s' : step === 1 ? (picked.length < minPick ? `Noch ${minPick - picked.length} wählen` : 'Weiter') : 'Feed öffnen'}
        </button>
        {step === 0 && <button className="press" onClick={onDone} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 6 }}>Überspringen</button>}
      </div>
    </div>
  );
}
