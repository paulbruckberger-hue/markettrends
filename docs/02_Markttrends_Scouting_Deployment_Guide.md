# Markttrends Scouting – Deployment Guide (GCP + Supabase)

Schritt-für-Schritt-Anleitung für den Deploy. **Datenbank ist Supabase** (kostenlos). Alle anderen Komponenten laufen im GCP Always-Free-Kontingent – der gesamte Betrieb ist damit effektiv €0/Monat.

> Diese Anleitung brauchst du erst, wenn der Code von Claude Code steht und lokal läuft. Für die reine Entwicklung genügt die Supabase-`DATABASE_URL` (siehe Prep-Dokument).

---

## 0. Voraussetzungen

```bash
# gcloud CLI: https://cloud.google.com/sdk/docs/install
gcloud auth login
gcloud config set project DEIN_PROJECT_ID

export PROJECT_ID="markttrends-scouting"
export REGION="europe-west1"
export REPO="markttrends"
export IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/app:latest"
```

### APIs aktivieren
```bash
gcloud services enable \
  run.googleapis.com \
  cloudscheduler.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com
# Kein sqladmin nötig – DB liegt bei Supabase.
```

---

## 1. Supabase-Datenbank (kostenlos)

1. Account auf **supabase.com** anlegen → neues Projekt "markttrends-scouting", Region **EU (Frankfurt)**.
2. Ein DB-Passwort vergeben (gut merken).
3. Im Projekt: **Connect** (oben) → **Session pooler** → Connection-String kopieren.
   Sieht so aus:
   `postgresql://postgres.<ref>:<password>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`

> **Wichtig:** Den **Session-Pooler**-String verwenden, nicht die Direktverbindung.
> Der Pooler liefert IPv4, das Cloud Run für die Verbindung braucht. Direktverbindungen
> sind IPv6-only und schlagen aus Cloud Run fehl.

> **Portabilität:** Der Code nutzt nur Standard-Postgres (Drizzle + `pg`), nicht das
> Supabase-SDK. Du kannst die DB jederzeit auf Cloud SQL o.ä. migrieren, ohne Code zu ändern.

---

## 2. Secrets anlegen (Secret Manager)

```bash
create_secret () {
  echo -n "$2" | gcloud secrets create "$1" --data-file=- 2>/dev/null \
  || echo -n "$2" | gcloud secrets versions add "$1" --data-file=-
}

create_secret DATABASE_URL            "postgresql://postgres.<ref>:<pw>@...pooler.supabase.com:5432/postgres"
create_secret JWT_SECRET              "$(openssl rand -hex 32)"
create_secret ANTHROPIC_API_KEY       "sk-ant-..."
create_secret GEMINI_API_KEY          ""                  # optional
create_secret DEEPSEEK_API_KEY        ""                  # optional
create_secret APIFY_API_TOKEN         "apify_api_..."
create_secret TELEGRAM_BOT_TOKEN      "123456:ABC..."
create_secret TELEGRAM_WEBHOOK_SECRET "$(openssl rand -hex 16)"
create_secret SMTP_PASS               "dein-smtp-passwort"
```

Cloud-Run-Service-Account Zugriff geben:
```bash
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
export SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

for S in DATABASE_URL JWT_SECRET ANTHROPIC_API_KEY GEMINI_API_KEY DEEPSEEK_API_KEY \
         APIFY_API_TOKEN TELEGRAM_BOT_TOKEN TELEGRAM_WEBHOOK_SECRET SMTP_PASS; do
  gcloud secrets add-iam-policy-binding $S \
    --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
done
```

---

## 3. Artifact Registry + Image bauen

```bash
gcloud artifacts repositories create $REPO \
  --repository-format=docker --location=$REGION \
  --description="Markttrends Scouting images"

# Aus dem Repo-Root (enthält server/Dockerfile)
gcloud builds submit --tag $IMAGE ./server
```

---

## 4. Cloud Run Service (API)

```bash
gcloud run deploy markttrends-api \
  --image=$IMAGE --region=$REGION --platform=managed \
  --allow-unauthenticated --port=8080 \
  --min-instances=0 --max-instances=2 --memory=512Mi \
  --set-env-vars="NODE_ENV=production,GCP_PROJECT_ID=$PROJECT_ID,GCP_REGION=$REGION,COLLECTOR_JOB_NAME=markttrends-collector,TELEGRAM_BOT_USERNAME=DeinBotName,SMTP_HOST=smtp.gmail.com,SMTP_PORT=587,SMTP_USER=deine@mail.com,SMTP_FROM=Markttrends Scouting <noreply@markttrends.app>" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,DEEPSEEK_API_KEY=DEEPSEEK_API_KEY:latest,APIFY_API_TOKEN=APIFY_API_TOKEN:latest,TELEGRAM_BOT_TOKEN=TELEGRAM_BOT_TOKEN:latest,TELEGRAM_WEBHOOK_SECRET=TELEGRAM_WEBHOOK_SECRET:latest,SMTP_PASS=SMTP_PASS:latest"

gcloud run services describe markttrends-api --region=$REGION --format='value(status.url)'
```

