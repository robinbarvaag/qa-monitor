# HANDOFF — qa-monitor

Kontekst-dokument for en Claude Code-instans som skal bygge dette videre.
Les dette HELT før du skriver kode. Les også `README.md`, `packages/db/src/schema.ts`,
`packages/core/src/*.ts`, og referanse-scriptet (se §6).

---

## 1. Hva vi bygger

Et pluggbart **prosjekt-helse-verktøy**. Det startet som ett Python-script som
validerer en nettside-migrering (gamle → nye URL-er) for en kunde (SiS): for hvert
URL-par kjøres a11y-, SEO-, lenke-, tastatur- og skjermbilde-sjekker, og resultatet
vises i en selvstendig HTML-rapport med sammenligning gammel vs. ny.

Vi løfter dette til et ekte verktøy med:
- en **Next.js-app** som viser resultatene visuelt (erstatter den genererte HTML-en),
- en **Python-worker** som gjør selve valideringen (refaktorering av dagens script),
- en **Postgres-database** for all info, og **blob-lagring** for skjermbilder,
- og en arkitektur som er forberedt på **flere datakilder** — neste er
  **GitHub/Dependabot** (sårbarheter, dependency-varsler hentet rett fra GitHub-API-et).

Eieren tester ut ting selv i første omgang; **hosting er ikke en prioritet nå**, men
strukturen skal gjøre det enkelt å pushe til Vercel, Azure eller annet senere.

---

## 2. Stack & konvensjoner — HARDE KRAV (ikke avvik fra disse)

- **Turborepo + bun workspaces.** Bruk `bun`. ALDRI pnpm eller npm.
- **Biome** for både format og lint. ALDRI prettier eller eslint. Ikke legg til
  `.eslintrc`, `.prettierrc` e.l. Kjør `bun check` / `bun format`.
- **Drizzle + Postgres.** Skjema i `packages/db/src/schema.ts`. Migrasjoner via
  `drizzle-kit` (`bun db:generate`, `bun db:migrate`).
- **Next.js (App Router) + TypeScript strict + Tailwind + shadcn/ui** for UI.
  shadcn brukes alltid for komponenter (`bunx shadcn@latest add ...`).
- **Python + Playwright** for web-valideringsworkeren. **Ikke skriv den om til TS.**
- Pakkescope er `@qa/*`, workspace-avhengigheter med `"@qa/db": "workspace:*"`.
- Server components leser DB direkte via `@qa/db`. Hold tunge ting på serveren.
- Eieren misliker overengineering. Foretrekk det enkle: `jsonb` for detaljer +
  noen få indekserte summer for filtrering. Ikke normaliser alt til egne tabeller
  før det faktisk trengs. Ikke legg LLM/«agentic» inn i den deterministiske
  valideringen — det hører hjemme i et valgfritt analyselag oppå ferdige resultater.

---

## 3. Hva som ALLEREDE finnes (ikke bygg dette på nytt)

Monorepo-skjelettet er satt opp:

```
apps/
  web/          README-plassholder (skal scaffolds — se §7, Fase 1)
  worker-web/   README-plassholder + reference/validate_pages.py (dagens script)
packages/
  core/         FERDIG: delte typer + plattform-seams
  db/           FERDIG: Drizzle-skjema + klient
```

Rot-config er ferdig: `package.json` (bun workspaces), `turbo.json`, `biome.json`,
`tsconfig.base.json`, `.gitignore`. `apps/*` uten `package.json` ignoreres av bun
til de scaffoldes, så `bun install` fungerer nå på de to pakkene.

### `packages/core` (kontrakt + plattform-seams)
- `types.ts` — TS-typene for validator-outputen (PageResultData, SeoItem, A11yResult,
  LinkResult, KeyboardResult, FindingData). Dette er DATA-kontrakten.
- `storage.ts` — `BlobStore`-interface (`put/get/url/remove`) + `blobKey()`-helper.
  Adaptere (Vercel Blob / Azure Blob / lokal disk) implementeres mot dette.
- `queue.ts` — `RunQueue`-interface + `InlineRunQueue` (kjør direkte lokalt nå).

