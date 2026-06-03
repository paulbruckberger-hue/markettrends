# Markttrends Scouting – Was DU vorbereiten musst (und was Claude Code selbst macht)

## Kurz gesagt

**Claude Code baut den kompletten Code, die Datenbank-Migrationen, lokale Tests und kann sogar die Deploy-Befehle selbst ausführen.** Was Claude Code *nicht* kann, sind Dinge, die an deine Identität, Bezahlung oder einen Account-Login gebunden sind – also externe Accounts anlegen und API-Keys beschaffen. Das ist der einzige manuelle Teil.

**Um Claude Code starten zu lassen, brauchst du nur ZWEI Dinge:**
1. Eine Supabase-`DATABASE_URL`
2. Einen Anthropic API-Key

Alles andere (Telegram, Apify, SMTP, GCP-Deploy) kannst du **später** ergänzen, wenn die jeweiligen Features dran sind. Claude Code baut und testet den Kern (Feed + Klassifikation) schon mit diesen zwei Werten.

---

## Was Claude Code selbst erledigt ✅

Du musst dich um nichts davon kümmern:
- Komplettes Repo-Setup (Frontend, Backend, Monorepo-Struktur)
- Den gesamten Anwendungscode (React-Pages, Express-Routen, Services)
- Drizzle-Schema **und** die SQL-Migrationen generieren
- Migrationen gegen deine Supabase-DB ausführen (sobald `DATABASE_URL` gesetzt ist)
- Seed-Daten anlegen (User `paul`, RSS-Feeds)
- `JWT_SECRET` und `TELEGRAM_WEBHOOK_SECRET` selbst generieren (`openssl`)
- Dockerfile, `drizzle.config.ts`, alle Konfigs schreiben
- Die App **lokal starten und testen**
- Auf Wunsch die `gcloud`/`firebase`-Deploy-Befehle ausführen (wenn die CLIs installiert + eingeloggt sind und du zustimmst)
- Den Telegram-Webhook per `curl` setzen

---

## Was NUR DU machen kannst 🔑

Diese Accounts/Keys kann Claude Code nicht selbst anlegen (Signup, E-Mail-Verifizierung, Bezahlung, AGB-Zustimmung). Pro Eintrag: wo du es bekommst und in welche `.env`-Variable es gehört.

### Sofort nötig (damit Claude Code bauen + lokal testen kann)

| # | Was | Wo bekommen | `.env`-Variable |
|---|-----|-------------|-----------------|
| 1 | **Supabase-Projekt** | supabase.com → New Project (Region EU/Frankfurt) → **Connect → Session pooler** → String kopieren | `DATABASE_URL` |
| 2 | **Anthropic API-Key** | console.anthropic.com → API Keys | `ANTHROPIC_API_KEY` |

> **Supabase-Hinweis:** Unbedingt den **"Session pooler"**-Connection-String nehmen (nicht die Direktverbindung). Der hat IPv4 und funktioniert sowohl lokal als auch später aus Cloud Run.

### Später nötig (wenn die Features/der Deploy drankommen)

