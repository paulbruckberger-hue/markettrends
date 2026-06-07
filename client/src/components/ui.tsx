import { CSSProperties, ReactNode, useId } from 'react';
import { Icon, IconName } from './Icon';
import {
  DisplayItem, RANK_META, SIGNAL_META, SRC_KIND_LABEL, SourceIdentity,
} from '../lib/presenter';
import { SignalType } from '../types';

export interface ItemActions {
  read: (item: DisplayItem, force?: boolean) => void;
  bookmark: (item: DisplayItem) => void;
  feedback: (item: DisplayItem, dir: 'up' | 'down') => void;
  share: (item: DisplayItem) => void;
  open: (item: DisplayItem) => void;
  more: (item: DisplayItem) => void;
}

// ─────────────────────────────── Avatar / brand ───────────────────────────────
export function Avatar({ source, size = 44 }: { source: SourceIdentity; size?: number }) {
  const isLi = source.kind === 'linkedin_post' || source.kind === 'linkedin_company';
  const corner = isLi ? 'in' : (source.kind === 'google_news' ? 'G' : source.kind === 'newsroom' ? '◆' : '∿');
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%', background: source.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 800, fontSize: size * 0.36, letterSpacing: -0.5,
      }}>{source.glyph}</div>
      <div style={{
        position: 'absolute', right: -2, bottom: -2, width: size * 0.42, height: size * 0.42,
        borderRadius: '50%', background: isLi ? '#0a66c2' : 'var(--bg)',
        border: '2px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: isLi ? '#fff' : 'var(--text-2)', fontSize: size * 0.2, fontWeight: 800,
      }}>{corner}</div>
    </div>
  );
}

export function UserCircle({ name, size = 34 }: { name: string; size?: number }) {
  const initial = (name || '?').trim()[0]?.toUpperCase() || '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: 'var(--accent)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.42, flexShrink: 0,
    }}>{initial}</div>
  );
}

export function Verified({ size = 16, color = 'var(--accent)' }: { size?: number; color?: string }) {
  return <span style={{ color, display: 'inline-flex', flexShrink: 0 }}><Icon name="verified" size={size} /></span>;
}

export function BrandGlyph({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  const sw = Math.max(1.5, size * 0.075);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', color }} aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="3.2" fill="none" stroke="currentColor" strokeWidth={sw} />
      <path d="M4.5 8.2 L12 13.3 L19.5 8.2" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18.6" cy="6.4" r="2.7" fill="var(--accent)" stroke="var(--bg)" strokeWidth={size * 0.06} />
    </svg>
  );
}

export function BrandMark({ size = 28, radius }: { size?: number; radius?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: radius != null ? radius : size * 0.28,
      background: 'var(--accent-soft)', border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--accent)',
    }}>
      <BrandGlyph size={size * 0.62} />
    </div>
  );
}

export function BrandWord({ size = 19 }: { size?: number }) {
  return (
    <span style={{ fontWeight: 800, fontSize: size, letterSpacing: -0.7, color: 'var(--text)' }}>
      Nicheletter<span style={{ color: 'var(--accent)' }}>.ai</span>
    </span>
  );
}

// ─────────────────────────────── Badges ───────────────────────────────
export function RankBadge({ rank, size = 'md' }: { rank: number; size?: 'sm' | 'md' }) {
  const m = RANK_META[rank] ?? RANK_META[3];
  const sm = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: sm ? '1px 7px 1px 6px' : '3px 9px 3px 7px', borderRadius: 999,
      background: `color-mix(in srgb, ${m.color} 15%, transparent)`,
      color: m.color, fontWeight: 800, fontSize: sm ? 11 : 12.5, lineHeight: 1.3, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: sm ? 6 : 7, height: sm ? 6 : 7, borderRadius: '50%', background: m.color }} />
      {m.tag}<span style={{ opacity: 0.85, fontWeight: 700 }}> · {m.de}</span>
    </span>
  );
}

export function SignalBadge({ signal, sm = false }: { signal: SignalType | null; sm?: boolean }) {
  if (!signal) return null;
  const s = SIGNAL_META[signal];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: sm ? '1px 7px' : '3px 9px', borderRadius: 999,
      border: `1px solid color-mix(in srgb, ${s.color} 35%, transparent)`,
      color: s.color, fontWeight: 700, fontSize: sm ? 11 : 12.5, lineHeight: 1.3, whiteSpace: 'nowrap',
    }}>{s.de}</span>
  );
}

