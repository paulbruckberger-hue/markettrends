import { useState } from 'react';
import { Icon } from './Icon';
import { Spinner } from './ui';
import { useWatchlist } from '../hooks/useWatchlist';
import {
  useApplySuggestion, useAssignWatches, useClusters, useCreateCluster,
  useDeleteCluster, useSuggestClusters, useUpdateCluster,
} from '../hooks/useClusters';
import { NewsletterCluster, SuggestedCluster, WatchItem } from '../types';

const WEEKDAYS: { k: string; label: string }[] = [
  { k: 'monday', label: 'Mo' }, { k: 'tuesday', label: 'Di' }, { k: 'wednesday', label: 'Mi' },
  { k: 'thursday', label: 'Do' }, { k: 'friday', label: 'Fr' }, { k: 'saturday', label: 'Sa' }, { k: 'sunday', label: 'So' },
];
const PALETTE = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#84CC16'];

function Pill({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button className="press" onClick={onClick} style={{
      padding: '6px 11px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
      border: '1px solid ' + (active ? (color ?? 'var(--accent)') : 'var(--border-strong)'),
      background: active ? (color ? color + '22' : 'var(--accent-soft)') : 'transparent',
      color: active ? (color ?? 'var(--accent)') : 'var(--text-2)',
    }}>{children}</button>
  );
}

