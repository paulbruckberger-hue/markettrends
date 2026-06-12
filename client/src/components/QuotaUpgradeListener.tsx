import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import UpgradeSheet from './UpgradeSheet';

/**
 * Global gemountet (in beiden Shells). Öffnet das Upgrade-Sheet, wenn ein
 * Keyword-Anlegen an der Quota scheitert (useCreateWatch sendet bei 402 das
 * Event `nl:upgrade`), und frischt nach Stripe-Rückkehr (?billing=success) die
 * Daten auf.
 */
export default function QuotaUpgradeListener() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>(undefined);

  useEffect(() => {
    const onUpgrade = (e: Event) => {
      setReason((e as CustomEvent<string>).detail || undefined);
      setOpen(true);
    };
    window.addEventListener('nl:upgrade', onUpgrade as EventListener);
    return () => window.removeEventListener('nl:upgrade', onUpgrade as EventListener);
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const b = p.get('billing');
    if (!b) return;
    if (b === 'success') {
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['watchlist'] });
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
    }
    p.delete('billing');
    window.history.replaceState({}, '', window.location.pathname + (p.toString() ? `?${p}` : ''));
  }, [qc]);

  return <UpgradeSheet open={open} onClose={() => setOpen(false)} reason={reason} />;
}
