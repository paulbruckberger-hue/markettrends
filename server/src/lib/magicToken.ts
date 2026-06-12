import crypto from 'crypto';
import { config } from '../config';

/**
 * Signierter, selbst-enthaltener Magic-Login-Token. Gleiches Prinzip wie
 * lib/emailToken.ts: HMAC über (userId, exp) mit JWT_SECRET, keine DB-Lookup
 * zur Validierung. Genutzt für den passwortlosen Web-Login aus dem Telegram-
 * Bot (per-User-Konto entsteht im Chat, der Link öffnet die App).
 */

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}
function sign(payload: string): string {
  return b64url(crypto.createHmac('sha256', config.jwtSecret || 'dev-secret').update(payload).digest());
}

export function signMagicLoginToken(userId: string): string {
  const payload = b64url(Buffer.from(JSON.stringify({ u: userId, e: Date.now() + TTL_MS })));
  return `${payload}.${sign(payload)}`;
}

export function verifyMagicLoginToken(token: string): string | null {
  const [payload, sig] = (token || '').split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(fromB64url(payload).toString('utf-8')) as { u?: string; e?: number };
    if (!obj.u || !obj.e || Date.now() > obj.e) return null;
    return obj.u;
  } catch {
    return null;
  }
}
