# Deployment-Stand (GCP)

**Live-URL:** https://markttrends-api-chz6q5jukq-ew.a.run.app
**Login:** `paul` / `PaulB1`

## Was läuft
- **GCP-Projekt:** `gen-lang-client-0439364318` ("Default Gemini Project"), Region `europe-west1`.
  Getrennt vom Bank-App-Projekt. Billing aktiv.
- **Cloud Run Service** `markttrends-api` – serviert API **und** das React-Frontend (eine URL).
- **Cloud Run Jobs** `markttrends-collector`, `markttrends-newsletter`.
- **Cloud Scheduler** `markttrends-collect` (alle 6h), `markttrends-newsletter` (täglich 05:00 Europe/Vienna).
- **Secrets:** DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY, TELEGRAM_WEBHOOK_SECRET.
- **DB:** Supabase (Session Pooler, eu-west-1) – läuft, Migrationen + Seed beim Start.

Aktive Quellen ohne weitere Keys: **Google News + RSS (18 Feeds) + Claude**.

## Noch nachzurüsten (Feature aktiv, sobald Key gesetzt)
Runtime-SA: `281138265305-compute@developer.gserviceaccount.com`
Region: `europe-west1`

### Apify (LinkedIn-Quellen)
```bash
printf '%s' 'apify_api_XXX' | gcloud secrets create APIFY_API_TOKEN --data-file=- --replication-policy=automatic
gcloud secrets add-iam-policy-binding APIFY_API_TOKEN --member="serviceAccount:281138265305-compute@developer.gserviceaccount.com" --role=roles/secretmanager.secretAccessor
gcloud run services update markttrends-api --region=europe-west1 --update-secrets=APIFY_API_TOKEN=APIFY_API_TOKEN:latest
gcloud run jobs update markttrends-collector --region=europe-west1 --update-secrets=APIFY_API_TOKEN=APIFY_API_TOKEN:latest
```

### Telegram (Push)
```bash
printf '%s' '123456:ABC...' | gcloud secrets create TELEGRAM_BOT_TOKEN --data-file=- --replication-policy=automatic
gcloud secrets add-iam-policy-binding TELEGRAM_BOT_TOKEN --member="serviceAccount:281138265305-compute@developer.gserviceaccount.com" --role=roles/secretmanager.secretAccessor
gcloud run services update markttrends-api --region=europe-west1 --update-secrets=TELEGRAM_BOT_TOKEN=TELEGRAM_BOT_TOKEN:latest --update-env-vars=TELEGRAM_BOT_USERNAME=DeinBotName
gcloud run jobs update markttrends-collector --region=europe-west1 --update-secrets=TELEGRAM_BOT_TOKEN=TELEGRAM_BOT_TOKEN:latest
# Webhook registrieren (Secret schon gesetzt: 084eae1c43825ce953a84c347d3ff5ed):
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" -H "Content-Type: application/json" \
  -d '{"url":"https://markttrends-api-chz6q5jukq-ew.a.run.app/webhook/telegram","secret_token":"084eae1c43825ce953a84c347d3ff5ed"}'
```

### SMTP (Newsletter-Versand)
```bash
printf '%s' 'gmail-app-passwort' | gcloud secrets create SMTP_PASS --data-file=- --replication-policy=automatic
gcloud secrets add-iam-policy-binding SMTP_PASS --member="serviceAccount:281138265305-compute@developer.gserviceaccount.com" --role=roles/secretmanager.secretAccessor
gcloud run services update markttrends-api --region=europe-west1 --update-secrets=SMTP_PASS=SMTP_PASS:latest --update-env-vars=SMTP_USER=deine@gmail.com
gcloud run jobs update markttrends-newsletter --region=europe-west1 --update-secrets=SMTP_PASS=SMTP_PASS:latest --update-env-vars=SMTP_USER=deine@gmail.com
```

### Gemini / DeepSeek (optionale KI-Modelle)
```bash
printf '%s' 'KEY' | gcloud secrets create GEMINI_API_KEY --data-file=- --replication-policy=automatic   # bzw. DEEPSEEK_API_KEY
gcloud secrets add-iam-policy-binding GEMINI_API_KEY --member="serviceAccount:281138265305-compute@developer.gserviceaccount.com" --role=roles/secretmanager.secretAccessor
gcloud run services update markttrends-api --region=europe-west1 --update-secrets=GEMINI_API_KEY=GEMINI_API_KEY:latest
gcloud run jobs update markttrends-collector --region=europe-west1 --update-secrets=GEMINI_API_KEY=GEMINI_API_KEY:latest
```

## Update-Deploy (nach Code-Änderungen)
```bash
export IMAGE=europe-west1-docker.pkg.dev/gen-lang-client-0439364318/markttrends/app:latest
gcloud builds submit --tag $IMAGE .          # aus Repo-Root (Root-Dockerfile: SPA + API)
gcloud run deploy markttrends-api --image=$IMAGE --region=europe-west1
gcloud run jobs update markttrends-collector --image=$IMAGE --region=europe-west1
gcloud run jobs update markttrends-newsletter --image=$IMAGE --region=europe-west1
```