export function WatchChipMini({ name, color }: { name: string; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-3)', fontSize: 12.5, fontWeight: 600 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />{name}
    </span>
  );
}

export function SentimentDot({ sentiment }: { sentiment: string | null }) {
  const c = sentiment === 'positive' ? 'var(--pos)' : sentiment === 'negative' ? 'var(--neg)' : 'var(--neu)';
  const label = sentiment === 'positive' ? 'Positiv' : sentiment === 'negative' ? 'Negativ' : 'Neutral';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-3)', fontSize: 12.5 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />{label}
    </span>
  );
}

function SourceKind({ src }: { src: SourceIdentity }) {
  return (
    <span style={{ color: 'var(--text-3)', fontSize: 12.5 }}>
      {SRC_KIND_LABEL[src.kind] || src.kind}{src.role ? ' · ' + src.role : ''}
    </span>
  );
}

// ─────────────────────────────── Action bar ───────────────────────────────
export function ActBtn({ name, filled, label, active, color, onClick, tint }: {
  name: IconName; filled?: boolean; label?: ReactNode; active?: boolean;
  color?: string; onClick?: () => void; tint?: string;
}) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick && onClick(); }} className="press" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
      color: active ? (color || 'var(--accent)') : 'var(--text-2)', cursor: 'pointer', padding: 0,
      fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
    }}>
      <span style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .12s', background: 'transparent' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = tint || 'var(--accent-soft)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
        <Icon name={name} size={18} filled={filled} />
      </span>
      {label != null && <span>{label}</span>}
    </button>
  );
}

export function ActionBar({ item, on }: { item: DisplayItem; on: ItemActions }) {
  const fb = item.feedback;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, maxWidth: 340 }}>
      <ActBtn name="thumbUp" filled={fb === 'up'} active={fb === 'up'} color="var(--pos)" tint="color-mix(in srgb, var(--pos) 16%, transparent)" label="Relevant" onClick={() => on.feedback(item, 'up')} />
      <ActBtn name="thumbDown" filled={fb === 'down'} active={fb === 'down'} color="var(--neg)" tint="color-mix(in srgb, var(--neg) 16%, transparent)" onClick={() => on.feedback(item, 'down')} />
      <ActBtn name="bookmark" filled={item.bookmarked} active={item.bookmarked} onClick={() => on.bookmark(item)} />
      <ActBtn name="share" onClick={() => on.share(item)} />
      <ActBtn name={item.read ? 'eye' : 'eyeOff'} active={item.read} color="var(--text-2)" tint="var(--hover)" onClick={() => on.read(item)} />
    </div>
  );
}

function OpenArticleBtn({ item, on }: { item: DisplayItem; on: ItemActions }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); on.open(item); }} className="press" style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 10, padding: '7px 13px',
      borderRadius: 999, border: '1px solid var(--border-strong)', background: 'transparent',
      color: 'var(--accent)', fontWeight: 700, fontSize: 13, cursor: 'pointer', maxWidth: '100%',
    }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-soft)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
      <Icon name="external" size={15} />
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Artikel öffnen · {item.url}</span>
    </button>
  );
}

function EngagementRow({ e }: { e: DisplayItem['engagement'] }) {
  if (!e) return null;
  const Stat = ({ icon, n }: { icon: IconName; n: number }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-3)', fontSize: 12.5, fontWeight: 600 }}>
      <Icon name={icon} size={14} /> {n}
    </span>
  );
  return (
    <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
      <Stat icon="heart" n={e.likes} />
      <Stat icon="comment" n={e.comments} />
      <Stat icon="repeat" n={e.shares} />
    </div>
  );
}

function FeedHeaderLine({ item, compact }: { item: DisplayItem; compact?: boolean }) {
  const s = item.source;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flexWrap: 'nowrap' }}>
      <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: compact ? 14 : 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: compact ? 120 : 160 }}>{s.name}</span>
      {s.verified && <Verified size={compact ? 14 : 16} />}
      <span style={{ color: 'var(--text-3)', fontSize: compact ? 13 : 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>@{s.handle}</span>
      <span style={{ color: 'var(--text-3)', fontSize: compact ? 13 : 14 }}>· {item.time}</span>
    </div>
  );
}

