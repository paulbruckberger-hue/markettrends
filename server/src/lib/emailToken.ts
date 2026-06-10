import crypto from 'crypto';
import { config } from '../config';

// Signed, self-contained token for one-click newsletter feedback links. No DB
// lookup needed to validate; the HMAC over (userId, classificationId, exp) with
// JWT_SECRET makes it unforgeable. Direction (up/down) travels as a separate URL
// param — tampering it only changes the user's own vote on their own article.

const TTL_MS = 45 * 24 * 60 * 60 * 1000; // 45 days — newsletters are weekly

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}
function sign(payload: string): string {
  return b64url(crypto.createHmac('sha256', config.jwtSecret || 'dev-secret').update(payload).digest());
}

export function signEmailFeedbackToken(userId: string, classificationId: string): string {
  const payload = b64url(Buffer.from(JSON.stringify({ u: userId, c: classificationId, e: Date.now() + TTL_MS })));
  return `${payload}.${sign(payload)}`;
}

export function verifyEmailFeedbackToken(token: string): { userId: string; classificationId: string } | null {
  const [payload, sig] = (token || '').split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(fromB64url(payload).toString('utf-8')) as { u?: string; c?: string; e?: number };
    if (!obj.u || !obj.c || !obj.e || Date.now() > obj.e) return null;
    return { userId: obj.u, classificationId: obj.c };
  } catch {
    return null;
  }
}
