import { useEffect, useState } from 'react';
import {
  ActBtn, Avatar, DetailBar, FeedCard, ItemActions, Metric, RankBadge,
  SentimentDot, SignalBadge, Verified,
} from '../components/ui';
import { Icon } from '../components/Icon';
import { DisplayItem, RANK_META, SRC_KIND_LABEL, toDisplayItem } from '../lib/presenter';
import { flattenFeed, useFeed } from '../hooks/useArticles';

type Nav = (name: string, params?: Record<string, unknown>) => void;

export default function DetailScreen({ item, actions, nav, back }: {
  item: DisplayItem; actions: ItemActions; nav: Nav; back: () => void;
}) {
  const src = item.source;
  const rc = RANK_META[item.rank]?.color ?? 'var(--rank3)';

  // Local state mirror so the detail view reacts to feedback/bookmark instantly.
  const [st, setSt] = useState({ read: item.read, bookmarked: item.bookmarked, feedback: item.feedback });

  useEffect(() => {
    if (!item.read) { actions.read(item, true); setSt((s) => ({ ...s, read: true })); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFeedback = (dir: 'up' | 'down') => {
    const next = st.feedback === dir ? null : dir;
    actions.feedback({ ...item, feedback: st.feedback }, dir);
    setSt((s) => ({ ...s, feedback: next }));
  };
  const onBookmark = () => {
    actions.bookmark({ ...item, bookmarked: st.bookmarked });
    setSt((s) => ({ ...s, bookmarked: !s.bookmarked }));
  };

  const { data } = useFeed({ watch_item_id: item.watchId });
  const related = flattenFeed(data).map(toDisplayItem).filter((x) => x.id !== item.id).slice(0, 3);

  return (
    <>
      <DetailBar title="Signal" back={back} />
      <div style={{ paddingBottom: 28 }}>
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <Avatar source={src} size={48} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontWeight: 800, fontSize: 15.5 }}>{src.name}</span>
                {src.verified && <Verified size={16} />}
              </div>
              <div style={{ color: 'var(--text-3)', fontSize: 13.5 }}>@{src.handle} · {SRC_KIND_LABEL[src.kind]}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '14px 0 12px' }}>
            <RankBadge rank={item.rank} />
            <SignalBadge signal={item.signal} />
            <SentimentDot sentiment={item.sentiment} />
          </div>

          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.28, letterSpacing: -0.4 }}>{item.title}</div>

          <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {item.summary.map((b, i) => (
              <li key={i} style={{ display: 'flex', gap: 10, fontSize: 16, color: 'var(--text)', lineHeight: 1.5 }}>
                <span style={{ color: rc, fontWeight: 800, flexShrink: 0 }}>•</span><span>{b}</span>
              </li>
            ))}
          </ul>

          {item.reason && (
            <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: `color-mix(in srgb, ${rc} 9%, transparent)`, border: `1px solid color-mix(in srgb, ${rc} 25%, transparent)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <span style={{ color: rc }}><Icon name="sparkle" size={15} /></span>
                <span style={{ fontWeight: 800, fontSize: 12.5, textTransform: 'uppercase', letterSpacing: 0.4, color: rc }}>Warum es zählt · KI-Einordnung</span>
              </div>
              <div style={{ fontSize: 14.5, color: 'var(--text)', lineHeight: 1.5 }}>{item.reason}</div>
            </div>
          )}

          {item.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 14 }}>
              {item.tags.map((t) => <span key={t} style={{ color: 'var(--accent)', fontSize: 14.5, fontWeight: 500 }}>#{t}</span>)}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 16, color: 'var(--text-3)', fontSize: 13.5, flexWrap: 'wrap' }}>
            <Icon name="clock" size={14} /> {item.date}
            <span>·</span><span>Quelle: {src.name}</span>
            <span>·</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: item.watchColor }} />{item.watchName}</span>
          </div>

          {item.engagement && (
            <div style={{ marginTop: 14, padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 22 }}>
              <Metric n={item.engagement.likes} label="Reaktionen" />
              <Metric n={item.engagement.comments} label="Kommentare" />
              <Metric n={item.engagement.shares} label="Geteilt" />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 8px', borderBottom: '1px solid var(--border)', margin: '6px 8px 0' }}>
          <ActBtn name="thumbUp" filled={st.feedback === 'up'} active={st.feedback === 'up'} color="var(--pos)" tint="color-mix(in srgb, var(--pos) 16%, transparent)" onClick={() => onFeedback('up')} />
          <ActBtn name="thumbDown" filled={st.feedback === 'down'} active={st.feedback === 'down'} color="var(--neg)" tint="color-mix(in srgb, var(--neg) 16%, transparent)" onClick={() => onFeedback('down')} />
          <ActBtn name="bookmark" filled={st.bookmarked} active={st.bookmarked} onClick={onBookmark} />
          <ActBtn name="share" onClick={() => actions.share(item)} />
        </div>

        <div style={{ padding: '12px 16px', color: 'var(--text-3)', fontSize: 12.5, display: 'flex', gap: 7, alignItems: 'center' }}>
          <Icon name="sparkle" size={13} />
          {st.feedback === 'up' ? 'Danke — die KI priorisiert ähnliche Signale höher.'
            : st.feedback === 'down' ? 'Verstanden — ähnliche Signale werden seltener gezeigt.'
              : 'Gib Feedback, damit die KI deine Relevanz besser lernt.'}
        </div>

        <div style={{ padding: '4px 16px 8px' }}>
          <button className="pill pill-accent press" onClick={() => actions.open(item)} style={{ width: '100%', padding: '13px 0', fontSize: 15 }}>
            <Icon name="external" size={17} /> Quelle öffnen · {item.url}
          </button>
        </div>

        {related.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ padding: '10px 16px 4px', fontWeight: 800, fontSize: 15 }}>Mehr zu {item.watchName}</div>
            {related.map((r) => (
              <FeedCard key={r.id} item={r} variant="kompakt" on={actions} onOpen={(x) => nav('detail', { item: x })} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
