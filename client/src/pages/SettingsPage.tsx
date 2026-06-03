import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Mail, Send, XCircle } from 'lucide-react';
import Layout from '../components/Layout';
import { useMe } from '../hooks/useAuth';
import {
  openDigestPreview, useRssSources, useSendDigest, useSettings, useTestAi,
  useTestEmail, useTestTelegram, useToggleRss, useUpdateSettings,
} from '../hooks/useSettings';
import { AiModel } from '../types';
import { apiError } from '../lib/api';
import { formatDateTime } from '../lib/labels';

const DEFAULT_VARIANTS: Record<AiModel, string> = {
  claude: 'claude-sonnet-4-20250514',
  gemini: 'gemini-2.5-flash',
  deepseek: 'deepseek-chat',
};
const DAYS: { v: string; l: string }[] = [
  { v: 'monday', l: 'Montag' }, { v: 'tuesday', l: 'Dienstag' }, { v: 'wednesday', l: 'Mittwoch' },
  { v: 'thursday', l: 'Donnerstag' }, { v: 'friday', l: 'Freitag' }, { v: 'saturday', l: 'Samstag' }, { v: 'sunday', l: 'Sonntag' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900 p-6">
      <h2 className="mb-4 text-base font-semibold text-slate-100">{title}</h2>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-accent-600' : 'bg-ink-700'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${checked ? 'left-[1.4rem]' : 'left-0.5'}`} />
      </button>
      <span className="text-sm text-slate-300">{label}</span>
    </label>
  );
}

