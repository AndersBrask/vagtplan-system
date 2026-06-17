# Deployment → Cloudflare Pages + D1

Systemet kører nu fuldt serverless på Cloudflare:

- **Frontend** (React/Vite) bygges til statiske filer og serveres af Cloudflare Pages.
- **API** ligger i `functions/api/[[path]].ts` (Hono) og kører som Pages Functions.
- **Data** ligger i en Cloudflare **D1**-database (serverless SQLite).

Frontenden kalder `/api/*` relativt, så alt kører på samme origin —
ingen CORS, ingen separat backend-server.

> Den gamle FastAPI-backend i `backend/` er nu kun reference. Den bruges af
> `scripts/py_reference.py` til at verificere at TS-porten giver samme plan.

---

## Forudsætninger (én gang)

```bash
npm install            # rod-deps (hono, wrangler)
npm install -g wrangler  # valgfrit; ellers brug npx wrangler
wrangler login         # log ind på din Cloudflare-konto
```

## 1. Opret D1-databasen

```bash
wrangler d1 create vagtplan-db
```

Kopiér det `database_id`, kommandoen udskriver, ind i `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "vagtplan-db"
database_id = "<dit-rigtige-id-her>"
```

## 2. Opret skema + indlæs data i D1 (remote)

```bash
npm run db:init:remote
```

Det kører `db/schema.sql` og `db/seed.sql` mod den rigtige D1.
Seed-data genereres fra `backend/data/*.json` med `npm run seed:gen`.

## 3. Push til GitHub

```bash
git remote add origin git@github.com:<bruger>/vagtplan-system.git
git push -u origin main
```

## 4. Forbind Cloudflare Pages til repoet

I Cloudflare-dashboardet → **Workers & Pages → Create → Pages → Connect to Git**:

| Indstilling | Værdi |
|-------------|-------|
| Build command | `npm install && npm run build` |
| Build output directory | `frontend/dist` |
| Root directory | `/` (repo-roden) |

Efter første deploy: **Settings → Functions → D1 database bindings**:

| Variable name | D1 database |
|---------------|-------------|
| `DB` | `vagtplan-db` |

(Bindingen skal hedde præcis `DB` — det er navnet koden bruger.)
Trigger et nyt deploy, så bindingen træder i kraft.

## 5. Bind domænet

**Settings → Custom domains → Set up a custom domain** → `planning.andersbn.dk`.

Da domænet allerede er på Cloudflare, oprettes DNS-recorden automatisk.
HTTPS-certifikat udstedes typisk inden for få minutter.

---

## Lokal udvikling

**Hele stakken (frontend + API + lokal D1):**

```bash
npm run build                 # byg frontend til frontend/dist
npm run db:init:local         # opret + seed lokal D1 (i .wrangler/state)
npx wrangler pages dev frontend/dist --persist-to .wrangler/state
# → http://127.0.0.1:8788  (API på /api/*)
```

**Frontend med hot-reload (Vite):** kør `cd frontend && npm run dev` og tilføj
en proxy i `frontend/vite.config.js` så `/api` peger på `pages dev`-porten.

## Verifikation af scheduler-porten

```bash
backend/venv/bin/python scripts/py_reference.py   # Python-reference
npx tsx scripts/ts_reference.ts                    # TS-port
# → de to JSON-outputs skal være identiske
```
