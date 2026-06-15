# ROADMAP — qa-monitor

Levende veikart. Hakes av etter hvert. Kilden for *hvorfor* er [HANDOFF.md](HANDOFF.md);
denne fila er *hvor vi er* og *hva som er neste*.

Regel: ikke start neste fase før forrige er grønn (`bun check` + typecheck passerer og kjører).

**Status nå:** Fase 0 ferdig ✅ · Fase 1 i gang 🚧

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

> Mål: ekte UI med shadcn som dekker dagens HTML-rapport. Ingen DB, ingen worker-endring.

- [ ] Scaffold `apps/web` (`create-next-app` + `shadcn init`), tsconfig extender `@qa/config/tsconfig/nextjs.json`
- [ ] Legg til `@qa/core` som workspace-dep (typene)
- [ ] Eksempel-`report.json` i `apps/web/fixtures/` (generér med referanse-scriptet)
- [ ] **Sammenlign**-visning: scoreboard med deltaer, accordion-rader, gammel/ny side-om-side + skjermbilder
- [ ] **Per side**-visning med filtre (§5): fritekstsøk, kolonne, sortering, «bare a11y/brutte/lastefeil», status, SEO-nøkkel
- [ ] **Nettsted**-visning: robots/AI-bot allow-block, sitemaps, llms.txt
- [ ] Per-rad status-UI (følg opp / ferdig + notat) — lokalt i Fase 1, flyttes til DB i Fase 2
- [ ] **Akseptanse:** samme info som dagens HTML-rapport, ekte komponenter + routing

---

## Fase 2 — Postgres + Drizzle

- [ ] `.env` med `DATABASE_URL` (lokal Postgres eller Neon/Supabase)
- [ ] `bun db:generate && bun db:migrate`
- [ ] Refaktorer Python-scriptet til `apps/worker-web` (`python -m worker_web --run-id <uuid>`)
- [ ] Worker skriver `page_result` (map `gammel→old`, `ny→new`) + skjermbilder via lokal-disk-`BlobStore`; setter `run.status`
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