| # | Was | Wo bekommen | `.env`-Variable | Gebraucht für |
|---|-----|-------------|-----------------|---------------|
| 3 | **Apify-Token** | apify.com → Settings → Integrations → API token | `APIFY_API_TOKEN` | LinkedIn-Quellen (Meilenstein 2) |
| 4 | **Telegram-Bot** | In Telegram **@BotFather** anschreiben → `/newbot` → Token + Bot-Username | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` | Push-Benachrichtigungen |
| 5 | **SMTP-Zugang** | z.B. Gmail → 2FA aktivieren → **App-Passwort** erzeugen | `SMTP_USER`, `SMTP_PASS` | Newsletter-Versand |
| 6 | **GCP-Projekt + Billing** | console.cloud.google.com → Projekt anlegen → Billing-Account verknüpfen (Free Tier braucht trotzdem eine hinterlegte Karte) → `gcloud auth login` | – | Deployment |
| 7 | **Gemini / DeepSeek Key** | optional, nur falls du diese Modelle testen willst | `GEMINI_API_KEY`, `DEEPSEEK_API_KEY` | alternative AI-Modelle |

> **Hinweis GCP-Billing:** Selbst für den kostenlosen Betrieb verlangt Google eine hinterlegte Zahlungsmethode, um Cloud Run zu aktivieren. Es entstehen bei MVP-Volumen aber keine echten Kosten (siehe Deployment-Guide). Das ist GCP-Pflicht, kein Vertippen.

---

## `.env`-Vorlage

Lege diese Datei als `server/.env` an (Claude Code befüllt die generierbaren Werte selbst, du trägst die Keys aus der Tabelle ein):

```env
# === DU trägst ein (sofort) ===
DATABASE_URL=postgresql://postgres.<ref>:<pw>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
ANTHROPIC_API_KEY=sk-ant-...

# === Claude Code generiert selbst ===
JWT_SECRET=
TELEGRAM_WEBHOOK_SECRET=

# === DU trägst später ein ===
APIFY_API_TOKEN=
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
GEMINI_API_KEY=
DEEPSEEK_API_KEY=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Markttrends Scouting <noreply@markttrends.app>

# === Lokal fix ===
PORT=8080
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

---

## So übergibst du das Projekt an Claude Code

1. Leeren Projektordner anlegen, z.B. `markttrends-scouting/`.
2. Darin einen Ordner `docs/` anlegen und diese drei Dateien hineinlegen:
   - `00_Markttrends_Scouting_Manuelle_Vorbereitung.md` (dieses Dokument)
   - `01_Markttrends_Scouting_Implementierungsprompt.md`
   - `02_Markttrends_Scouting_Deployment_Guide.md`
3. `server/.env` mit der Vorlage oben anlegen (mind. `DATABASE_URL` + `ANTHROPIC_API_KEY`).
4. Claude Code im Projektordner starten (`claude`).
5. Diese Nachricht als erste Eingabe geben:

```
Lies docs/01_Markttrends_Scouting_Implementierungsprompt.md vollständig.
Das ist die Spezifikation für die App, die wir bauen.

Setze zuerst NUR Meilenstein 1 um (vertikaler Schnitt: Supabase + Google News + Claude),
sodass ich lokal ein Topic anlegen, den Collector laufen lassen und klassifizierte
Artikel im Feed sehen kann. Die Zugangsdaten liegen in server/.env
(DATABASE_URL und ANTHROPIC_API_KEY sind gesetzt; JWT_SECRET und
TELEGRAM_WEBHOOK_SECRET darfst du selbst generieren).

Stoppe nach Meilenstein 1, wenn alles lokal kompiliert und läuft, und sag mir,
wie ich es teste. Erst danach machen wir mit Meilenstein 2 weiter.
```

6. Wenn Meilenstein 1 läuft und du zufrieden bist: „Mach mit Meilenstein 2 weiter" – usw.
7. Für den Deploy später: `docs/02_..._Deployment_Guide.md` durcharbeiten (oder Claude Code bitten, die Befehle für dich auszuführen, sobald du `gcloud`/`firebase` eingeloggt hast).

---

## Warum Schritt für Schritt (Meilensteine) statt alles auf einmal?

Das Projekt ist groß (Backend + 3 AI-Modelle + 4 Quellen + Newsletter + 6 Seiten). Wenn Claude Code alles in einem Rutsch baut und am Ende ein Fehler auftritt, ist die Ursache schwer zu finden. Mit dem vertikalen Schnitt zuerst hast du nach kurzer Zeit etwas Lauffähiges, kannst es testen, und jeder weitere Baustein wird isoliert ergänzt. Das ergibt am Ende deutlich saubereren Code – genau das Ziel.