> Migrations & Seed (User `paul`, RSS-Feeds) laufen idempotent beim Container-Start,
> bevor der Server lauscht. Kein separater Migrations-Schritt nötig.

---

## 5. Cloud Run Jobs (Collector + Newsletter)

```bash
gcloud run jobs create markttrends-collector \
  --image=$IMAGE --region=$REGION \
  --command="node" --args="dist/jobs/collect.js" \
  --task-timeout=3600 --max-retries=1 --memory=512Mi \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,DEEPSEEK_API_KEY=DEEPSEEK_API_KEY:latest,APIFY_API_TOKEN=APIFY_API_TOKEN:latest,TELEGRAM_BOT_TOKEN=TELEGRAM_BOT_TOKEN:latest"

gcloud run jobs create markttrends-newsletter \
  --image=$IMAGE --region=$REGION \
  --command="node" --args="dist/jobs/sendNewsletters.js" \
  --task-timeout=900 --max-retries=1 --memory=512Mi \
  --set-env-vars="NODE_ENV=production,SMTP_HOST=smtp.gmail.com,SMTP_PORT=587,SMTP_USER=deine@mail.com,SMTP_FROM=Markttrends Scouting <noreply@markttrends.app>" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,SMTP_PASS=SMTP_PASS:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest"

# Test-Lauf
gcloud run jobs execute markttrends-collector --region=$REGION
```

---

## 6. Service-Account für Scheduler

```bash
gcloud iam service-accounts create markttrends-scheduler --display-name="Markttrends Scheduler"
export SCHED_SA="markttrends-scheduler@$PROJECT_ID.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SCHED_SA" --role="roles/run.developer"
```

---

## 7. Cloud Scheduler (ersetzt node-cron)

```bash
# Alle 6 Stunden: komplette Collection
gcloud scheduler jobs create http markttrends-collect \
  --location=$REGION --schedule="0 */6 * * *" --time-zone="Europe/Vienna" \
  --uri="https://$REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT_ID/jobs/markttrends-collector:run" \
  --http-method=POST --oauth-service-account-email="$SCHED_SA"

# Täglich 05:00: Newsletter (Job filtert intern nach Wochentag + User-Settings)
gcloud scheduler jobs create http markttrends-newsletter \
  --location=$REGION --schedule="0 5 * * *" --time-zone="Europe/Vienna" \
  --uri="https://$REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT_ID/jobs/markttrends-newsletter:run" \
  --http-method=POST --oauth-service-account-email="$SCHED_SA"

# Sofort testen
gcloud scheduler jobs run markttrends-collect --location=$REGION
```

---

## 8. Frontend → Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
cd client
firebase init hosting          # Public dir: dist | SPA: yes

echo "VITE_API_URL=https://markttrends-api-XXXX.run.app" > .env.production
npm run build
firebase deploy --only hosting
```

CORS-URL im Service ergänzen:
```bash
gcloud run services update markttrends-api --region=$REGION \
  --update-env-vars="CLIENT_URL=https://markttrends-scouting.web.app"
```

---

## 9. Telegram Webhook registrieren

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://markttrends-api-XXXX.run.app/webhook/telegram","secret_token":"<TELEGRAM_WEBHOOK_SECRET>"}'
```

---

## 10. Funktionstest

1. Firebase-URL öffnen → Login `paul` / `PaulB1`.
2. Watch-List → Topic anlegen (z.B. "embedded finance", Geo: Global).
3. "▶ Jetzt abrufen" → Status `success`.
4. Feed → klassifizierte Artikel erscheinen.
5. Settings → Telegram verbinden, erneut abrufen → Push bei Rank 1.
6. Settings → Newsletter-Vorschau prüfen.

---

## Update-Deploy (nach Code-Änderungen)

```bash
gcloud builds submit --tag $IMAGE ./server
gcloud run deploy markttrends-api --image=$IMAGE --region=$REGION
gcloud run jobs update markttrends-collector --image=$IMAGE --region=$REGION
gcloud run jobs update markttrends-newsletter --image=$IMAGE --region=$REGION
cd client && npm run build && firebase deploy --only hosting
```

---

## Kostenüberblick (MVP)

| Komponente | Kosten |
|------------|--------|
| Supabase (DB) | €0 (Free Tier) |
| Cloud Run (API + Jobs) | €0 (Always Free) |
| Cloud Scheduler | €0 (3 Jobs frei) |
| Artifact Registry | €0 (0,5 GB frei) |
| Firebase Hosting | €0 (10 GB/Mon frei) |
| Anthropic / Apify | nutzungsabhängig, im MVP gering |

→ Der gesamte GCP-Betrieb ist bei MVP-Volumen kostenlos. Einzige nutzungsabhängige Kosten sind die externen AI- und Scraping-APIs.
