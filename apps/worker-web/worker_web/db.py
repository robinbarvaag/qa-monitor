import os
from pathlib import Path

import psycopg
from PIL import Image
from psycopg.types.json import Json

# apps/web/public/shots – samme statiske serving som Fase 1
PUBLIC_SHOTS = Path(__file__).resolve().parents[2] / "web" / "public" / "shots"


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


def ingest(slug: str, name: str, sitemap: str, limit: int | None, data: dict, workdir: Path) -> None:
    pages = data.get("pages", [])
    config = {"mode": "sitemap", "url": sitemap}
    if limit:
        config["limit"] = limit

    totals = {
        "pages": len(pages),
        "a11yViolations": 0,
        "brokenLinks": 0,
        "seoFails": 0,
        "loadErrors": 0,
    }

    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """insert into project (name, slug) values (%s, %s)
                   on conflict (slug) do update set name = excluded.name
                   returning id""",
                (name, slug),
            )
            project_id = cur.fetchone()[0]

            cur.execute(
                "select id from source where project_id = %s and type = 'web_validation' limit 1",
                (project_id,),
            )
            row = cur.fetchone()
            if row:
                source_id = row[0]
                cur.execute("update source set config = %s where id = %s", (Json(config), source_id))
            else:
                cur.execute(
                    """insert into source (project_id, type, name, config)
                       values (%s, 'web_validation', %s, %s) returning id""",
                    (project_id, f"sitemap: {sitemap}", Json(config)),
                )
                source_id = cur.fetchone()[0]

            cur.execute(
                """insert into run (source_id, status, started_at, finished_at)
                   values (%s, 'running', now(), null) returning id""",
                (source_id,),
            )
            run_id = cur.fetchone()[0]

            for entry in pages:
                a11y_count, broken_count, seo_fail = _counts(entry)
                totals["a11yViolations"] += a11y_count
                totals["brokenLinks"] += broken_count
                totals["seoFails"] += seo_fail
                if entry.get("load_error") or not entry.get("ok"):
                    totals["loadErrors"] += 1

                shot_key = None
                if entry.get("shot"):
                    src = workdir / entry["shot"]
                    if src.exists():
                        shot_key = _save_screenshot(src, slug, Path(entry["shot"]).name)

                cur.execute(
                    """insert into page (project_id, url) values (%s, %s)
                       on conflict (project_id, url) do update set url = excluded.url
                       returning id""",
                    (project_id, entry["url"]),
                )
                page_id = cur.fetchone()[0]

                cur.execute(
                    """insert into page_result
                         (run_id, page_id, http_status, load_error, meta, a11y, seo, links,
                          keyboard, geo, screenshot_key, a11y_count, broken_count, seo_fail_count)
                       values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (
                        run_id,
                        page_id,
                        entry.get("status"),
                        entry.get("load_error"),
                        Json(entry.get("meta") or {}),
                        Json(entry.get("a11y") or {}),
                        Json(entry.get("seo") or []),
                        Json(entry.get("links") or {}),
                        Json(entry.get("keyboard")),
                        Json(entry.get("geo") or {}),
                        shot_key,
                        a11y_count,
                        broken_count,
                        seo_fail,
                    ),
                )

            run_data = {
                "generated": data.get("generated"),
                "sites": data.get("sites") or {},
            }
            cur.execute(
                """update run set status = 'done', finished_at = now(),
                   totals = %s, data = %s where id = %s""",
                (Json(totals), Json(run_data), run_id),
            )
        conn.commit()

    print(
        f"Skrev {totals['pages']} sider til DB (prosjekt={slug}, run={run_id}). "
        f"a11y={totals['a11yViolations']} brutte={totals['brokenLinks']} "
        f"seo_fail={totals['seoFails']} lastefeil={totals['loadErrors']}"
    )
