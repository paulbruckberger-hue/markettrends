import dotenv from 'dotenv';

// override:true lets the local .env win over stray/empty shell variables
// (e.g. an empty ANTHROPIC_API_KEY exported by the surrounding shell).
// In production no .env file is shipped, so real env vars (Secret Manager) are used.
dotenv.config({ override: true });

/**
 * Central, typed access to environment variables.
 * Keys live only in the environment / Secret Manager — never in code or the DB.
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const config = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '8080'), 10),
  clientUrl: optional('CLIENT_URL', 'http://localhost:5173'),

  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),

  // AI – only the active model needs a key.
  anthropicApiKey: optional('ANTHROPIC_API_KEY'),
  geminiApiKey: optional('GEMINI_API_KEY'),
  deepseekApiKey: optional('DEEPSEEK_API_KEY'),

  // Scraping
  apifyApiToken: optional('APIFY_API_TOKEN'),

  // Telegram
  telegramBotToken: optional('TELEGRAM_BOT_TOKEN'),
  telegramWebhookSecret: optional('TELEGRAM_WEBHOOK_SECRET'),
  telegramBotUsername: optional('TELEGRAM_BOT_USERNAME'),

  // Email
  smtpHost: optional('SMTP_HOST'),
  smtpPort: parseInt(optional('SMTP_PORT', '587'), 10),
  smtpUser: optional('SMTP_USER'),
  smtpPass: optional('SMTP_PASS'),
  smtpFrom: optional('SMTP_FROM', 'Markttrends Scouting <noreply@markttrends.app>'),

  // GCP (Job-Triggering aus der API)
  gcpProjectId: optional('GCP_PROJECT_ID'),
  gcpRegion: optional('GCP_REGION', 'europe-west1'),
  collectorJobName: optional('COLLECTOR_JOB_NAME', 'markttrends-collector'),
} as const;

export const isProd = config.nodeEnv === 'production';
