import { Router, Request, Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { classifications, user_article_state, watch_items } from '../db/schema';
import { config } from '../config';
import { verifyEmailFeedbackToken } from '../lib/emailToken';
import { repersonalizeUserTerm } from '../services/personalize';

// Public, token-authenticated one-click feedback from newsletter mails.
export const emailFeedbackRouter = Router();

// POST /api/feedback/email  { token, v: 'up'|'down' }
emailFeedbackRouter.post('/email', async (req: Request, res: Response) => {
  const dir = req.body?.v === 'down' ? 'down' : req.body?.v === 'up' ? 'up' : null;
  if (!dir) { res.status(400).json({ ok: false, message: 'Ungültige Richtung.' }); return; }

  const decoded = verifyEmailFeedbackToken(req.body?.token);
  if (!decoded) { res.status(401).json({ ok: false, message: 'Link ungültig oder abgelaufen.' }); return; }

  // Defense in depth: the user must still subscribe to this classification's term.
  const [allowed] = await db.select({ term: classifications.search_term_id })
    .from(classifications)
    .innerJoin(watch_items, eq(watch_items.search_term_id, classifications.search_term_id))
    .where(and(eq(classifications.id, decoded.classificationId), eq(watch_items.user_id, decoded.userId)))
    .limit(1);
  if (!allowed) { res.status(404).json({ ok: false, message: 'Meldung nicht mehr verfügbar.' }); return; }

  // Same unified column + immediate-learning path as in-app and Telegram.
  await db.insert(user_article_state).values({
    user_id: decoded.userId,
    classification_id: decoded.classificationId,
    user_feedback: dir,
  }).onConflictDoUpdate({
    target: [user_article_state.user_id, user_article_state.classification_id],
    set: { user_feedback: dir, updated_at: new Date() },
  });

  try {
    await repersonalizeUserTerm(decoded.userId, allowed.term);
  } catch (err) {
    console.error('[feedback/email] repersonalize failed:', err instanceof Error ? err.message : err);
  }

  res.json({
    ok: true,
    message: dir === 'up'
      ? '👍 Als relevant gespeichert – die KI lernt sofort mit.'
      : '👎 Gespeichert – solche Meldungen ranken wir für dich sofort niedriger.',
  });
});

/**
 * GET /feedback?t=<token>&v=up|down — the page a newsletter feedback link opens.
 * It does NOT mutate on load; instead its JS POSTs to /api/feedback/email. Email
 * link scanners / pre-fetchers that don't run JS therefore can't trigger votes.
 */
export function feedbackPageHandler(_req: Request, res: Response): void {
  const appUrl = config.clientUrl || '';
  res.type('html').send(`<!doctype html>
<html lang="de"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex"/><title>Feedback</title></head>
<body style="margin:0;background:#0A0F1E;color:#E2E8F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;">
  <div style="max-width:420px;padding:32px 24px;text-align:center;">
    <div style="font-size:13px;letter-spacing:1px;color:#60A5FA;text-transform:uppercase;">Markttrends Scouting</div>
    <div id="msg" style="font-size:18px;font-weight:700;color:#F8FAFC;margin:18px 0 8px;">Speichere dein Feedback …</div>
    <div id="sub" style="font-size:14px;color:#94A3B8;line-height:1.5;"></div>
    <a id="back" href="${appUrl}" style="display:none;margin-top:20px;color:#60A5FA;font-size:14px;text-decoration:none;">→ Zur App</a>
  </div>
  <script>
    (function(){
      var p = new URLSearchParams(location.search);
      var msg = document.getElementById('msg'), sub = document.getElementById('sub'), back = document.getElementById('back');
      fetch('/api/feedback/email', { method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ token: p.get('t'), v: p.get('v') }) })
        .then(function(r){ return r.json(); })
        .then(function(d){
          msg.textContent = d.ok ? 'Danke!' : 'Hoppla';
          sub.textContent = d.message || (d.ok ? 'Gespeichert.' : 'Das hat nicht geklappt.');
          back.style.display = 'inline-block';
        })
        .catch(function(){ msg.textContent = 'Hoppla'; sub.textContent = 'Verbindung fehlgeschlagen.'; back.style.display='inline-block'; });
    })();
  </script>
</body></html>`);
}