### `packages/db` (databasen = den delte kontrakten)
Les `schema.ts` nøye. Modellen:
- `project` — et overvåket prosjekt.
- `source` — en pluggbar datakilde for et prosjekt: `web_validation | github`,
  med `config jsonb` (url-par/ark, eller repo + token).
- `run` — én utførelse av en kilde på et tidspunkt → gir historikk/trender.
- `page` + `page_result` — den RIKE web-valideringsmodellen (url-par + sheet-meta;
  per-side-resultat med a11y/seo/links/keyboard/geo som jsonb, `screenshot_key`,
  og indekserte summer `a11y_count`/`broken_count`/`seo_fail_count`).
- `finding` — GENERISK funn-strøm. GitHub/Dependabot m.m. skriver hit
  (`kind`, `severity`, `subject`, stabil `fingerprint`, `title`, `data jsonb`).
- `annotation` — oppfølging (`status: followup|done` + `note`) på PROSJEKTNIVÅ,
  knyttet til en stabil `target_key`, så markeringer overlever nye kjøringer.

> Viktig mapping: Python-scriptet bruker kolonnenavn `gammel`/`ny`. I DB bruker vi
> `old`/`new`. Workeren mapper `gammel→old`, `ny→new` når den skriver `page_result`.

---

## 4. Designprinsipper (hvorfor ting ser ut som de gjør)

1. **Kilder → funn.** Web-validering er bare én kilde. Ikke hardkod antakelser om at
   alt er web-validering. Nye kilder (github) skal kunne legges til ved å lage en ny
   `source.type` + en runner som skriver `finding`-rader — uten å endre skjemaet.
2. **Kontrakten er DATA, ikke funksjonskall.** Python-worker og TS-app deler kun
   DB-skjemaet (`@qa/db`) og typene (`@qa/core`). Derfor er språkgrensen grei.
   GitHub-kilden trenger ikke Python — den er bare API-kall og kan skrives i TS.
3. **Portabilitet.** Det eneste plattform-spesifikke er blob og kø → bak interfaces i
   `@qa/core`. DB er bare en `DATABASE_URL`. Workeren er en CLI som tar `runId`.
   Bytte av hosting = adapter-swap, ikke omskriving.
4. **Oppfølging lever på tvers av kjøringer.** Annotering knyttes til en stabil
   identitet (`<pageId>|new`, eller en finding-`fingerprint`), ikke til en `run`.
5. **Pragmatisk lagring.** Rike detaljer i `jsonb`; dupliser kun de tallene du
   filtrerer/sorterer på som ekte kolonner.

---

## 5. Hva som skal vises (dagens funksjonalitet UI-et må dekke)

UI-et skal minst kunne det dagens HTML-rapport kan. Tre visninger:

1. **Sammenlign (gammel vs ny)** — per URL-par: et «scoreboard» med deltaer
   (a11y, critical, serious, brutte lenker, bilder uten alt, SEO-avvik, JS-avhengige,
   usynlig fokus, JSON-LD, markdown) som viser gammel → ny med pil opp/ned (grønt =
   bedre). Hver rad er en accordion som åpner gammel/ny side-om-side, inkl.
   skjermbilder og «last ned kombinert bilde».
2. **Per side** — alle sider hver for seg, med reaktive tellekort som speiler det
   aktive filteret, og detaljer per side.
3. **Nettsted (robots/llms/AI)** — per origin: robots.txt, AI-bot allow/block,
   sitemaps, llms.txt / llms-full.txt.

Filtre (per side): fritekst-søk, kolonne (gammel/ny), sortering, «bare a11y-feil /
brutte lenker / lastefeil», **status (følg opp / ferdig / ikke vurdert)**, og
**SEO-nøkkel** (mangler description, description for lang, mangler og:image, noindex,
ingen/flere h1, hopp i overskrifter, …).

