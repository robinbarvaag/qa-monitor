# Offisielt Playwright-image: Python + Chromium + alle systemavhengigheter
# forhåndsinstallert. Tag-versjonen MÅ matche playwright-versjonen (>=1.49).
FROM mcr.microsoft.com/playwright/python:v1.49.0-jammy

WORKDIR /app

# Installer Python-avhengigheter (playwright ligger allerede i imaget, derfor
# ikke listet her). Eget lag før kildekoden for bedre build-cache.
RUN pip install --no-cache-dir \
      "fastapi>=0.115" \
      "uvicorn[standard]>=0.30" \
      "vercel_blob>=0.4" \
      "openpyxl>=3.1" \
      "pillow>=11.0" \
      "psycopg[binary]>=3.2" \
      "python-dotenv>=1.0"

# Kildekode
COPY worker_web ./worker_web
COPY reference ./reference

ENV PYTHONUTF8=1 \
    PYTHONUNBUFFERED=1

# Railway injiserer $PORT; default 8000 lokalt.
EXPOSE 8000
CMD ["sh", "-c", "uvicorn worker_web.server:app --host 0.0.0.0 --port ${PORT:-8000}"]
