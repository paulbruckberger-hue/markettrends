import path from 'path';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config, isProd } from './config';
import { runMigrations } from './db/migrate';
import { runSeed } from './db/seed';
import { authRouter } from './routes/auth';
import { watchlistRouter } from './routes/watchlist';
import { articlesRouter } from './routes/articles';
import { analyticsRouter } from './routes/analytics';
import { settingsRouter } from './routes/settings';
import { digestRouter } from './routes/digest';
import { clustersRouter } from './routes/clusters';
import { emailFeedbackRouter, feedbackPageHandler } from './routes/feedback';
import { webhookRouter } from './routes/webhook';
import { adminRouter } from './routes/admin';

function buildCorsOrigins(): (string | RegExp)[] {
  const origins = new Set<string>([
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
  ]);
  if (config.clientUrl) origins.add(config.clientUrl);
  return [...origins, /\.web\.app$/, /\.firebaseapp\.com$/];
}

async function start(): Promise<void> {
  // Idempotent on every container start, before the server listens.
  await runMigrations();
  await runSeed();

  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: buildCorsOrigins(), credentials: false }));
  app.use(express.json({ limit: '1mb' }));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Zu viele Versuche. Bitte später erneut.' },
  });

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/watchlist', watchlistRouter);
  app.use('/api/articles', articlesRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/digest', digestRouter);
  app.use('/api/clusters', clustersRouter);
  app.use('/api/admin', adminRouter);

  // Public, token-authenticated newsletter feedback (no JWT)
  app.use('/api/feedback', emailFeedbackRouter);

  // Public Telegram webhook (secret-verified, no JWT)
  app.use('/webhook', webhookRouter);

  // 404 for unknown API routes
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Route nicht gefunden' }));

  // Newsletter feedback landing page — must be before the SPA catch-all.
  app.get('/feedback', feedbackPageHandler);

  // Static frontend (SPA) — served from the same service when a build is present.
  const clientDir = process.env.CLIENT_DIR || path.join(__dirname, '../client-dist');
  app.use(express.static(clientDir));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(clientDir, 'index.html'), (err) => {
      if (err) res.status(404).json({ error: 'Nicht gefunden' });
    });
  });

  // Central error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Interner Serverfehler';
    console.error('[error]', err);
    res.status(500).json({ error: isProd ? 'Interner Serverfehler' : message });
  });

  app.listen(config.port, () => {
    console.log(`[api] Markttrends Scouting API listening on :${config.port} (${config.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error('[api] startup failed:', err);
  process.exit(1);
});
