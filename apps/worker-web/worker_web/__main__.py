import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlparse

from . import db
from .env import load_env

PROGRESS = re.compile(r"^\[(\d+)/(\d+)\]")
REFERENCE = Path(__file__).resolve().parent.parent / "reference" / "validate_pages.py"


def _origin(url: str) -> str:
    p = urlparse(url or "")
    return f"{p.scheme}://{p.netloc}" if p.netloc else (url or "")


def build_cmd(workdir: Path, config: dict) -> list[str]:
    cmd = [sys.executable, str(REFERENCE), "--out", str(workdir)]
    if config.get("mode") == "crawl":
        base = config.get("base") or _origin(config.get("url", ""))
        cmd += ["--crawl", base]
    else:
        cmd += ["--sitemap", config["url"]]
    if config.get("limit"):
        cmd += ["--limit", str(config["limit"])]
    if config.get("internalOnly"):
        cmd += ["--internal-only"]
    if config.get("skipLinks"):
        cmd += ["--skip-links"]
    if config.get("screenshots", True):
        cmd += ["--screenshots"]
    return cmd


def run_validator(cmd: list[str], on_progress=None) -> None:
    print("Kjører validator:", " ".join(cmd))
    child_env = {**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"}
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=child_env,
    )
    assert proc.stdout is not None
    for line in proc.stdout:
        sys.stdout.write(line)
        m = PROGRESS.match(line.strip())
        if m and on_progress:
            on_progress(int(m.group(1)), int(m.group(2)))
    proc.wait()
    if proc.returncode != 0:
        raise RuntimeError(f"validator avsluttet med kode {proc.returncode}")


def run_by_id(run_id: str) -> None:
    info = db.load_run(run_id)
    config = info["config"]
    sitemap = config.get("url")
    if not sitemap:
        db.set_error(run_id, "source.config mangler url")
        raise SystemExit("source.config mangler url")

    db.set_running(run_id)
    workdir = Path(tempfile.mkdtemp(prefix="qa-worker-"))
    try:
        run_validator(
            build_cmd(workdir, config),
            on_progress=lambda d, t: db.set_progress(run_id, d, t),
        )
        data = json.loads((workdir / "report.json").read_text(encoding="utf-8"))
        totals = db.write_run_results(run_id, info["project_id"], info["slug"], data, workdir)
        print(f"Ferdig: run={run_id} prosjekt={info['slug']} sider={totals['pages']}")
    except Exception as e:  # noqa: BLE001
        db.set_error(run_id, str(e))
        raise


def run_manual(args) -> None:
    config = {
        "mode": "sitemap",
        "url": args.sitemap,
        "limit": args.limit,
        "internalOnly": args.internal_only,
        "skipLinks": args.skip_links,
        "screenshots": not args.no_screenshots,
    }
    workdir = Path(tempfile.mkdtemp(prefix="qa-worker-"))
    run_validator(build_cmd(workdir, config))
    data = json.loads((workdir / "report.json").read_text(encoding="utf-8"))
    name = args.name
    if not name:
        sites = data.get("sites") or {}
        name = next(iter(sites.keys()), args.project)
    db.ingest(args.project, name, config, data, workdir)


def main() -> None:
    ap = argparse.ArgumentParser(
        prog="worker_web",
        description="Crawler en sitemap via validate_pages.py og skriver resultatet til DB.",
    )
    ap.add_argument("--run-id", default=None, help="kjør en eksisterende køet run (leser config fra DB)")
    ap.add_argument("--project", default=None, help="prosjekt-slug (manuell modus)")
    ap.add_argument("--name", default=None, help="visningsnavn")
    ap.add_argument("--sitemap", default=None, help="URL til sitemap.xml (manuell modus)")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--internal-only", action="store_true")
    ap.add_argument("--skip-links", action="store_true")
    ap.add_argument("--no-screenshots", action="store_true")
    args = ap.parse_args()

    load_env()

    if args.run_id:
        run_by_id(args.run_id)
    elif args.project and args.sitemap:
        run_manual(args)
    else:
        ap.error("oppgi enten --run-id, eller --project + --sitemap")


if __name__ == "__main__":
    main()
