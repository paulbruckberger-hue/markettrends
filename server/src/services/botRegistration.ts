import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users, settings, bot_sessions } from '../db/schema';
import { config } from '../config';
import { signMagicLoginToken } from '../lib/magicToken';
import { addWatch, QuotaExceededError } from './watchlistService';

/**
 * Kanal-agnostische Registrierung/Erstkonfiguration über einen Messenger.
 * Heute angebunden: Telegram (Zwei-Wege-Bot). Bewusst kanal-offen gebaut, damit
 * eine spätere WhatsApp-Cloud-API-Inbound-Route denselben Kern nutzen kann —
 * sie ruft `handleBotMessage` mit channel='whatsapp' + eigener reply()-Funktion.
 */

export type BotChannel = 'telegram' | 'whatsapp';

export interface BotContext {
  channel: BotChannel;
  chatId: string;
  text: string;
  profile?: { firstName?: string; telegramUserId?: string };
  reply: (html: string) => Promise<void>;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function clientBase(): string {
  return (config.clientUrl || '').replace(/\/+$/, '');
}

// ── Kanal-Verknüpfung (User ↔ Chat) ──────────────────────────────────────────

async function findUserByChannel(channel: BotChannel, chatId: string): Promise<string | null> {
  if (channel === 'telegram') {
    const [st] = await db.select({ user_id: settings.user_id })
      .from(settings).where(eq(settings.telegram_chat_id, chatId));
    return st?.user_id ?? null;
  }
  return null; // WhatsApp-Inbound noch nicht angebunden
}

async function linkChannel(channel: BotChannel, chatId: string, userId: string): Promise<void> {
  if (channel === 'telegram') {
    await db.insert(settings).values({
      user_id: userId,
      telegram_chat_id: chatId,
      telegram_connected: true,
      push_channel: 'telegram',
    }).onConflictDoUpdate({
      target: settings.user_id,
      set: { telegram_chat_id: chatId, telegram_connected: true, push_channel: 'telegram', updated_at: new Date() },
    });
  }
}

// ── Konversationsstatus (bot_sessions) ────────────────────────────────────────

async function getSession(channel: BotChannel, chatId: string) {
  const [s] = await db.select().from(bot_sessions)
    .where(and(eq(bot_sessions.channel, channel), eq(bot_sessions.chat_id, chatId)));
  return s ?? null;
}

async function setSession(channel: BotChannel, chatId: string, step: string, data: Record<string, unknown>): Promise<void> {
  await db.insert(bot_sessions).values({
    channel, chat_id: chatId, step, data,
    expires_at: new Date(Date.now() + 60 * 60 * 1000), // 1h
    updated_at: new Date(),
  }).onConflictDoUpdate({
    target: [bot_sessions.channel, bot_sessions.chat_id],
    set: { step, data, expires_at: new Date(Date.now() + 60 * 60 * 1000), updated_at: new Date() },
  });
}

async function clearSession(channel: BotChannel, chatId: string): Promise<void> {
  await db.delete(bot_sessions)
    .where(and(eq(bot_sessions.channel, channel), eq(bot_sessions.chat_id, chatId)));
}

// ── Registrierung ─────────────────────────────────────────────────────────────

function botUsername(ctx: BotContext): string {
  const id = ctx.profile?.telegramUserId || ctx.chatId;
  return `${ctx.channel === 'telegram' ? 'tg' : 'wa'}_${id}`;
}

async function registerFromBot(ctx: BotContext): Promise<void> {
  const username = botUsername(ctx);
  const password = crypto.randomBytes(24).toString('base64url'); // zufällig; Login per Magic-Link
  const [created] = await db.insert(users).values({
    username,
    password_hash: bcrypt.hashSync(password, 10),
    role: 'user',
    plan: 'free',
    onboarding_completed: true, // Onboarding passiert hier im Chat
  }).onConflictDoNothing({ target: users.username }).returning();

  let userId: string;
  if (created) {
    userId = created.id;
    await db.insert(settings).values({ user_id: created.id }).onConflictDoNothing();
  } else {
    const [u] = await db.select().from(users).where(eq(users.username, username));
    userId = u.id;
  }

  await linkChannel(ctx.channel, ctx.chatId, userId);

  const magic = `${clientBase()}/magic?token=${signMagicLoginToken(userId)}`;
  const hi = ctx.profile?.firstName ? ` ${esc(ctx.profile.firstName)}` : '';
  await ctx.reply(
    `👋 <b>Willkommen bei Nicheletter.ai${hi}!</b>\n\n`
    + `Dein Konto ist startklar — du kannst die App jederzeit ohne Passwort öffnen:\n`
    + `<a href="${magic}">${magic}</a>`,
  );
  await setSession(ctx.channel, ctx.chatId, 'awaiting_keyword', { userId });
  await ctx.reply(
    'Was möchtest du als Erstes beobachten? Schick mir ein <b>Thema</b> '
    + '(z.B. <i>Embedded Finance</i>) oder ein <b>Unternehmen</b> (z.B. <i>N26</i>).',
  );
}

async function addFirstKeyword(ctx: BotContext, userId: string): Promise<void> {
  const kw = ctx.text.replace(/^\/+/, '').trim();
  if (!kw) {
    await ctx.reply('Bitte schick mir ein Thema oder ein Unternehmen, das ich für dich beobachten soll.');
    return;
  }
  try {
    await addWatch(userId, { type: 'topic', query: kw, geo_filter: 'global' }, { enforceQuota: true });
    await clearSession(ctx.channel, ctx.chatId);
    await ctx.reply(
      `✅ <b>${esc(kw)}</b> wird ab jetzt beobachtet. Die erste Aufklärung läuft — `
      + `du bekommst dein Tagesbriefing direkt hier im Chat.`,
    );
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      await clearSession(ctx.channel, ctx.chatId);
      await ctx.reply('Im Gratis-Tarif kannst du 1 Keyword beobachten. Mehr schaltest du in der App frei (Tarif & Abrechnung).');
      return;
    }
    throw err;
  }
}

/** Bereits verknüpfter Chat: Freitext = weiteres Keyword (quota-bewusst). */
async function handleLinkedMessage(ctx: BotContext, userId: string): Promise<void> {
  const t = ctx.text.trim();
  if (!t || t.toLowerCase().startsWith('/start')) {
    await ctx.reply('Du bist verbunden ✅ Schick mir jederzeit ein Thema oder Unternehmen, um es zu beobachten.');
    return;
  }
  const kw = t.replace(/^\/+/, '').trim();
  try {
    await addWatch(userId, { type: 'topic', query: kw, geo_filter: 'global' }, { enforceQuota: true });
    await ctx.reply(`✅ <b>${esc(kw)}</b> wird beobachtet.`);
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      await ctx.reply('Dein Tarif-Limit für Keywords ist erreicht. In der App kannst du upgraden (Tarif & Abrechnung).');
      return;
    }
    throw err;
  }
}

/** Einstieg für eingehende Bot-Nachrichten (kanal-agnostisch). */
export async function handleBotMessage(ctx: BotContext): Promise<void> {
  const linkedUserId = await findUserByChannel(ctx.channel, ctx.chatId);
  if (linkedUserId) {
    await handleLinkedMessage(ctx, linkedUserId);
    return;
  }
  const session = await getSession(ctx.channel, ctx.chatId);
  if (session?.step === 'awaiting_keyword') {
    const userId = (session.data as { userId?: string } | null)?.userId;
    if (userId) {
      await addFirstKeyword(ctx, userId);
      return;
    }
  }
  // Erstkontakt (oder abgelaufene Session) → Konto anlegen
  await registerFromBot(ctx);
}
