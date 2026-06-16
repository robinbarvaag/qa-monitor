import os
from pathlib import Path

from dotenv import load_dotenv


def load_env() -> None:
    """Laster `.env.local`/`.env` fra nærmeste forelder oppover (samme idé som
    @qa/db sin env-loader), så én rot-`.env.local` forsyner også workeren."""
    if os.environ.get("DATABASE_URL"):
        return
    here = Path.cwd()
    for base in (here, *here.parents):
        for name in (".env.local", ".env"):
            f = base / name
            if f.exists():
                load_dotenv(f)
        if os.environ.get("DATABASE_URL"):
            return
