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
- [x] Flytt shadcn-primitiver til delt `@qa/ui`-pakke (komponenter via package exports)
- [x] Refaktorer validatoren: les URL-er fra **sitemap.xml** (sitemap-index rekursivt) i tillegg til Excel; `--limit`
- [x] Generer `report.json` mot seed `uutilsynet.no/sitemap.xml` (10 sider) → `apps/web/fixtures/`
- [x] `lib/report.ts`: normaliser native `report.json` → typet UI-modell
- [x] **Per side** (hovedvisning): tellekort + filtre (fritekstsøk, «bare a11y/brutte/lastefeil», SEO-nøkkel); ekspanderbar detalj (a11y/seo/tastatur/lenker)
- [x] **Nettsted**-visning: robots/AI-bot allow-block, sitemaps, llms.txt
- [x] **Dashboard-shell** (Vercel-aktig): sidebar-nav + topbar/breadcrumb, mørkt tema
- [x] **Prosjektoversikt** (`/`): grid av nettsteds-kort med helse-%; detalj på `/p/[slug]`
- [x] Flere nettsteder: hver `fixtures/<slug>.json` = ett prosjekt (uutilsynet + digdir)
- [x] Sortering (sti/a11y/brutte/status) + reaktive tellinger (følg opp / ferdig)
- [x] Per-rad status-UI (følg opp / ferdig + notat) — **i DB** (`annotation`), ikke localStorage
- [ ] Skjermbilder i fixturen + per-side-detalj (krever static-serving av `shots/`)
- [ ] **Sammenlign** (migrerings-modus, sekundær): scoreboard med deltaer + gammel/ny side-om-side for sider som deler `pairKey`
- [x] **Akseptanse:** velg et nettsted → se per-side-QA fra sitemap med filtre + oppfølging

---

## Fase 2 — Postgres + Drizzle 🚧

- [x] `DATABASE_URL` (Neon) wiret; root `.env.local` lastes av både drizzle-kit og Next (`@qa/db` env-loader)
- [x] `bun db:generate && bun db:migrate` → alle 7 tabeller i Neon
- [x] Oppfølging → `annotation` via `@qa/db`-queries + server action (verifisert round-trip)
- [ ] Refaktorer Python-scriptet til `apps/worker-web` (`python -m worker_web --run-id <uuid>`)
- [ ] Worker leser `source.config.mode` (`sitemap | list | migration`), upserter `page`-rader (én per URL, sitemap = primær), skriver `page_result` + skjermbilder via lokal-disk-`BlobStore`; setter `run.status`
- [ ] Appen leser **rapportdata** fra DB i stedet for fixture (oppfølging er allerede i DB)
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

- **Config-pakke:** `@qa/config` holder tsconfig-presets (`base`/`nextjs`/`react-library`).
  Biome + turbo blir på rot (Biome fungerer best som én rot-config).
- **Merkevaretema:** bedriftens designtokens mappet inn i shadcn-tokenene i
  `apps/web/app/globals.css` (lilla #98139C / mørk-lilla #4F0077 / magenta #CB0084,
  feil #EC5014). Default er nå **lyst** (deres identitet); `.dark` er en avledet variant.
  `bg-brand`/`text-brand`-utiliteter tilgjengelig.
- **TypeScript 6.0.3** i hele monorepoet. `@qa/ui` bruker `baseUrl`+`paths` (kreves av
  shadcn-resolveren), stilnet med `ignoreDeprecations: "6.0"`. Ved TS 7 byttes til
  `imports`-feltet i package.json.
- **App-shell:** custom sidebar/topbar (shadcn-`sidebar`-blokken er stor + CLI-en feilet
  på den; byttes inn senere ved behov). Mørkt tema som default (`<html class="dark">`).
- **Prosjekt = nettsted:** Fase 1 leser `apps/web/fixtures/<slug>.json` per nettsted
  (`lib/projects.ts`). I Fase 2 blir dette `project`-rader i DB.
- **Delt UI:** shadcn-primitiver bor i `@qa/ui` (ikke i `apps/web`), konsumeres via package
  exports (`@qa/ui/components/ui/*`, `@qa/ui/lib/utils`). Apper transpilerer pakken
  (`transpilePackages`) og scanner den for Tailwind-klasser (`@source`). Tema/CSS blir
  i appen inntil en app nr. 2 trenger det.
- **Pakkescope:** `@qa/*` (kan døpes om — spør først, jf. HANDOFF §8).
- **page-modell (2026-06-16):** `page` = ÉN overvåket URL (sitemap-primær). Migrering
  modelleres som to sider med samme `pairKey` (ikke `oldUrl`/`newUrl`/`column`).
  `pageResult` har ett resultat per side per kjøring. URL-sourcing styres av
  `source.config.mode` (typet som `WebValidationConfig` i `@qa/core`).
