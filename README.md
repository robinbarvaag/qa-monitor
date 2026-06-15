# qa-monitor

Et pluggbart prosjekt-helse-verktøy. Web-validering (a11y/SEO/lenker/tastatur/
skjermbilder via Playwright) er én datakilde; GitHub/Dependabot er en annen;
flere kan legges til uten å reshape databasen.

## Stack
- **Turborepo + bun workspaces**
- **Biome** (format + lint, ingen prettier/eslint)
- **Drizzle + Postgres**
- **Next.js (App Router) + shadcn/ui** for UI
- **Python + Playwright** for web-validering (egen worker)

## Struktur
```
apps/
  web/          Next.js – UI, leser DB, trigger kjøringer, GitHub-synk
  worker-web/   Python + Playwright – web-valideringsworker
packages/
  core/         delte typer + plattform-seams (BlobStore, RunQueue)
  db/           Drizzle-skjema + klient (kontrakten)
```
`apps/*` uten `package.json` ignoreres av bun til de scaffoldes.

## Designidé: kilder → funn
- `source` = en konfigurert datakilde for et prosjekt (web_validation | github)
- `run` = én utførelse av en kilde (gir historikk/trender)
- web-validering: rik modell `page` + `page_result` (skjermbilder, meta, detaljer)
- alt annet (dependabot-sårbarheter osv.): generisk `finding`-strøm
- `annotation` (oppfølging: følg opp / ferdig + notat) lever på TVERS av kjøringer,
  knyttet til en stabil `target_key`

## Portabilitet (Vercel ↔ Azure ↔ annet)
Bare blob og kø er plattform-spesifikke. De ligger bak interfaces i `@qa/core`:
- `BlobStore` → Vercel Blob / Azure Blob / lokal disk (adapter-swap)
- `RunQueue` → direkte-kjør lokalt nå; Service Bus / Storage Queue / Cron senere
DB er bare en `DATABASE_URL`. Workeren er en CLI som tar `runId`.

## Kom i gang
```bash
bun install
# sett DATABASE_URL i .env
bun db:generate && bun db:migrate
```

## Veikart
1. Next.js leser `report.json` fra dagens validator → ekte UI, ingen DB
2. Postgres + Drizzle; workeren skriver til DB; oppfølging i DB; historikk
3. Kø + Container Apps Job; trigge kjøringer fra UI med live progresjon
4. (valgfritt) Claude-API: oppsummering, fiks-forslag, auto-prioritert oppfølging
5. GitHub/Dependabot-kilde (TS, server action/cron) → `finding`-strøm
