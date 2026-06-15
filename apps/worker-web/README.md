# apps/worker-web — Python-validator (Playwright)

Her bor dagens `reference/validate_pages.py`. I Fase 2 refaktoreres den til en worker
(`python -m worker_web --run-id <uuid>`) som skriver til DB + blob. I Fase 1 kjører vi
referanse-scriptet direkte for å produsere en `report.json` som `apps/web` rendrer.

## Oppsett (uv)

`pyproject.toml` + `.python-version` finnes allerede — du trenger ikke `uv init`.

```bash
cd apps/worker-web
uv sync                      # lager .venv + installerer playwright/openpyxl/pillow
uv run playwright install chromium
```

## Fase 1 — generer en report.json

Krever et Excel-ark med kolonnene `url` og `ny-url` (én rad per URL-par; ekstra
kolonner blir med som «info fra regneark»).

```bash
uv run python reference/validate_pages.py <ark>.xlsx --out validering
# rask variant uten lenkesjekk/skjermbilder mens vi bygger UI:
uv run python reference/validate_pages.py <ark>.xlsx --out validering --skip-links --fast
```

Resultatet `validering/report.json` kopieres til `apps/web/fixtures/report.json`.

## Fase 2 — worker mot DB

Kontrakt: tar en `runId` (+ `DATABASE_URL` og blob-config via env), henter url-parene
for kjøringens prosjekt, kjører axe/SEO/lenker/tastatur/skjermbilder, skriver
`page_result`-rader fortløpende (map `gammel→old`, `ny→new`) og laster skjermbilder til blob.

Kjøres som: lokalt nå · Azure Container Apps Job (senere) · GitHub Actions cron (valgfritt).

Språkgrensen mot TS er grei fordi kontrakten er DATA (DB-skjemaet i `@qa/db` / typene i
`@qa/core`), ikke funksjonskall.
