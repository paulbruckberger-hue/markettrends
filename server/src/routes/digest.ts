import { Router, Response } from 'express';
import { authMiddleware, AuthedRequest } from '../middleware/auth';
import { renderDigestHtml, sendNewsletter } from '../services/newsletter';

export const digestRouter = Router();
digestRouter.use(authMiddleware);

// GET /api/digest/preview → HTML
digestRouter.get('/preview', async (req: AuthedRequest, res: Response) => {
  try {
    const html = await renderDigestHtml(req.user!.id);
    res.type('html').send(html);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Vorschau fehlgeschlagen' });
  }
});

// POST /api/digest/send → sofort an eigenen Account
digestRouter.post('/send', async (req: AuthedRequest, res: Response) => {
  try {
    const sent = await sendNewsletter(req.user!.id);
    res.json({ sent, message: sent ? 'Newsletter gesendet' : 'Kein Versand (keine Inhalte oder keine E-Mail)' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Versand fehlgeschlagen' });
  }
});
