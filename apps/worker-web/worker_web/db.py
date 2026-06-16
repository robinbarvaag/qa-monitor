import os
from pathlib import Path

import psycopg
from PIL import Image
from psycopg.types.json import Json

# apps/web/public/shots – samme statiske serving som Fase 1
PUBLIC_SHOTS = Path(__file__).resolve().parents[2] / "web" / "public" / "shots"


def _connect():
    return psycopg.connect(os.environ["DATABASE_URL"])


def _save_screenshot(src: Path, slug: str, name: str) -> str:
    """Downscaler (800px/q60) inn i apps/web/public/shots/<slug>/, returnerer key."""
    dst_dir = PUBLIC_SHOTS / slug
    dst_dir.mkdir(parents=True, exist_ok=True)
    im = Image.open(src).convert("RGB")
    w, h = im.size
    if w > 800:
        h = round(h * 800 / w)
        w = 800
        im = im.resize((w, h))
    if h > 2000:
        im = im.crop((0, 0, w, 2000))
    im.save(dst_dir / name, "JPEG", quality=60, optimize=True)
    return f"{slug}/{name}"


def _counts(entry: dict) -> tuple[int, int, int]:
    a11y = (entry.get("a11y") or {}).get("violation_count", 0) or 0
    broken = len((entry.get("links") or {}).get("broken", []) or [])
    seo_fail = sum(1 for s in (entry.get("seo") or []) if s.get("level") == "fail")
    return a11y, broken, seo_fail


# ---------- run-livssyklus (brukes av --run-id-modus) ----------

def load_run(run_id: str) -> dict:
    """Henter prosjekt + source.config for en eksisterende run-rad."""
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """select p.id, p.slug, p.name, s.config
               from run r
               join source s on s.id = r.source_id
               join project p on p.id = s.project_id
               where r.id = %s""",
            (run_id,),
        )
        row = cur.fetchone()
        if not row:
            raise SystemExit(f"Fant ikke kjøring {run_id}")
        return {"project_id": row[0], "slug": row[1], "name": row[2], "config": row[3] or {}}


def set_running(run_id: str) -> None:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "update run set status = 'running', started_at = now(), data = '{}'::jsonb where id = %s",
            (run_id,),
        )
        conn.commit()


def set_progress(run_id: str, done: int, total: int) -> None:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "update run set data = coalesce(data, '{}'::jsonb) || %s::jsonb where id = %s",
            (Json({"progress": {"done": done, "total": total}}), run_id),
        )
        conn.commit()


def set_error(run_id: str, message: str) -> None:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "update run set status = 'error', finished_at = now(), error = %s where id = %s",
            (message[:1000], run_id),
        )
        conn.commit()


# ---------- skriving av resultater ----------

def _write_results(cur, run_id, project_id: str, slug: str, data: dict) -> dict:
    pages = data.get("pages", [])
    totals = {"pages": len(pages), "a11yViolations": 0, "brokenLinks": 0, "seoFails": 0, "loadErrors": 0}

    for entry in pages:
        a11y_count, broken_count, seo_fail = _counts(entry)
        totals["a11yViolations"] += a11y_count
        totals["brokenLinks"] += broken_count
        totals["seoFails"] += seo_fail
        if entry.get("load_error") or not entry.get("ok"):
            totals["loadErrors"] += 1

        shot_key = None
        if entry.get("shot"):
            src = data["_workdir"] / entry["shot"]
            if src.exists():
                shot_key = _save_screenshot(src, slug, Path(entry["shot"]).name)

        cur.execute(
            """insert into page (project_id, url) values (%s, %s)
               on conflict (project_id, url) do update set url = excluded.url returning id""",
            (project_id, entry["url"]),
        )
        page_id = cur.fetchone()[0]

        cur.execute(
            """insert into page_result
                 (run_id, page_id, http_status, load_error, meta, a11y, seo, links,
                  keyboard, geo, screenshot_key, a11y_count, broken_count, seo_fail_count)
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (
                run_id, page_id, entry.get("status"), entry.get("load_error"),
                Json(entry.get("meta") or {}), Json(entry.get("a11y") or {}),
                Json(entry.get("seo") or []), Json(entry.get("links") or {}),
                Json(entry.get("keyboard")), Json(entry.get("geo") or {}),
                shot_key, a11y_count, broken_count, seo_fail,
            ),
        )

    run_data = {"generated": data.get("generated"), "sites": data.get("sites") or {}}
    cur.execute(
        "update run set status = 'done', finished_at = now(), totals = %s, data = %s where id = %s",
        (Json(totals), Json(run_data), run_id),
    )
    return totals


def write_run_results(run_id: str, project_id: str, slug: str, data: dict, workdir: Path) -> dict:
    """Skriver side-resultater inn i en EKSISTERENDE run (--run-id-modus)."""
    data["_workdir"] = workdir
    with _connect() as conn:
        with conn.cursor() as cur:
            totals = _write_results(cur, run_id, project_id, slug, data)
        conn.commit()
    return totals


def ensure_source(cur, project_id: str, config: dict) -> str:
    cur.execute(
        "select id from source where project_id = %s and type = 'web_validation' limit 1",
        (project_id,),
    )
    row = cur.fetchone()
    if row:
        cur.execute("update source set config = %s where id = %s", (Json(config), row[0]))
        return row[0]
    cur.execute(
        """insert into source (project_id, type, name, config)
           values (%s, 'web_validation', %s, %s) returning id""",
        (project_id, f"sitemap: {config.get('url')}", Json(config)),
    )
    return cur.fetchone()[0]


def ingest(slug: str, name: str, config: dict, data: dict, workdir: Path) -> None:
    """Manuell modus: oppretter project/source/run og skriver resultater."""
    data["_workdir"] = workdir
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """insert into project (name, slug) values (%s, %s)
                   on conflict (slug) do update set name = excluded.name returning id""",
                (name, slug),
            )
            project_id = cur.fetchone()[0]
            source_id = ensure_source(cur, project_id, config)
            cur.execute(
                "insert into run (source_id, status, started_at) values (%s, 'running', now()) returning id",
                (source_id,),
            )
            run_id = cur.fetchone()[0]
            totals = _write_results(cur, run_id, project_id, slug, data)
        conn.commit()
    print(
        f"Skrev {totals['pages']} sider til DB (prosjekt={slug}, run={run_id}). "
        f"a11y={totals['a11yViolations']} brutte={totals['brokenLinks']} "
        f"seo_fail={totals['seoFails']} lastefeil={totals['loadErrors']}"
    )
