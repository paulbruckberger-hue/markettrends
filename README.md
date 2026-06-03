# Markttrends Scouting

B2B Content Intelligence Platform – sammelt automatisch Inhalte zu **Themen** und
**Unternehmen** aus internationalen Quellen, klassifiziert sie per KI, stellt sie
strukturiert dar und (ab Meilenstein 3) pusht kritische Meldungen via Telegram +
versendet einen wöchentlichen Newsletter.

> Eigenständiges Projekt. **Keine** Verbindung zu anderen Repos/Apps.

## Architektur

- **client/** – React + TypeScript + Vite + Tailwind + TanStack Query → Firebase Hosting
- **server/** – Node 20 + Express + TypeScript (ein Image, zwei Entrypoints: API + Collector-Job)
- **DB** – Supabase (PostgreSQL), angesprochen über Standard-`pg` + Drizzle ORM (**kein** Supabase-SDK → portabel)
- **Hosting (Ziel)** – Cloud Run (API + Jobs) · Cloud Scheduler · Firebase Hosting · Secret Manager

Kernprinzip: **Suchbegriffe sind geteilte, deduplizierte Objekte** (`search_terms`).
Watch-Items sind nur User-Abos darauf. Suche und KI-Klassifikation laufen pro
Begriff genau einmal; user-spezifisch sind nur Abo, Lese-Status, Bookmarks, Push.

## Status

**Meilenstein 1 (vertikaler Schnitt) – fertig:**
Supabase + Google News + Claude, Auth (JWT), Watch-List CRUD inkl. Dedup-Logik,
Collector + Job-Entrypoint, Feed (Join-Query), Minimal-Frontend (Login / Beobachtungen / Feed).

Offen: Meilenstein 2 (RSS + Apify-LinkedIn + Gemini/DeepSeek + Geo-Filter + Analytics),
Meilenstein 3 (Telegram + Newsletter + Settings-Page + GCP-Deploy).

## Voraussetzungen

- Node.js 20 (lokal via nvm installiert)
- Eine Supabase-`DATABASE_URL` (**Session-Pooler**-String, IPv4!)
- Ein Anthropic API-Key

## Lokales Setup

```bash
# 1. server/.env befüllen (DATABASE_URL + ANTHROPIC_API_KEY)
#    JWT_SECRET / TELEGRAM_WEBHOOK_SECRET sind bereits generiert.

# 2. Abhängigkeiten
cd server && npm install
cd ../client && npm install

# 3. Migrationen sind bereits generiert (server/drizzle/).
#    Sie laufen idempotent beim API-Start automatisch.
#    Optional manuell:
cd ../server && npm run db:migrate && npm run db:seed

# 4a. Backend starten (Terminal 1) – läuft auf :8080, migriert + seedet beim Start
npm run dev

# 4b. Frontend starten (Terminal 2) – läuft auf :5173, proxyt /api → :8080
cd ../client && npm run dev
```

Login: **paul / PaulB1**

### Meilenstein 1 testen

1. http://localhost:5173 öffnen → mit `paul / PaulB1` anmelden.
2. **Beobachtungen** → Thema anlegen (z.B. „embedded finance", Geo: Global).
3. **Jetzt abrufen** → lokal läuft der Collector in-process; Status erscheint inline.
4. **Feed** → klassifizierte Artikel erscheinen (nach Rang sortiert).

> Lokal (ohne `GCP_PROJECT_ID`) läuft „Jetzt abrufen" direkt im API-Prozess.
> In Produktion triggert die API stattdessen den Cloud-Run-Job.

Collector einmalig per CLI (Batch über alle aktiven Begriffe):
```bash
cd server && npm run dev:collect
# oder nur ein Begriff:
SEARCH_TERM_ID=<uuid> npm run dev:collect
```

## Deployment

Siehe [docs/02_Markttrends_Scouting_Deployment_Guide.md](docs/02_Markttrends_Scouting_Deployment_Guide.md)
(GCP + Supabase, Always-Free-Kontingent). Wird in Meilenstein 3 ausgeführt.

## Skripte

**server/**
| Script | Zweck |
|--------|-------|
| `npm run dev` | API mit Hot-Reload (migriert + seedet beim Start) |
| `npm run dev:collect` | Collector lokal (Batch oder `SEARCH_TERM_ID`) |
| `npm run build` | TypeScript → `dist/` |
| `npm run db:generate` | Drizzle-Migration aus Schema generieren |
| `npm run db:migrate` / `db:seed` | Migration / Seed manuell |
| `npm run typecheck` | `tsc --noEmit` |

**client/**
| Script | Zweck |
|--------|-------|
| `npm run dev` | Vite-Dev-Server (:5173) |
| `npm run build` | Produktions-Build → `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
