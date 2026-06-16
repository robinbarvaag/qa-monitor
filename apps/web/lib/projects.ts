import { type RawPageRow, listProjectRefs, listWebProjects, loadLatestRun } from "@qa/db";
import { type Report, normalize } from "./report";

/**
 * Rapportdata leses fra DB (siste fullførte kjøring per prosjekt). Workeren
 * (`apps/worker-web`) fyller tabellene. De native jsonb-detaljene mates gjennom
 * den samme normalizeren som før, så UI-modellen er uendret.
 */

export interface Project {
  slug: string;
  name: string;
  report: Report;
}

/** Oversikts-oppføring: report er null når prosjektet ikke er kjørt ennå. */
export interface ProjectSummary {
  slug: string;
  name: string;
  report: Report | null;
}

function toRawPage(r: RawPageRow): Record<string, unknown> {
  const status = r.httpStatus;
  return {
    url: r.url,
    status,
    ok: !r.loadError && (status == null || status < 400),
    load_error: r.loadError,
    meta: r.meta ?? {},
    a11y: r.a11y ?? {},
    seo: r.seo ?? [],
    links: r.links ?? {},
    keyboard: r.keyboard ?? null,
    geo: r.geo ?? {},
    shot: r.screenshotKey,
  };
}

export async function listProjectSlugs(): Promise<string[]> {
  return (await listProjectRefs()).map((p) => p.slug);
}

export async function loadProject(slug: string): Promise<Project | null> {
  const latest = await loadLatestRun(slug);
  if (!latest) return null;
  const report = normalize({
    generated: latest.generated,
    pages: latest.pages.map(toRawPage),
    sites: latest.sites,
  });
  // Skjermbilder serveres fra apps/web/public/shots/<slug>/<fil>
  for (const page of report.pages) {
    if (page.screenshot) page.screenshot = `/shots/${slug}/${page.screenshot}`;
  }
  return { slug, name: latest.name, report };
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const refs = await listWebProjects();
  return Promise.all(
    refs.map(async (r) => {
      const loaded = await loadProject(r.slug);
      return { slug: r.slug, name: r.name, report: loaded?.report ?? null };
    }),
  );
}
