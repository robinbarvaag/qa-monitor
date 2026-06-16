# ROADMAP — qa-monitor

Levende veikart. Hakes av etter hvert. Kilden for *hvorfor* er [HANDOFF.md](HANDOFF.md);
denne fila er *hvor vi er* og *hva som er neste*.

Regel: ikke start neste fase før forrige er grønn (`bun check` + typecheck passerer og kjører).

**Status nå:** Fase 0–5 ✅ (Sammenlign parkert) · AI streamer live · ⌘K-søk · Dependabot-funn kodet (venter på `GITHUB_TOKEN` + repo) · GitHub App-flyt ved deploy

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

## Fase 1 — Next.js leser `report.json` (ingen DB) ✅

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
- [x] Skjermbilder i per-side-detalj (downscalet til `public/shots/<slug>/`, vises i accordion)
- [ ] **Sammenlign** (migrerings-modus, sekundær): scoreboard med deltaer + gammel/ny side-om-side for sider som deler `pairKey` — **venter på migrerings-data (Excel med gammel/ny-par)**
- [x] **Akseptanse:** velg et nettsted → se per-side-QA fra sitemap med filtre + oppfølging

---

## Fase 2 — Postgres + Drizzle 🚧

- [x] `DATABASE_URL` (Neon) wiret; root `.env.local` lastes av både drizzle-kit og Next (`@qa/db` env-loader)
- [x] `bun db:generate && bun db:migrate` → alle 7 tabeller i Neon
- [x] Oppfølging → `annotation` via `@qa/db`-queries + server action (verifisert round-trip)
- [x] `apps/worker-web/worker_web` (`python -m worker_web --project … --sitemap …`): driver validatoren, skriver `project`/`source`/`run`/`page`/`page_result` + `meta`/`run.data` via psycopg; downscaler skjermbilder
- [x] Appen leser **rapportdata** fra DB (`@qa/db`-queries + normalizer); fixtures fjernet
- [x] **Akseptanse:** worker → rader i Neon → app viser dem (oversikt + per-side + Nettsted); oppfølging overlever ny kjøring
- [ ] Worker skriver `page_result` fortløpende (nå: batch til slutt) + lokal-disk-`BlobStore`-adapter for skjermbilder
- [ ] `--run-id`-modus (leser køet `run` fra DB) — bro til Fase 3

---

## Fase 3 — Trigge kjøringer + live progresjon ✅

- [x] `--run-id`-modus i workeren: leser køet `run` + `source.config`, setter status (queued→running→done/error), rapporterer progresjon
- [x] «Kjør validering»-knapp → server action skriver `run` (queued) + spawner workeren (`uv run … --run-id`) detached fra Node (InlineRunQueue lokalt)
- [x] Live progresjon via polling (`getRunStatusAction`, «Kjører d/N») + `router.refresh()` ved ferdig
- [ ] Senere: SSE i stedet for polling; `RunQueue`-abstraksjon i `@qa/core`; kø for flere samtidige kjøringer

---

## Fase 4 — Claude-API-analyselag ✅ (kode) · ⏳ live-verifisering venter på nøkkel

- [x] Ny `analysis`-tabell (migrasjon 0003): `kind=run_summary` (pageId=null) + `kind=page`, regenereres per kjøring
- [x] `@qa/db`-queries: `getLatestRunPages`, `saveRunAnalyses`, `getRunAnalyses` (keyet på side-URL)
- [x] `lib/analyze.ts`: Anthropic-SDK, **claude-opus-4-8**, tvunget strukturert output (tool_use), kompakt jsonb-digest, samtidighetsbegrenset per-side-pool
- [x] **Begge granulariteter:** helhetlig kjøring-oppsummering + AI-vurdering per side
- [x] «Analyser med AI»-knapp (manuell trigger) → `analyzeRunAction` → lagrer → `router.refresh()`
- [x] UI: `AiSummary`-panel (prioriterte problemer m/forslag) + AI-blokk + «AI»-badge i hver side-accordion
- [x] Holdes adskilt fra deterministisk validering (skriver kun til `analysis`)
- [x] **Streaming (Vercel AI SDK):** byttet fra `@anthropic-ai/sdk` til `ai` + `@ai-sdk/anthropic` + `@ai-sdk/react`. Helhets-panelet streames live via `streamObject`/`useObject`; per-side genereres med `generateObject` og lagres etterpå. Verifisert ende-til-ende mot live nøkkel.
- [x] Klikkbare side-referanser i AI-panelet (sti → faktisk URL)

## Finpuss (2026-06-16) ✅

- [x] **Globalt ⌘K-søk** (cmdk + dialog) på tvers av prosjekter/sider, med debounce, skeletons og tastaturnavigasjon (`searchEverything` i `@qa/db`)
- [x] Gjenbrukbar `Metric`-komponent med forklarende tooltip (tastatur/fokus-tallene)
- [x] Header-badge ved alvorlig funn (tab-felle løftes til radens header)
- [x] Usikre lenker vises nå (klikkbare + statusforklaring) — 403/401/429/999 telles ikke som «brutt», men kan inspiseres
- [x] Fikset spøkelses-separator i accordion (`tailwind-merge` dedupliserte ikke `not-last:`-varianten)

---

## Fase 5 — GitHub/Dependabot-kilde (TS) ✅ (kode) · ⏳ live venter på `GITHUB_TOKEN` + repo

- [x] `source.type = github`, config `{ owner, repo }` (token i env, ikke DB)
- [x] Runner i TS ([lib/github.ts](apps/web/lib/github.ts)): `GET /repos/{owner}/{repo}/dependabot/alerts` → `FindingInput[]` (severity-mapping high→serious osv., stabil `fingerprint = github:owner/repo:nr`)
- [x] `@qa/db`: `ensureGithubSource` / `getGithubSource` / `runGithubFindings` (run+findings) / `getLatestFindings`
- [x] Server actions: `addGithubSourceAction` (koble til repo) + `runGithubScanAction` (TS-runner, ingen subprocess)
- [x] UI: [FindingsSection](apps/web/components/findings-section.tsx) — koble-til-form / «Skann Dependabot» / funn-liste (severity, pakke, fiks-versjon, GHSA/CVE-lenke) + samme oppfølging (`annotation` keyet på `fingerprint`)
- [x] **Web-queries filtrert på `source.type=web_validation`** så github-kjøringer ikke forveksles med side-kjøringer
- [ ] **Krever fine-grained `GITHUB_TOKEN` (`Dependabot alerts: read`) i `.env.local` + et repo** for live skann
- [ ] Senere (egen fase ved deploy): GitHub App + better-auth «koble til»-flyt (bytter kun tilgangslaget, ikke funn-logikken)

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