// ─────────────────────────────── Feed card (3 variants) ───────────────────────────────
export function FeedCard({ item, variant = 'standard', on, onOpen }: {
  item: DisplayItem; variant?: string; on: ItemActions; onOpen: (i: DisplayItem) => void;
}) {
  const src = item.source;
  const dim = item.read ? 0.55 : 1;
  const rc = RANK_META[item.rank]?.color ?? 'var(--rank3)';

  if (variant === 'kompakt') {
    return (
      <div className="press" onClick={() => onOpen(item)} style={{
        display: 'flex', gap: 10, padding: '11px 16px', borderBottom: '1px solid var(--border)',
        alignItems: 'center', opacity: dim, background: 'transparent',
      }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: rc, flexShrink: 0 }} />
        <Avatar source={src} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>{src.name}</span>
            <span style={{ color: 'var(--text-3)', fontSize: 12.5 }}>· {item.time}</span>
            <SignalBadge signal={item.signal} sm />
          </div>
          <div className="clamp2" style={{ fontSize: 14, color: 'var(--text)', marginTop: 2, lineHeight: 1.35, fontWeight: 500 }}>{item.title}</div>
        </div>
        {item.bookmarked && <span style={{ color: 'var(--accent)' }}><Icon name="bookmark" size={16} filled /></span>}
      </div>
    );
  }

  if (variant === 'karte') {
    return (
      <div className="fade-up" style={{ padding: '8px 12px' }}>
        <div className="press" onClick={() => onOpen(item)} style={{
          position: 'relative', borderRadius: 'var(--r-card)', background: 'var(--raise)',
          border: '1px solid var(--border)', overflow: 'hidden', opacity: dim,
        }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: rc }} />
          <div style={{ padding: '13px 15px 13px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
              <Avatar source={src} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <FeedHeaderLine item={item} compact />
                <div style={{ marginTop: 1 }}><SourceKind src={src} /></div>
              </div>
              <RankBadge rank={item.rank} size="sm" />
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <SignalBadge signal={item.signal} sm />
              <WatchChipMini name={item.watchName} color={item.watchColor} />
            </div>
            <div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.3, color: 'var(--text)', letterSpacing: -0.2 }}>{item.title}</div>
            <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {item.summary.slice(0, 2).map((b, i) => (
                <li key={i} style={{ display: 'flex', gap: 7, fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.4 }}>
                  <span style={{ color: rc, flexShrink: 0 }}>•</span><span>{b}</span>
                </li>
              ))}
            </ul>
            <OpenArticleBtn item={item} on={on} />
            <EngagementRow e={item.engagement} />
            <div style={{ marginTop: 4 }}><ActionBar item={item} on={on} /></div>
          </div>
        </div>
      </div>
    );
  }

  // STANDARD (X timeline row)
  return (
    <div className="press" onClick={() => onOpen(item)} style={{
      display: 'flex', gap: 11, padding: '12px 16px 6px', borderBottom: '1px solid var(--border)',
      opacity: dim, background: 'transparent',
    }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
      <Avatar source={src} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <FeedHeaderLine item={item} />
            <SourceKind src={src} />
          </div>
          <button className="iconbtn" style={{ width: 30, height: 30, marginRight: -6, marginTop: -4 }}
            onClick={(e) => { e.stopPropagation(); on.more(item); }}>
            <Icon name="more" size={17} style={{ color: 'var(--text-3)' }} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0 8px', flexWrap: 'wrap' }}>
          <RankBadge rank={item.rank} />
          <SignalBadge signal={item.signal} />
          <WatchChipMini name={item.watchName} color={item.watchColor} />
        </div>

        <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3, color: 'var(--text)', letterSpacing: -0.2 }}>{item.title}</div>

        <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {item.summary.map((b, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.45 }}>
              <span style={{ color: rc, flexShrink: 0, fontWeight: 700 }}>•</span><span>{b}</span>
            </li>
          ))}
        </ul>

        {item.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 9 }}>
            {item.tags.map((t) => <span key={t} style={{ color: 'var(--accent)', fontSize: 13.5, fontWeight: 500 }}>#{t}</span>)}
          </div>
        )}

        <OpenArticleBtn item={item} on={on} />
        <EngagementRow e={item.engagement} />
        <ActionBar item={item} on={on} />
      </div>
    </div>
  );
}

