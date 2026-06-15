# ROADMAP — qa-monitor

Levende veikart. Hakes av etter hvert. Kilden for *hvorfor* er [HANDOFF.md](HANDOFF.md);
denne fila er *hvor vi er* og *hva som er neste*.

Regel: ikke start neste fase før forrige er grønn (`bun check` + typecheck passerer og kjører).

**Status nå:** Fase 0 ferdig ✅ · Fase 1 i gang 🚧

> **Designendring (2026-06-16):** Primær bruk er **overvåking av mange levende
> nettsteder**, med URL-er hentet fra `sitemap.xml`. Per-side-QA (a11y, skjermbilde,
> SEO, tastatur, lenker) er kjernen, og "sammenligning" betyr først og fremst **trend
> over tid** (samme URL, kjøring N vs N‑1). Gammel↔ny side-om-side er en **spesialmodus
> (migrering)**. `source.config.mode` (`sitemap | list | migration`) styrer hvordan
> URL-ene hentes — samme worker. `page` er generalisert til ÉN URL (+ valgfri `pairKey`).

---

## Fase 0 — Oppsett & wiring ✅

- [x] Monorepo-skjelett (bun workspaces, turbo, biome)
- [x] `@qa/core` (typer + BlobStore/RunQueue-seams)
- [x] `@qa/db` (Drizzle-skjema + klient)
- [x] Flytt tsconfig til `packages/config` (`@qa/config`): `tsconfig/base.json` + `tsconfig/nextjs.json`
- [x] Rewire `core` + `db` til å extende `@qa/config`
- [x] Legg til `@types/node` i `db` (brukte `process.env` utypet)
- [x] `bun install` / `bun check` / typecheck grønt

---

## Fase 1 — Next.js leser `report.json` (ingen DB) 🚧

> Mål: ekte UI med shadcn for **per-side-QA av ett nettsted hentet fra sitemap**.
> Ingen DB ennå.

- [x] Scaffold `apps/web` (`create-next-app` + `shadcn init`), tsconfig extender `@qa/config/tsconfig/nextjs.json`
- [x] Legg til `@qa/core` som workspace-dep (typene)
- [x] Generaliser `page`-modellen til ÉN URL + `pairKey` (schema + typer)
- [ ] Refaktorer validatoren: les URL-er fra **sitemap.xml** (sitemap-index rekursivt) i tillegg til Excel; legg til `--limit`
- [ ] Generer `report.json` mot seed `uutilsynet.no/sitemap.xml` (cap ~15–20 sider) → `apps/web/fixtures/`
- [ ] **Per side** (hovedvisning): liste over sider med tellekort + filtre (§5): fritekstsøk, sortering, «bare a11y/brutte/lastefeil», status, SEO-nøkkel; detalj per side (a11y/seo/tastatur/lenker + skjermbilde)
- [ ] **Nettsted**-visning: robots/AI-bot allow-block, sitemaps, llms.txt
- [ ] **Sammenlign** (migrerings-modus, sekundær): scoreboard med deltaer + gammel/ny side-om-side for sider som deler `pairKey`
- [ ] Per-rad status-UI (følg opp / ferdig + notat) — lokalt i Fase 1, flyttes til DB i Fase 2
- [ ] **Akseptanse:** velg et nettsted → se per-side-QA fra sitemap med filtre; migrerings-visning fungerer for et url-par

---

## Fase 2 — Postgres + Drizzle

- [ ] `.env` med `DATABASE_URL` (lokal Postgres eller Neon/Supabase)
- [ ] `bun db:generate && bun db:migrate`
- [ ] Refaktorer Python-scriptet til `apps/worker-web` (`python -m worker_web --run-id <uuid>`)
- [ ] Worker leser `source.config.mode` (`sitemap | list | migration`), upserter `page`-rader (én per URL, sitemap = primær), skriver `page_result` + skjermbilder via lokal-disk-`BlobStore`; setter `run.status`
- [ ] Appen leser fra DB i stedet for fixture; oppfølging → `annotation` (server actions)
- [ ] **Akseptanse:** worker → rader i DB → app viser dem; oppfølging overlever ny kjøring

---

## Fase 3 — Trigge kjøringer + live progresjon

- [ ] «Kjør validering»-knapp: skriv `run` (queued) + `RunQueue.enqueue`; lokalt `InlineRunQueue`
- [ ] Live progresjon via polling (senere SSE)

---

## Fase 4 (valgfritt) — Claude-API-analyselag

- [ ] Les ferdige resultater → oppsummering / fiks-forslag / auto-prioritert oppfølging
- [ ] Holdes adskilt fra den deterministiske valideringen

---

## Fase 5 — GitHub/Dependabot-kilde (TS)

- [ ] Ny `source.type = github`, config `{ owner, repo, token }`
- [ ] Runner i TS: `GET /repos/{owner}/{repo}/dependabot/alerts` → `finding`-rader (`kind=dependency_vuln`, severity, stabil `fingerprint`)
- [ ] UI: findings per prosjekt med samme oppfølging (`annotation`)

---

## Beslutninger underveis

- **Config-pakke:** `@qa/config` holder tsconfig-presets. Biome + turbo blir på rot
  (Biome fungerer best som én rot-config).
- **Pakkescope:** `@qa/*` (kan døpes om — spør først, jf. HANDOFF §8).
- **page-modell (2026-06-16):** `page` = ÉN overvåket URL (sitemap-primær). Migrering
  modelleres som to sider med samme `pairKey` (ikke `oldUrl`/`newUrl`/`column`).
  `pageResult` har ett resultat per side per kjøring. URL-sourcing styres av
  `source.config.mode` (typet som `WebValidationConfig` i `@qa/core`).
