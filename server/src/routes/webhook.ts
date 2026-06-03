import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { db } from '../db/client';
import { settings, users } from '../db/schema';
import { sendTelegramMessage } from '../services/telegram';

export const webhookRouter = Router();

// POST /webhook/telegram  (public, secret-verifiziert)
webhookRouter.post('/telegram', async (req: Request, res: Response) => {
  const secret = req.header('x-telegram-bot-api-secret-token');
  if (config.telegramWebhookSecret && secret !== config.telegramWebhookSecret) {
    res.sendStatus(401);
    return;
  }
  res.sendStatus(200); // acknowledge immediately

  try {
    const msg = req.body?.message;
    const text: string = msg?.text ?? '';
    const chatId = msg?.chat?.id;
    if (!chatId || !text.startsWith('/start')) return;

    const payload = text.split(/\s+/)[1]?.trim();
    if (!payload) {
      await sendTelegramMessage(String(chatId), 'Bitte verbinde Telegram über die Markttrends-Scouting-App.');
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, payload));
    if (!user) {
      await sendTelegramMessage(String(chatId), '❌ Ungültiger Verbindungscode.');
      return;
    }

    await db.insert(settings).values({
      user_id: user.id,
      telegram_chat_id: String(chatId),
      telegram_connected: true,
    }).onConflictDoUpdate({
      target: settings.user_id,
      set: { telegram_chat_id: String(chatId), telegram_connected: true, updated_at: new Date() },
    });

    await sendTelegramMessage(String(chatId), '✅ <b>Verbunden!</b> Du erhältst ab jetzt Push-Benachrichtigungen für wichtige Markttrends.');
  } catch (err) {
    console.error('[webhook] telegram error:', err instanceof Error ? err.message : err);
  }
});