// ─────────────────────────────── Bars / chrome ───────────────────────────────
export function TopBar({ children, sub }: { children?: ReactNode; sub?: ReactNode }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 30, paddingTop: 'max(10px, env(safe-area-inset-top))',
      background: 'var(--bar-blur)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderBottom: sub ? 'none' : '1px solid var(--border)',
    }}>
      {children}
      {sub}
    </div>
  );
}

export function DetailBar({ title, back, right }: { title: string; back: () => void; right?: ReactNode }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 30, paddingTop: 'max(8px, env(safe-area-inset-top))',
      background: 'var(--bar-blur)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '6px 8px 10px' }}>
        <button className="iconbtn" onClick={back}><Icon name="back" size={22} /></button>
        <span style={{ fontWeight: 800, fontSize: 18, flex: 1 }}>{title}</span>
        {right}
      </div>
    </div>
  );
}

export interface TabDef { key: string; label: string; count?: number }
export function Tabs({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (k: string) => void }) {
  return (
    <div style={{ display: 'flex', position: 'relative', borderBottom: '1px solid var(--border)' }}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button key={t.key} className="press" onClick={() => onChange(t.key)} style={{
            flex: 1, padding: '14px 0 13px', background: 'none', border: 'none', cursor: 'pointer',
            position: 'relative', color: on ? 'var(--text)' : 'var(--text-2)', fontWeight: on ? 800 : 600, fontSize: 14.5,
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {t.label}
              {t.count != null && t.count > 0 && (
                <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 800, minWidth: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{t.count}</span>
              )}
            </span>
            {on && <span style={{ position: 'absolute', bottom: -1, left: '50%', transform: 'translateX(-50%)', width: 40, height: 4, borderRadius: 999, background: 'var(--accent)' }} />}
          </button>
        );
      })}
    </div>
  );
}

export function BottomNav({ active, onNav, onCompose, unread }: {
  active: string; onNav: (k: string) => void; onCompose: () => void; unread: number;
}) {
  const items: { key: string; icon: IconName; fab?: boolean; badge?: number }[] = [
    { key: 'feed', icon: 'home' },
    { key: 'explore', icon: 'search' },
    { key: 'compose', icon: 'compose', fab: true },
    { key: 'watchlist', icon: 'watchlist', badge: unread },
    { key: 'analytics', icon: 'analytics' },
  ];
  return (
    <div style={{
      position: 'relative', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      padding: '6px 8px calc(10px + env(safe-area-inset-bottom))', background: 'var(--bar-blur)',
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderTop: '1px solid var(--border)',
    }}>
      {items.map((it) => {
        if (it.fab) {
          return (
            <button key={it.key} className="press" onClick={onCompose} style={{
              width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer',
              boxShadow: '0 6px 18px color-mix(in srgb, var(--accent) 45%, transparent)', marginTop: -6,
            }}><Icon name="plus" size={26} /></button>
          );
        }
        const on = it.key === active;
        return (
          <button key={it.key} className="press" onClick={() => onNav(it.key)} style={{
            position: 'relative', width: 50, height: 44, background: 'none', border: 'none', cursor: 'pointer',
            color: on ? 'var(--text)' : 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={it.icon} size={26} filled={on} />
            {!!it.badge && it.badge > 0 && (
              <span style={{ position: 'absolute', top: 2, right: 8, minWidth: 16, height: 16, padding: '0 4px', background: 'var(--accent)', color: '#fff', borderRadius: 999, fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}>{it.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function FilterChip({ active, onClick, label, dot }: { active: boolean; onClick: () => void; label: string; dot?: string }) {
  return (
    <button className="press" onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 999, whiteSpace: 'nowrap',
      border: '1px solid ' + (active ? 'transparent' : 'var(--border-strong)'),
      background: active ? 'var(--text)' : 'transparent', color: active ? 'var(--bg)' : 'var(--text)',
      fontWeight: 700, fontSize: 13.5, cursor: 'pointer', flexShrink: 0,
    }}>
      {dot && <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot }} />}
      {label}
    </button>
  );
}

export function Empty({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <div style={{ padding: '54px 32px', textAlign: 'center' }}>
      <div style={{ color: 'var(--text-3)', display: 'flex', justifyContent: 'center', marginBottom: 14 }}><Icon name={icon} size={40} /></div>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>{title}</div>
      <div style={{ color: 'var(--text-2)', fontSize: 14.5, lineHeight: 1.5, maxWidth: 260, margin: '0 auto' }}>{body}</div>
    </div>
  );
}

export function Toast({ msg }: { msg: string }) {
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 96, transform: 'translateX(-50%)', zIndex: 95,
      background: 'var(--accent)', color: '#fff', padding: '11px 18px', borderRadius: 999,
      fontWeight: 700, fontSize: 13.5, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', animation: 'pop .2s', whiteSpace: 'nowrap',
      display: 'inline-flex', alignItems: 'center', gap: 8,
    }}>
      <Icon name="check" size={16} /> {msg}
    </div>
  );
}

export function Spinner({ size = 28 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `${Math.max(2, size * 0.1)}px solid var(--border)`, borderTopColor: 'var(--accent)',
      animation: 'spin .8s linear infinite',
    }} />
  );
}

export function Metric({ n, label }: { n: number; label: string }) {
  return (
    <span style={{ fontSize: 13.5, color: 'var(--text-2)' }}>
      <b className="tabular" style={{ color: 'var(--text)', fontWeight: 800 }}>{n}</b> {label}
    </span>
  );
}

// ─────────────────────────────── Charts ───────────────────────────────
export function Sparkline({ data, color = 'var(--accent)', w = 80, h = 26, fill = true }: {
  data: number[]; color?: string; w?: number; h?: number; fill?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  if (!data.length) return <svg width={w} height={h} />;
  const max = Math.max(...data), min = Math.min(...data);
  const rng = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1 || 1)) * w, h - ((v - min) / rng) * (h - 3) - 1.5]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = line + ` L${w} ${h} L0 ${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={color} stopOpacity="0.28" /><stop offset="1" stopColor={color} stopOpacity="0" />
      </linearGradient></defs>
      {fill && <path d={area} fill={`url(#${id})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BarsMini({ data, color = 'var(--accent)', h = 90 }: { data: number[]; color?: string; h?: number }) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: h }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, height: `${(v / max) * 100}%`, minHeight: 3, background: color, borderRadius: 3, opacity: 0.45 + 0.55 * (v / max) }} />
      ))}
    </div>
  );
}