function TestBadge({ result }: { result?: { ok: boolean; message: string } }) {
  if (!result) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${result.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
      {result.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {result.message}
    </span>
  );
}

export default function SettingsPage() {
  const { data: me } = useMe();
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();
  const testAi = useTestAi();
  const testTg = useTestTelegram();
  const testMail = useTestEmail();
  const sendDigest = useSendDigest();
  const { data: feeds } = useRssSources();
  const toggleRss = useToggleRss();

  const [aiModel, setAiModel] = useState<AiModel>('claude');
  const [variant, setVariant] = useState('');
  const [notify1, setNotify1] = useState(true);
  const [notify2, setNotify2] = useState(false);
  const [nlEnabled, setNlEnabled] = useState(false);
  const [nlEmail, setNlEmail] = useState('');
  const [nlDay, setNlDay] = useState('monday');
  const [nlTime, setNlTime] = useState('07:00');

  useEffect(() => {
    if (!settings) return;
    setAiModel(settings.ai_model);
    setVariant(settings.ai_model_variant ?? DEFAULT_VARIANTS[settings.ai_model]);
    setNotify1(!!settings.notify_rank_1);
    setNotify2(!!settings.notify_rank_2);
    setNlEnabled(!!settings.newsletter_enabled);
    setNlEmail(settings.newsletter_email ?? '');
    setNlDay(settings.newsletter_day ?? 'monday');
    setNlTime(settings.newsletter_time ?? '07:00');
  }, [settings]);

  const onModelChange = (m: AiModel) => { setAiModel(m); setVariant(DEFAULT_VARIANTS[m]); };

  const save = () => update.mutate({
    ai_model: aiModel, ai_model_variant: variant,
    notify_rank_1: notify1, notify_rank_2: notify2,
    newsletter_enabled: nlEnabled, newsletter_email: nlEmail, newsletter_day: nlDay, newsletter_time: nlTime,
  });

  const tgLink = settings?.telegram_bot_username && me
    ? `https://t.me/${settings.telegram_bot_username}?start=${me.id}`
    : null;

  return (
    <Layout
      title="Einstellungen"
      actions={
        <button onClick={save} disabled={update.isPending}
          className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-500 disabled:opacity-50">
          {update.isPending ? 'Speichern …' : 'Speichern'}
        </button>
      }
    >
      {isLoading && <div className="text-slate-400">Lade …</div>}
      {settings && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* AI MODEL */}
          <Section title="KI-Modell">
            <div className="flex gap-2">
              {(['claude', 'gemini', 'deepseek'] as AiModel[]).map((m) => (
                <button key={m} onClick={() => onModelChange(m)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${aiModel === m ? 'border-accent-500 bg-accent-600/15 text-accent-200' : 'border-ink-700 text-slate-300 hover:bg-ink-800'}`}>
                  {m}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-sm text-slate-400">Variante</label>
            <input value={variant} onChange={(e) => setVariant(e.target.value)} className="select mt-1 w-full" />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Key-Status:{' '}
                <span className={settings.keys[aiModel] ? 'text-emerald-400' : 'text-rose-400'}>
                  {settings.keys[aiModel] ? '● konfiguriert (via Env)' : '● fehlt'}
                </span>
              </span>
              <button onClick={() => testAi.mutate()} disabled={testAi.isPending}
                className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-ink-800">
                {testAi.isPending ? '…' : '🔍 Verbindung testen'}
              </button>
            </div>
            <div className="mt-2"><TestBadge result={testAi.data} />{testAi.isError && <TestBadge result={{ ok: false, message: apiError(testAi.error) }} />}</div>
          </Section>

          {/* TELEGRAM */}
          <Section title="Telegram-Benachrichtigungen">
            <div className="mb-3 text-sm">
              Status:{' '}
              {settings.telegram_connected
                ? <span className="text-emerald-400">● verbunden</span>
                : <span className="text-slate-400">● nicht verbunden</span>}
            </div>
            {!settings.telegram_connected && (
              tgLink
                ? <a href={tgLink} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#229ED9] px-3 py-2 text-sm font-medium text-white hover:opacity-90">
                    <Send size={15} /> Mit Telegram verbinden
                  </a>
                : <p className="text-xs text-amber-400">Bot-Username nicht konfiguriert (TELEGRAM_BOT_USERNAME).</p>
            )}
            <div className="mt-4 space-y-2">
              <Toggle checked={notify1} onChange={setNotify1} label="Push bei Rang 1" />
              <Toggle checked={notify2} onChange={setNotify2} label="Push bei Rang 2" />
            </div>
            {settings.telegram_connected && (
              <button onClick={() => testTg.mutate()} disabled={testTg.isPending}
                className="mt-4 rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-ink-800">
                {testTg.isPending ? '…' : 'Test-Nachricht senden'}
              </button>
            )}
            <div className="mt-2"><TestBadge result={testTg.data} />{testTg.isError && <TestBadge result={{ ok: false, message: apiError(testTg.error) }} />}</div>
          </Section>

          {/* NEWSLETTER */}
          <Section title="Wöchentlicher Newsletter">
            <Toggle checked={nlEnabled} onChange={setNlEnabled} label="Newsletter aktivieren" />
            <label className="mt-4 block text-sm text-slate-400">Empfänger-E-Mail</label>
            <input value={nlEmail} onChange={(e) => setNlEmail(e.target.value)} placeholder="name@firma.com" className="select mt-1 w-full" />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-400">Tag</label>
                <select value={nlDay} onChange={(e) => setNlDay(e.target.value)} className="select mt-1 w-full">
                  {DAYS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400">Uhrzeit</label>
                <input type="time" value={nlTime} onChange={(e) => setNlTime(e.target.value)} className="select mt-1 w-full" />
              </div>
            </div>
            {!settings.smtp_configured && <p className="mt-3 text-xs text-amber-400">SMTP nicht konfiguriert – Versand erst nach Setup möglich.</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button onClick={() => openDigestPreview()} className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-ink-800">Vorschau</button>
              <button onClick={() => sendDigest.mutate()} disabled={sendDigest.isPending}
                className="inline-flex items-center gap-1 rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-ink-800">
                {sendDigest.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Jetzt senden
              </button>
              <button onClick={() => testMail.mutate()} disabled={testMail.isPending}
                className="inline-flex items-center gap-1 rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-ink-800">
                <Mail size={13} /> Test-E-Mail
              </button>
            </div>
            <div className="mt-2 space-y-1">
              {sendDigest.data && <TestBadge result={{ ok: sendDigest.data.sent, message: sendDigest.data.message }} />}
              <TestBadge result={testMail.data} />
              {testMail.isError && <TestBadge result={{ ok: false, message: apiError(testMail.error) }} />}
              {settings.newsletter_last_sent && <div className="text-xs text-slate-500">Zuletzt gesendet: {formatDateTime(settings.newsletter_last_sent)}</div>}
            </div>
          </Section>

          {/* RSS HEALTH */}
          <Section title="RSS-Quellen (Health)">
            <div className="max-h-80 overflow-y-auto pr-1">
              <table className="w-full text-sm">
                <tbody>
                  {feeds?.map((f) => (
                    <tr key={f.id} className="border-b border-ink-800">
                      <td className="py-2">
                        <div className="text-slate-200">{f.name}</div>
                        <div className="text-xs text-slate-500">{f.category}</div>
                        {f.last_error && <div className="text-xs text-rose-400" title={f.last_error}>Fehler beim letzten Abruf</div>}
                      </td>
                      <td className="py-2 text-center">
                        {f.last_error ? <span className="text-rose-400" title={f.last_error}>●</span>
                          : f.last_ok_at ? <span className="text-emerald-400" title={`OK: ${formatDateTime(f.last_ok_at)}`}>●</span>
                          : <span className="text-slate-500">○</span>}
                      </td>
                      <td className="py-2 text-right">
                        <button onClick={() => toggleRss.mutate({ id: f.id, is_active: !f.is_active })}
                          className={`rounded-md px-2 py-1 text-xs ${f.is_active ? 'bg-accent-600/20 text-accent-300' : 'bg-ink-800 text-slate-400'}`}>
                          {f.is_active ? 'aktiv' : 'inaktiv'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

        </div>
      )}
    </Layout>
  );
}
