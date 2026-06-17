"""HTTP-trigger for workeren (hostet, f.eks. Railway).

Web-appen POST-er hit i stedet for å spawne en lokal prosess. Endepunktet
kvitterer umiddelbart (202) og kjører selve valideringen i en bakgrunnstråd;
fremdrift/feil skrives til `run`-raden i DB akkurat som før, og klienten følger
det via sin vanlige status-polling.
"""

import os
import threading

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from .__main__ import run_by_id
from .env import load_env

# På Railway er DATABASE_URL satt som env → load_env er en no-op der. Lokalt
# plukker den opp rot-.env.local slik at `uvicorn worker_web.server:app` virker.
load_env()

app = FastAPI(title="qa-monitor worker")

# Delt hemmelighet. Settes likt her og i web-appen (WORKER_SECRET). Hvis den ikke
# er satt, slås auth av (greit lokalt, IKKE anbefalt i produksjon).
SECRET = os.environ.get("WORKER_SECRET")


class RunRequest(BaseModel):
    runId: str


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/run", status_code=202)
def run(req: RunRequest, authorization: str | None = Header(default=None)) -> dict:
    if SECRET and authorization != f"Bearer {SECRET}":
        raise HTTPException(status_code=401, detail="unauthorized")

    # Egen tråd: jobben tar minutter, så vi blokkerer ikke HTTP-svaret.
    # run_by_id setter selv status='error' i DB hvis noe feiler.
    threading.Thread(target=run_by_id, args=(req.runId,), daemon=True).start()
    return {"accepted": True, "runId": req.runId}
