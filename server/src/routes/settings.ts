import { Router, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { settings, users } from '../db/schema';
import { config } from '../config';
import { authMiddleware, AuthedRequest } from '../middleware/auth';
import { AiModel } from '../services/ai/classifier';
import { testClaude } from '../services/ai/claude';
import { testGemini } from '../services/ai/gemini';
import { testDeepseek } from '../services/ai/deepseek';
import { sendTelegramMessage, telegramEnabled } from '../services/telegram';
import { sendTestEmail } from '../services/newsletter';

export const settingsRouter = Router();
settingsRouter.use(authMiddleware);

async function ensureSettings(userId: string): Promise<typeof settings.$inferSelect> {
  const [existing] = await db.select().from(settings).where(eq(settings.user_id, userId));
  if (existing) return existing;
  const [created] = await db.insert(settings).values({ user_id: userId }).onConflictDoNothing().returning();
  if (created) return created;
  const [again] = await db.select().from(settings).where(eq(settings.user_id, userId));
  return again;
}

// GET /api/settings
settingsRouter.get('/', async (req: AuthedRequest, res: Response) => {
  const st = await ensureSettings(req.user!.id);
  res.json({
    ...st,
    telegram_bot_username: config.telegramBotUsername || null,
    keys: {
      claude: !!config.anthropicApiKey,
      gemini: !!config.geminiApiKey,
      deepseek: !!config.deepseekApiKey,
    },
    smtp_configured: !!(config.smtpHost && config.smtpUser && config.smtpPass),
  });
});

// PUT /api/settings
settingsRouter.put('/', async (req: AuthedRequest, res: Response) => {
  const b = req.body ?? {};
  const patch: Record<string, unknown> = { updated_at: new Date() };

  if (['claude', 'gemini', 'deepseek'].includes(b.ai_model)) patch.ai_model = b.ai_model;
  if (typeof b.ai_model_variant === 'string') patch.ai_model_variant = b.ai_model_variant;
  if (typeof b.notify_rank_1 === 'boolean') patch.notify_rank_1 = b.notify_rank_1;
  if (typeof b.notify_rank_2 === 'boolean') patch.notify_rank_2 = b.notify_rank_2;
  if (typeof b.newsletter_enabled === 'boolean') patch.newsletter_enabled = b.newsletter_enabled;
  if (typeof b.newsletter_email === 'string') patch.newsletter_email = b.newsletter_email;
  if (typeof b.newsletter_day === 'string') patch.newsletter_day = b.newsletter_day;
  if (typeof b.newsletter_time === 'string') patch.newsletter_time = b.newsletter_time;
  if (b.language === 'de' || b.language === 'en') patch.language = b.language;

  await ensureSettings(req.user!.id);
  const [updated] = await db.update(settings).set(patch).where(eq(settings.user_id, req.user!.id)).returning();
  res.json(updated);
});

// POST /api/settings/test-ai
settingsRouter.post('/test-ai', async (req: AuthedRequest, res: Response) => {
  const st = await ensureSettings(req.user!.id);
  const model = (['claude', 'gemini', 'deepseek'].includes(req.body?.model) ? req.body.model : st.ai_model) as AiModel;
  const variant = st.ai_model_variant ?? undefined;
  const result =
    model === 'gemini' ? await testGemini(variant) :
    model === 'deepseek' ? await testDeepseek(variant) :
    await testClaude(variant);
  res.json({ model, ...result });
});

// POST /api/settings/test-telegram
settingsRouter.post('/test-telegram', async (req: AuthedRequest, res: Response) => {
  if (!telegramEnabled()) {
    res.status(400).json({ ok: false, message: 'TELEGRAM_BOT_TOKEN nicht konfiguriert' });
    return;
  }
  const st = await ensureSettings(req.user!.id);
  if (!st.telegram_connected || !st.telegram_chat_id) {
    res.status(400).json({ ok: false, message: 'Telegram noch nicht verbunden' });
    return;
  }
  try {
    await sendTelegramMessage(st.telegram_chat_id, '✅ <b>Test</b> – Telegram-Verbindung funktioniert.');
    res.json({ ok: true, message: 'Test-Nachricht gesendet' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : 'Fehler' });
  }
});

// POST /api/settings/test-email
settingsRouter.post('/test-email', async (req: AuthedRequest, res: Response) => {
  const st = await ensureSettings(req.user!.id);
  const [user] = await db.select().from(users).where(eq(users.id, req.user!.id));
  const target = (typeof req.body?.email === 'string' && req.body.email) || st.newsletter_email || user?.email;
  if (!target) {
    res.status(400).json({ ok: false, message: 'Keine Empfänger-E-Mail hinterlegt' });
    return;
  }
  try {
    await sendTestEmail(target);
    res.json({ ok: true, message: `Test-E-Mail an ${target} gesendet` });
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : 'Fehler' });
  }
});
