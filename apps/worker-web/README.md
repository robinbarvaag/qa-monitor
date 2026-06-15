# apps/worker-web — Python-validator (Playwright)

Her bor dagens `validate_pages.py`, refaktorert til en worker.

Kontrakt: tar en `runId` (+ DATABASE_URL og blob-config via env), henter
url-parene for kjøringens prosjekt, kjører axe/SEO/lenker/tastatur/skjermbilder,
skriver `page_result`-rader fortløpende og laster skjermbilder til blob.

```bash
# lokal testing
uv venv && uv pip install playwright openpyxl pillow psycopg[binary]
python -m playwright install chromium
python -m worker_web --run-id <uuid>
```

Kjøres som:
- lokalt under utvikling (du, nå)
- Azure Container Apps Job (on-demand, lange kjøringer) — senere
- GitHub Actions cron (nattlig) — valgfritt

Språkgrensen mot TS er grei fordi kontrakten er DATA (DB-skjemaet i `@qa/db` /
typene i `@qa/core`), ikke funksjonskall. GitHub/Dependabot-kilden trenger
ikke Python og kan skrives i TS i `apps/web`.
