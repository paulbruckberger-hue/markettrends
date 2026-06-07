import { usePatchArticle } from './useArticles';
import { ItemActions } from '../components/ui';

/** Wires the X-style triage actions to the real per-article API (optimistic). */
export function useItemActions(flash: (msg: string) => void): ItemActions {
  const patch = usePatchArticle();
  return {
    read: (item, force) =>
      patch.mutate({ id: item.id, patch: { is_read: force ? true : !item.read } }),
    bookmark: (item) => {
      const v = !item.bookmarked;
      patch.mutate({ id: item.id, patch: { is_bookmarked: v } });
      flash(v ? 'Gespeichert' : 'Aus Lesezeichen entfernt');
    },
    feedback: (item, dir) => {
      const v = item.feedback === dir ? null : dir;
      patch.mutate({ id: item.id, patch: { user_feedback: v } });
      flash(v === 'up' ? 'Als relevant markiert · KI lernt mit'
        : v === 'down' ? 'Weniger davon · KI lernt mit'
          : 'Feedback entfernt');
    },
    share: (item) => {
      navigator.clipboard?.writeText(item.href).catch(() => undefined);
      flash('Link kopiert');
    },
    open: (item) => { window.open(item.href, '_blank', 'noopener,noreferrer'); },
    more: () => undefined,
  };
}
