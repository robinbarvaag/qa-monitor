# Offisielt Playwright-image: Python + Chromium + alle systemavhengigheter
# forhåndsinstallert. Tag-versjonen MÅ matche playwright-versjonen (>=1.49).
FROM mcr.microsoft.com/playwright/python:v1.49.0-jammy

WORKDIR /app

# VIKTIG: imaget har flere Python-installasjoner. Vi installerer ALT i `python3`
# og starter også uvicorn med `python3 -m` (se CMD), slik at workerens
# sys.executable — som brukes til å spawne validatoren — er nøyaktig den samme
# interpreteren som har playwright. playwright pinnes til imagets versjon (1.49.0)
# så den matcher Chromium som allerede ligger forhåndsinstallert.
RUN python3 -m pip install --no-cache-dir \
      "playwright==1.49.0" \
      "fastapi>=0.115" \
      "uvicorn[standard]>=0.30" \
      "vercel_blob>=0.4" \
      "openpyxl>=3.1" \
      "pillow>=11.0" \
      "psycopg[binary]>=3.2" \
      "python-dotenv>=1.0" \
 && python3 -m playwright install chromium

# Build-konteksten er repo-ROTEN (Railway-monorepo), så stiene er relative til
# den. Vi henter kun de to mappene workeren trenger, flatt inn i /app, slik at
# `worker_web` blir et toppnivå-modul (uvicorn worker_web.server:app).
COPY apps/worker-web/worker_web ./worker_web
COPY apps/worker-web/reference ./reference

ENV PYTHONUTF8=1 \
    PYTHONUNBUFFERED=1

# Railway injiserer $PORT; default 8000 lokalt.
EXPOSE 8000
CMD ["sh", "-c", "python3 -m uvicorn worker_web.server:app --app-dir /app --host 0.0.0.0 --port ${PORT:-8000}"]
