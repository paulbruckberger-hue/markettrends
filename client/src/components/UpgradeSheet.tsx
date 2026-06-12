import { Icon } from './Icon';
import { apiError } from '../lib/api';
import { useMe } from '../hooks/useAuth';
import { usePlans, useCheckout, usePortal, BillingPlan } from '../hooks/useBilling';
import { PlanTier } from '../types';

/**
 * Wiederverwendbares Upgrade-Sheet. Wird genutzt:
 *  - in den Einstellungen ("Tarif ändern")
 *  - global beim Anstoßen eines Keywords über der Quota (402 → Event nl:upgrade)
 */
export default function UpgradeSheet({ open, onClose, reason }: {
  open: boolean; onClose: () => void; reason?: string;
}) {
  const { data } = usePlans();
  const { data: me } = useMe();
  const checkout = useCheckout();
  const portal = usePortal();

  if (!open) return null;

  const currentPlan: PlanTier = me?.plan ?? 'free';
  const ent = me?.entitlements;
  const plans = data?.plans ?? [];
  const enabled = data?.enabled ?? false;
  const hasSub = !!me?.subscription_status && me.subscription_status !== 'canceled';

  const fmtPrice = (p: BillingPlan) => p.price_eur === 0 ? 'kostenlos' : `€${p.price_eur.toFixed(2).replace('.', ',')}/Mon.`;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9500,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 460, background: 'var(--bg)', border: '1px solid var(--border)',
        borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: '20px 20px calc(22px + env(safe-area-inset-bottom))',
        maxHeight: '88vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: -0.4 }}>Tarif &amp; Keywords</div>
          <button className="press" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', padding: 2 }}>
            <Icon name="close" size={22} />
          </button>
        </div>
        <div style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.5, marginBottom: 16 }}>
          {reason || 'Mehr Keywords gleichzeitig beobachten — jederzeit kündbar.'}
          {ent && (
            <span style={{ display: 'block', marginTop: 4, color: 'var(--text-3)', fontSize: 13 }}>
              Aktuell: {ent.used}/{ent.unlimited ? '∞' : ent.quota} Keywords belegt
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plans.map((p) => {
            const isCurrent = p.id === currentPlan;
            const canBuy = enabled && p.purchasable && !isCurrent;
            return (
              <div key={p.id} style={{
                border: '1.5px solid ' + (isCurrent ? 'var(--accent)' : 'var(--border-strong)'),
                background: isCurrent ? 'var(--accent-soft)' : 'transparent',
                borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 15.5 }}>{p.label}</span>
                    {isCurrent && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)' }}>AKTUELL</span>}
                  </div>
                  <div style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 2 }}>
                    {p.quota} {p.quota === 1 ? 'Keyword' : 'Keywords'} · {fmtPrice(p)}
                  </div>
                </div>
                {isCurrent ? (
                  <Icon name="check" size={20} />
                ) : canBuy ? (
                  <button className="pill pill-accent press" onClick={() => checkout.mutate(p.id)} disabled={checkout.isPending}
                    style={{ padding: '9px 16px', fontSize: 13.5, opacity: checkout.isPending ? 0.6 : 1 }}>
                    {checkout.isPending ? '…' : 'Wählen'}
                  </button>
                ) : p.id !== 'free' && !p.purchasable ? (
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>bald</span>
                ) : null}
              </div>
            );
          })}
        </div>

        {!enabled && (
          <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--rank2) 12%, transparent)', color: 'var(--rank2)', fontSize: 12.5 }}>
            Online-Bezahlung ist noch nicht aktiviert. Bitte wende dich an den Betreiber für eine Freischaltung.
          </div>
        )}
        {checkout.isError && <div style={{ marginTop: 12, color: 'var(--neg)', fontSize: 13 }}>{apiError(checkout.error)}</div>}

        {hasSub && enabled && (
          <button className="press" onClick={() => portal.mutate()} disabled={portal.isPending}
            style={{ marginTop: 14, width: '100%', padding: '11px 0', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
            {portal.isPending ? 'Öffne …' : 'Abo verwalten / kündigen'}
          </button>
        )}
      </div>
    </div>
  );
}