export default function ClusterManager({ flash }: { flash?: (m: string) => void }) {
  const { data, isLoading } = useClusters();
  const { data: watches } = useWatchlist();
  const create = useCreateCluster();
  const update = useUpdateCluster();
  const del = useDeleteCluster();
  const assign = useAssignWatches();
  const suggest = useSuggestClusters();
  const apply = useApplySuggestion();

  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedCluster[] | null>(null);

  const clusters = data?.clusters ?? [];
  const activeWatches = (watches ?? []).filter((w) => w.is_active);
  const nameOf = (id: string) => activeWatches.find((w) => w.id === id)?.display_name ?? '—';

  const runSuggest = async () => {
    try {
      const s = await suggest.mutateAsync();
      if (s.length === 0) { flash?.('Zu wenige Beobachtungen für einen Vorschlag'); return; }
      setSuggestions(s);
    } catch { flash?.('Vorschlag fehlgeschlagen'); }
  };
  const applySuggestions = async () => {
    if (!suggestions) return;
    try { await apply.mutateAsync(suggestions); setSuggestions(null); flash?.('Cluster übernommen'); }
    catch { flash?.('Übernehmen fehlgeschlagen'); }
  };

  const addCluster = async () => {
    const name = newName.trim();
    if (!name) return;
    await create.mutateAsync({ name, color: PALETTE[clusters.length % PALETTE.length] });
    setNewName('');
  };
  const toggleMember = (cluster: NewsletterCluster, w: WatchItem) => {
    const isMember = w.cluster_id === cluster.id;
    assign.mutate({ cluster_id: isMember ? null : cluster.id, watch_item_ids: [w.id] });
  };

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>;

  const unassigned = activeWatches.filter((w) => !w.cluster_id);

  return (
    <div style={{ padding: '8px 16px 32px', maxWidth: 640, margin: '0 auto' }}>
      <p style={{ fontSize: 13.5, color: 'var(--text-3)', lineHeight: 1.5, margin: '4px 0 14px' }}>
        Fasse deine Beobachtungen zu Themen-Clustern zusammen. Im Newsletter bekommt jeder Cluster einen eigenen
        Abschnitt. Cluster mit „Eigene Mail" werden separat in ihrem eigenen Rhythmus verschickt.
      </p>

      {/* KI-Vorschlag */}
      <button className="press" onClick={runSuggest} disabled={suggest.isPending} style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center',
        padding: '11px', borderRadius: 12, border: '1px solid var(--accent)', background: 'var(--accent-soft)',
        color: 'var(--accent)', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 12,
      }}>
        <Icon name="sparkle" size={17} />
        {suggest.isPending ? 'KI denkt nach …' : 'KI-Vorschlag für Cluster'}
      </button>

      {suggestions && (
        <div style={{ border: '1px solid var(--accent)', borderRadius: 12, padding: 14, marginBottom: 16, background: 'var(--accent-soft)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Vorschlag der KI</div>
          {suggestions.map((s, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{s.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>· {s.member_ids.length} Keywords</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 17 }}>{s.member_ids.map(nameOf).join(', ')}</div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="press" onClick={applySuggestions} disabled={apply.isPending} style={{
              flex: 1, padding: '9px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>{apply.isPending ? 'Übernehme …' : 'Übernehmen'}</button>
            <button className="press" onClick={() => setSuggestions(null)} style={{
              padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-2)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>Verwerfen</button>
          </div>
        </div>
      )}

      {/* Neuer Cluster */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Neuer Cluster (z.B. Wettbewerber AT)"
          onKeyDown={(e) => { if (e.key === 'Enter') addCluster(); }}
          style={{ flex: 1, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text)', borderRadius: 10, padding: '9px 12px', fontSize: 14 }} />
        <button className="press" onClick={addCluster} disabled={!newName.trim() || create.isPending} style={{
          padding: '0 14px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
        }}><Icon name="plus" size={16} /></button>
      </div>

      {/* Cluster-Liste */}
      {clusters.map((c) => {
        const members = activeWatches.filter((w) => w.cluster_id === c.id);
        const isOpen = expanded === c.id;
        return (
          <div key={c.id} style={{ border: '1px solid var(--border-strong)', borderRadius: 14, padding: 14, marginBottom: 12 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: c.color ?? '#3B82F6', flexShrink: 0 }} />
              {editId === c.id ? (
                <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => { if (editName.trim()) update.mutate({ id: c.id, name: editName.trim() }); setEditId(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { if (editName.trim()) update.mutate({ id: c.id, name: editName.trim() }); setEditId(null); } }}
                  style={{ flex: 1, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--text)', borderRadius: 8, padding: '5px 9px', fontSize: 15, fontWeight: 700 }} />
              ) : (
                <button className="press" onClick={() => { setEditId(c.id); setEditName(c.name); }} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', color: 'var(--text)', fontSize: 15, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                  {c.name}
                </button>
              )}
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{members.length}</span>
              <button className="press" onClick={() => { if (confirm(`Cluster „${c.name}" löschen? Die Keywords bleiben erhalten.`)) del.mutate(c.id); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 4 }}>
                <Icon name="trash" size={16} />
              </button>
            </div>

            {/* Farbauswahl */}
            <div style={{ display: 'flex', gap: 7, margin: '11px 0 12px', flexWrap: 'wrap' }}>
              {PALETTE.map((col) => (
                <button key={col} className="press" onClick={() => update.mutate({ id: c.id, color: col })} style={{
                  width: 22, height: 22, borderRadius: '50%', background: col, cursor: 'pointer',
                  border: (c.color === col ? '2px solid var(--text)' : '2px solid transparent'),
                }} />
              ))}
            </div>

            {/* Versand */}
            <div style={{ display: 'flex', gap: 7, marginBottom: 8, flexWrap: 'wrap' }}>
              <Pill active={c.delivery === 'combined'} onClick={() => update.mutate({ id: c.id, delivery: 'combined' })}>
                <Icon name="mail" size={13} /> In Sammelmail
              </Pill>
              <Pill active={c.delivery === 'separate'} onClick={() => update.mutate({ id: c.id, delivery: 'separate' })}>
                <Icon name="bell" size={13} /> Eigene Mail
              </Pill>
            </div>

            {/* Rhythmus nur bei separater Mail */}
            {c.delivery === 'separate' && (
              <div style={{ marginBottom: 10, paddingLeft: 2 }}>
                <div style={{ display: 'flex', gap: 7, marginBottom: 8 }}>
                  <Pill active={c.cadence === 'weekly'} onClick={() => update.mutate({ id: c.id, cadence: 'weekly' })}>Wöchentlich</Pill>
                  <Pill active={c.cadence === 'daily'} onClick={() => update.mutate({ id: c.id, cadence: 'daily' })}>Täglich</Pill>
                </div>
                {c.cadence === 'weekly' && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {WEEKDAYS.map((d) => (
                      <button key={d.k} className="press" onClick={() => update.mutate({ id: c.id, day: d.k })} style={{
                        width: 34, height: 30, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        border: '1px solid ' + ((c.day ?? 'monday') === d.k ? 'var(--accent)' : 'var(--border-strong)'),
                        background: (c.day ?? 'monday') === d.k ? 'var(--accent-soft)' : 'transparent',
                        color: (c.day ?? 'monday') === d.k ? 'var(--accent)' : 'var(--text-2)',
                      }}>{d.label}</button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Keywords */}
            <button className="press" onClick={() => setExpanded(isOpen ? null : c.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '4px 0',
            }}>
              <Icon name={isOpen ? 'chevron' : 'plus'} size={15} /> Keywords zuordnen ({members.length})
            </button>
            {!isOpen && members.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {members.map((w) => (
                  <span key={w.id} style={{ fontSize: 12, padding: '3px 9px', borderRadius: 999, background: 'var(--hover)', color: 'var(--text-2)' }}>{w.display_name}</span>
                ))}
              </div>
            )}
            {isOpen && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {activeWatches.length === 0 && <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Noch keine Beobachtungen.</span>}
                {activeWatches.map((w) => {
                  const member = w.cluster_id === c.id;
                  const elsewhere = w.cluster_id && w.cluster_id !== c.id;
                  return (
                    <button key={w.id} className="press" onClick={() => toggleMember(c, w)} style={{
                      fontSize: 12.5, padding: '5px 10px', borderRadius: 999, cursor: 'pointer',
                      border: '1px solid ' + (member ? (c.color ?? 'var(--accent)') : 'var(--border-strong)'),
                      background: member ? (c.color ?? '#3B82F6') + '22' : 'transparent',
                      color: member ? (c.color ?? 'var(--accent)') : elsewhere ? 'var(--text-3)' : 'var(--text-2)',
                    }}>
                      {member ? '✓ ' : ''}{w.display_name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {clusters.length === 0 && !suggestions && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-3)', fontSize: 13.5 }}>
          Noch keine Cluster. Leg einen an oder lass dir von der KI welche vorschlagen.
        </div>
      )}

      {/* Nicht zugeordnet */}
      {unassigned.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>
            Nicht zugeordnet ({unassigned.length}) · landen im Sammelabschnitt „Übrige"
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {unassigned.map((w) => (
              <span key={w.id} style={{ fontSize: 12.5, padding: '4px 10px', borderRadius: 999, border: '1px dashed var(--border-strong)', color: 'var(--text-3)' }}>{w.display_name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
