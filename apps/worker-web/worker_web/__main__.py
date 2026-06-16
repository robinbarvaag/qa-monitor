import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from .db import ingest
from .env import load_env


def main() -> None:
    ap = argparse.ArgumentParser(
        prog="worker_web",
        description="Crawler en sitemap via validate_pages.py og skriver resultatet til DB.",
    )
    ap.add_argument("--project", required=True, help="prosjekt-slug (stabil id)")
    ap.add_argument("--name", default=None, help="visningsnavn (default: origin/slug)")
    ap.add_argument("--sitemap", required=True, help="URL til sitemap.xml")
    ap.add_argument("--limit", type=int, default=None, help="maks antall sider")
    ap.add_argument("--internal-only", action="store_true", help="bare interne lenker")
    ap.add_argument("--skip-links", action="store_true", help="hopp over lenkesjekk")
    ap.add_argument("--no-screenshots", action="store_true", help="ikke ta skjermbilder")
    args = ap.parse_args()

    load_env()

    reference = Path(__file__).resolve().parent.parent / "reference" / "validate_pages.py"
    workdir = Path(tempfile.mkdtemp(prefix="qa-worker-"))

    cmd = [sys.executable, str(reference), "--sitemap", args.sitemap, "--out", str(workdir)]
    if args.limit:
        cmd += ["--limit", str(args.limit)]
    if args.internal_only:
        cmd += ["--internal-only"]
    if args.skip_links:
        cmd += ["--skip-links"]
    if not args.no_screenshots:
        cmd += ["--screenshots"]

    print("Kjører validator:", " ".join(cmd))
    subprocess.run(cmd, check=True)

    data = json.loads((workdir / "report.json").read_text(encoding="utf-8"))
    name = args.name
    if not name:
        sites = data.get("sites") or {}
        name = next(iter(sites.keys()), args.project)

    ingest(args.project, name, args.sitemap, args.limit, data, workdir)


if __name__ == "__main__":
    main()
