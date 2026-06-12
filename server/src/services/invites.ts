import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { user_invites } from '../db/schema';
import { config } from '../config';
import { sendMail } from './mailer';
import { PlanTier, PLAN_LABEL } from '../lib/entitlements';

/**
 * Einladungen: Admin legt eine Einladung an (Plan/Rolle/Bonus vorgemerkt) → der
 * eingeladene Mensch setzt über den Link sein Passwort (/accept-invite). Der Token
 * ist ein zufälliger DB-Datensatz (widerrufbar, einmalig), keine Selbst-Signatur.
 */

const INVITE_TTL_DAYS = 14;

export type InviteRow = typeof user_invites.$inferSelect;

export function inviteAcceptUrl(token: string): string {
  const base = (config.clientUrl || '').replace(/\/+$/, '');
  return `${base}/accept-invite?token=${encodeURIComponent(token)}`;
}

export async function createInvite(opts: {
  email: string;
  role?: string;
  plan?: PlanTier;
  keyword_bonus?: number;
  invited_by?: string | null;
}): Promise<InviteRow> {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires_at = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
  const [row] = await db.insert(user_invites).values({
    email: opts.email.toLowerCase().trim(),
    token,
    role: opts.role === 'admin' ? 'admin' : 'user',
    plan: opts.plan ?? 'free',
    keyword_bonus: Math.max(0, Math.round(opts.keyword_bonus ?? 0)),
    invited_by: opts.invited_by ?? null,
    expires_at,
  }).returning();
  return row;
}

/** Gültige (offene, nicht abgelaufene) Einladung per Token — oder null. */
export async function findValidInvite(token: string): Promise<InviteRow | null> {
  if (!token) return null;
  const [row] = await db.select().from(user_invites).where(eq(user_invites.token, token));
  if (!row || row.accepted_at) return null;
  if (row.expires_at && row.expires_at.getTime() < Date.now()) return null;
  return row;
}

export async function markInviteAccepted(id: string): Promise<void> {
  await db.update(user_invites).set({ accepted_at: new Date() }).where(eq(user_invites.id, id));
}

export async function sendInviteEmail(invite: InviteRow): Promise<void> {
  await sendMail(invite.email, 'Deine Einladung zu Nicheletter.ai', inviteEmailHtml(invite));
}

function inviteEmailHtml(invite: InviteRow): string {
  const url = inviteAcceptUrl(invite.token);
  const planNote = invite.plan === 'free'
    ? 'Du startest im Gratis-Tarif.'
    : `Für dich vorgemerkt: Tarif <b>${PLAN_LABEL[invite.plan]}</b>.`;
  return `<!doctype html><html lang="de"><body style="margin:0;background:#0f1115;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e7e9ee">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <div style="font-size:22px;font-weight:800;letter-spacing:-.5px;margin-bottom:6px">Nicheletter<span style="color:#1d9bf0">.ai</span></div>
    <div style="color:#9aa3b2;font-size:14px;margin-bottom:28px">Deine KI-Aufklärung für Märkte &amp; Wettbewerb</div>
    <div style="background:#171a21;border:1px solid #232733;border-radius:16px;padding:28px">
      <div style="font-size:18px;font-weight:700;margin-bottom:10px">Du wurdest eingeladen 🎉</div>
      <p style="color:#c3c9d4;font-size:15px;line-height:1.55;margin:0 0 18px">
        Lege jetzt dein Konto an und beobachte Themen &amp; Unternehmen — wir sammeln,
        ranken und fassen jedes Signal für dich zusammen. ${planNote}
      </p>
      <a href="${url}" style="display:inline-block;background:#1d9bf0;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:999px">Konto einrichten</a>
      <p style="color:#6b7280;font-size:12.5px;line-height:1.5;margin:20px 0 0">
        Funktioniert der Button nicht, öffne diesen Link:<br>
        <a href="${url}" style="color:#1d9bf0;word-break:break-all">${url}</a><br><br>
        Die Einladung ist 14 Tage gültig.
      </p>
    </div>
  </div></body></html>`;
}
