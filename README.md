# Vagtplan-system

Avanceret vagtplanlægning: medarbejdere, områder, åbningstider og regler
(constraints) → automatisk genereret vagtplan.

Kører fuldt serverless på **Cloudflare Pages + D1**.

## Arkitektur

| Lag | Teknologi | Placering |
|-----|-----------|-----------|
| Frontend | React + Vite (SPA) | `frontend/` |
| API | Hono på Cloudflare Pages Functions | `functions/api/[[path]].ts` |
| Domænelogik | TypeScript (scheduler, constraints) | `src/` |
| Data | Cloudflare D1 (SQLite) | `db/schema.sql`, `db/seed.sql` |

`src/scheduler.ts` + `src/constraints.ts` er en port af den oprindelige
Python-motor i `backend/` (beholdt som reference). Porten er verificeret til at
give **byte-identisk** vagtplan — se `scripts/`.

## Kom i gang lokalt

```bash
npm install
npm run build
npm run db:init:local
npx wrangler pages dev frontend/dist --persist-to .wrangler/state
```

## Deploy

Se **[DEPLOYMENT.md](DEPLOYMENT.md)** for trin til GitHub + Cloudflare Pages +
D1 + domænet `planning.andersbn.dk`.
