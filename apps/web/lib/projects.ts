import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { type Report, normalize } from "./report";

/**
 * Fase 1: hvert overvåket nettsted er en `fixtures/<slug>.json` (native validator-
 * output). Legg til et nettsted ved å droppe en ny fil. I Fase 2 erstattes dette av
 * `project`-rader i DB.
 */

const FIXTURES_DIR = path.join(process.cwd(), "fixtures");

export interface Project {
  slug: string;
  name: string;
  report: Report;
}

function nameFor(slug: string, report: Report): string {
  return report.sites[0]?.origin ?? slug;
}

export async function listProjectSlugs(): Promise<string[]> {
  try {
    const files = await readdir(FIXTURES_DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort();
  } catch {
    return [];
  }
}

export async function loadProject(slug: string): Promise<Project | null> {
  try {
    const raw = JSON.parse(await readFile(path.join(FIXTURES_DIR, `${slug}.json`), "utf8"));
    const report = normalize(raw);
    // Skjermbilder serveres fra apps/web/public/shots/<slug>/<fil>
    for (const page of report.pages) {
      if (page.screenshot) page.screenshot = `/shots/${slug}/${page.screenshot}`;
    }
    return { slug, name: nameFor(slug, report), report };
  } catch {
    return null;
  }
}

export async function listProjects(): Promise<Project[]> {
  const slugs = await listProjectSlugs();
  const loaded = await Promise.all(slugs.map(loadProject));
  return loaded.filter((p): p is Project => p !== null);
}