Per rad: **status-knapper** «⚑ Følg opp» og «✓ Ferdig» (grønn check, grønn kant når
ferdig; gul kant ved følg opp), et **notatfelt** som auto-markerer som «følg opp» når
man skriver, badges for problemer, «Info fra regneark» (ekstra Excel-kolonner), og en
status-tag i headeren (f.eks. overføringsstatus). I dag lagres oppfølging i
localStorage med eksport/import til JSON — **i den nye appen flyttes dette til DB
(`annotation`)**.

---

## 6. Referanse: dagens Python-validator (inspirasjon + datakontrakt)

Den faktiske koden ligger i **`apps/worker-web/reference/validate_pages.py`** (~1900
linjer). **Les den.** Den er fasiten på hvilke sjekker som finnes og hvilket dataformat
de produserer. Workeren vår er en refaktorering av denne til å skrive til DB + blob i
stedet for å bygge HTML.

### Sjekker per side
- **HTTP-status / lastefeil.**
- **a11y** via axe-core (4.10.2, caches lokalt). Brudd gruppert på impact
  (critical/serious/moderate/minor) + «incomplete» (krever manuell sjekk).
- **SEO** (`compute_seo`) → liste av `{level: fail|warn|ok, key, msg}`. Nøkler brukes
  til filtrering. Severitet er trinndelt, f.eks. meta description: mangler = warn,
  161–300 tegn = warn, **>300 = fail** (trolig autogenerert), <50 = warn. title
  mangler = fail. lang mangler = fail. h1=0 fail / >1 warn. noindex = fail. og:image
  mangler = warn (`og-image`). osv.
- **GEO / AI-synlighet** (`compute_geo`): JSON-LD til stede, JS-avhengighet (server-
  HTML-tekst vs. rendret DOM < 50 % → flagges), ordtelling, markdown tilgjengelig,
  AI-bot blokkert, + tips.
- **Markdown-sjekk**: `Accept: text/markdown` + `.md`-endepunkt (en feature som
  verifiseres).
- **Brutte lenker** (`check_link`, GET + 3 retries) → klassifisering:
  `broken` (404/410/5xx/None), `uncertain` (400/401/403/405/406/429/999 = bot-blokk,
  vises separat), `ignored` (manuelt ekskludert via `--ignore-link`, telles ikke).
- **Tastatur/fokus** (`check_keyboard`): tabber gjennom siden med ekte tastatur og
  sporer element-IDENTITET (`window.__kb`) for korrekt antall tab-stopp. Sjekker:
  tab-stopp, tab-felle, skip-lenke, synlig fokus (outline/box-shadow ved
  tastaturfokus = WCAG 2.4.7), positiv tabindex, fokuserbare utenfor skjerm,
  fokuserbare inni `aria-hidden`, og interaktive elementer UTEN tastaturtilgang
  (`role=button/link`/`onclick` uten tabindex).
- **Skjermbilder** (`--screenshots`): full-height JPEG per side; syr gammel + ny
  sammen til ett kombinert bilde per rad (Pillow).
- **Ekstra Excel-kolonner**: leser ALLE kolonner utover `url`/`ny-url` og tar dem med
  som info per side (`entry["extra"]`).

### Nettsted-nivå (`check_site`, én gang per origin)
robots.txt parses for eksplisitt allow/block av AI-boter (GPTBot, ClaudeBot,
PerplexityBot, CCBot, Google-Extended, …), sitemaps, wildcard. llms.txt + llms-full.txt.

### `report.json`-formatet (det UI-et i dag rendrer)
`{ generated, source, pages: [...], sites: {...} }`. Hver page-entry:
`{ row, column ('gammel'|'ny'), url, status, ok, load_error, meta{title,
title_length, meta_description, description_length, lang, h1_count, canonical,
images_total, images_missing_alt, og{}, twitter_card, robots_meta, viewport,
hreflang[], jsonld[], heading_skips, rendered_text_len, word_count}, a11y{...},
links{total,broken[],uncertain[],ignored[]}, seo[...], geo{...}, markdown{...},
ssr{...}, keyboard{...}, shot, combined_shot, extra{...} }`.

For **Fase 1** kan du la appen lese akkurat denne `report.json` direkte (kjør scriptet
for å generere en) og rendre sammenligningsvisningen — uten DB. Det er den raskeste
veien til ekte UI og gjenbruker alt.