export function Donut({ segments, size = 120, thickness = 18, center }: {
  segments: { value: number; color: string }[]; size?: number; thickness?: number; center?: ReactNode;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color}
              strokeWidth={thickness} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} strokeLinecap="butt" />
          );
          off += len;
          return el;
        })}
      </svg>
      {center && <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>{center}</div>}
    </div>
  );
}

export function BarRow({ label, value, max, color = 'var(--accent)', suffix }: {
  label: string; value: number; max: number; color?: string; suffix?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 96, flexShrink: 0, fontSize: 13, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ flex: 1, height: 8, background: 'var(--chip)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(value / (max || 1)) * 100}%`, background: color, borderRadius: 999 }} />
      </div>
      <div className="tabular" style={{ width: 32, textAlign: 'right', fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{suffix || value}</div>
    </div>
  );
}

export function Delta({ v, size = 12.5 }: { v: number; size?: number }) {
  const up = v >= 0;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: up ? 'var(--pos)' : 'var(--neg)', fontSize: size, fontWeight: 700 }}>
      <Icon name={up ? 'arrowUp' : 'arrowDown'} size={size + 1} /> {Math.abs(v)}%
    </span>
  );
}

export function Panel({ title, action, children, pad = 16, style }: {
  title?: ReactNode; action?: ReactNode; children: ReactNode; pad?: number; style?: CSSProperties;
}) {
  return (
    <div style={{ background: 'var(--raise)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', overflow: 'hidden', ...style }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px 9px' }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>{title}</div>
          {action}
        </div>
      )}
      <div style={{ padding: title ? `0 ${pad}px ${pad}px` : pad }}>{children}</div>
    </div>
  );
}

export function StatCard({ icon, label, value, delta, color }: {
  icon: IconName; label: string; value: ReactNode; delta?: number; color?: string;
}) {
  return (
    <div style={{ background: 'var(--raise)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-2)' }}>
        <span style={{ color: color || 'var(--text-2)' }}><Icon name={icon} size={16} /></span>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
        <span className="tabular" style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>{value}</span>
        {delta != null && <Delta v={delta} />}
      </div>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div style={{ padding: '14px 16px 6px', fontSize: 12.5, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{children}</div>;
}

export function Chevron() { return <Icon name="chevron" size={18} style={{ color: 'var(--text-3)' }} />; }