### CLI-flagg (referanse)
`excel` (valgfri med `--rebuild`), `--out`, `--only`, `--width`, `--concurrency`,
`--timeout`, `--skip-links`, `--internal-only`, `--ignore-link`, `--ignore-links-file`,
`--fast`, `--skip-keyboard`, `--max-tabs`, `--screenshots`, `--rebuild`.

---

## 7. Veikart med konkrete oppgaver

Jobb trinnvis. Ikke start på et senere trinn før det forrige er grønt
(`bun check` + typecheck passerer, og det kjører).

### Fase 1 — Next.js leser `report.json` (ingen DB)
- Scaffold `apps/web`: `bunx create-next-app@latest . --ts --app --tailwind --no-eslint --use-bun`, så `bunx shadcn@latest init`.
- Legg til `@qa/core` som workspace-dep for typene.
- Lag en route/side som leser en lokal `report.json` (legg en eksempelfil i
  `apps/web/fixtures/`) og rendrer **Sammenlign**-visningen med shadcn-komponenter:
  scoreboard med deltaer, accordion-rader, gammel/ny side-om-side.
- Deretter **Per side** med filtrene fra §5, og **Nettsted**-visningen.
- **Akseptansekriterium:** samme info som dagens HTML-rapport, men med ekte
  komponenter og routing. Ingen DB, ingen worker-endring ennå.

### Fase 2 — Postgres + Drizzle
- Sett opp `.env` med `DATABASE_URL` (lokal Postgres eller Neon/Supabase).
- `bun db:generate && bun db:migrate`.
- Refaktorer Python-scriptet til `apps/worker-web` som en worker: `python -m worker_web --run-id <uuid>`. Den leser kjøringens prosjekt/url-par, kjører sjekkene, og
  skriver `page_result`-rader (map gammel→old, ny→new) + laster skjermbilder til blob
  (start med lokal-disk-`BlobStore`). Sett `run.status` underveis.
- Appen leser fra DB i stedet for fixture. Flytt oppfølging til `annotation`
  (server actions for status/notat).
- **Akseptansekriterium:** kjør worker → rader i DB → appen viser dem; oppfølging
  persisteres i DB og overlever ny kjøring.

### Fase 3 — Trigge kjøringer + live progresjon
- «Kjør validering»-knapp i appen: skriv `run` (queued) + `RunQueue.enqueue`.
  Lokalt: `InlineRunQueue` som kaller workeren direkte.
- Live progresjon via polling først (senere SSE).

### Fase 4 (valgfritt) — Claude-API-analyselag
- Les ferdige resultater og generer oppsummering / fiks-forslag / auto-prioritert
  oppfølging. Hold dette adskilt fra den deterministiske valideringen.

### Fase 5 — GitHub/Dependabot-kilde (TS)
- Ny `source.type = github`, config `{ owner, repo, token }`.
- Runner i TS (server action eller liten worker): kall
  `GET /repos/{owner}/{repo}/dependabot/alerts` (token med `security_events`), map til
  `finding`-rader (`kind=dependency_vuln`, severity fra alert, stabil `fingerprint`).
- UI: en visning som lister findings per prosjekt, med samme oppfølging (`annotation`).

---

## 8. Arbeidsregler for instansen

- Bruk **bun**, **Biome**, **Drizzle**, **shadcn**. Aldri pnpm/npm/eslint/prettier.
- Hold datakontrakten i `@qa/core` / `@qa/db`. Hvis du endrer Python-outputen, oppdater
  typene — og helst valider Python-output mot en JSON Schema generert fra typene i CI.
- **Ikke skriv Python-validatoren om til TS.** Refaktorer den der den ligger.
- Kjør `bun check` og typecheck før du anser noe som ferdig. Hold commits scoped.
- Spør før destruktive endringer (sletting, store refaktoreringer, ny infra).
- TypeScript strict; ingen `any` uten god grunn. Følg eksisterende mønstre i repoet.
- Scope `@qa/*` kan døpes om hvis eieren ønsker — spør først.
