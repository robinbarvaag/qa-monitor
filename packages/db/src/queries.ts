import { and, desc, eq } from "drizzle-orm";
import { db } from "./client";
import { annotation, page, pageResult, project, run, source } from "./schema";

/**
 * Datatilgang for oppfølging (`annotation`). Holder drizzle-spørringene i
 * @qa/db, så appen bare kaller høynivå-funksjoner (HANDOFF: server components
 * leser DB direkte via @qa/db).
 */

export type AnnotationStatus = "followup" | "done";
export interface AnnotationEntry {
  status: AnnotationStatus | null;
  note: string | null;
}
export type AnnotationMap = Record<string, AnnotationEntry>;

/** Sikrer at det finnes en project-rad for slug-en, returnerer id. */
export async function ensureProject(slug: string, name: string): Promise<string> {
  await db.insert(project).values({ slug, name }).onConflictDoNothing({ target: project.slug });
  const rows = await db
    .select({ id: project.id })
    .from(project)
    .where(eq(project.slug, slug))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error(`Kunne ikke opprette/finne prosjekt: ${slug}`);
  return row.id;
}

export async function getAnnotations(projectId: string): Promise<AnnotationMap> {
  const rows = await db
    .select({ targetKey: annotation.targetKey, status: annotation.status, note: annotation.note })
    .from(annotation)
    .where(eq(annotation.projectId, projectId));
  const map: AnnotationMap = {};
  for (const r of rows) map[r.targetKey] = { status: r.status, note: r.note };
  return map;
}

/* ---------- lesing av rapportdata (siste fullførte kjøring) ---------- */

export interface ProjectRef {
  slug: string;
  name: string;
}

/** Alle prosjekter som har minst én fullført web_validation-kjøring. */
export async function listProjectRefs(): Promise<ProjectRef[]> {
  const rows = await db
    .selectDistinct({ slug: project.slug, name: project.name })
    .from(project)
    .innerJoin(source, eq(source.projectId, project.id))
    .innerJoin(run, eq(run.sourceId, source.id))
    .where(eq(run.status, "done"))
    .orderBy(project.slug);
  return rows;
}

/** Én side-rad fra siste kjøring (native jsonb-detaljer + side-URL). */
export interface RawPageRow {
  url: string;
  httpStatus: number | null;
  loadError: string | null;
  meta: unknown;
  a11y: unknown;
  seo: unknown;
  links: unknown;
  keyboard: unknown;
  geo: unknown;
  screenshotKey: string | null;
}

export interface LatestRun {
  name: string;
  generated: string | null;
  sites: unknown;
  pages: RawPageRow[];
}

/** Siste fullførte kjøring for et prosjekt, med alle side-resultater. */
export async function loadLatestRun(slug: string): Promise<LatestRun | null> {
  const runs = await db
    .select({ id: run.id, data: run.data, name: project.name })
    .from(run)
    .innerJoin(source, eq(source.id, run.sourceId))
    .innerJoin(project, eq(project.id, source.projectId))
    .where(and(eq(project.slug, slug), eq(run.status, "done")))
    .orderBy(desc(run.finishedAt))
    .limit(1);
  const latest = runs[0];
  if (!latest) return null;

  const rows = await db
    .select({
      url: page.url,
      httpStatus: pageResult.httpStatus,
      loadError: pageResult.loadError,
      meta: pageResult.meta,
      a11y: pageResult.a11y,
      seo: pageResult.seo,
      links: pageResult.links,
      keyboard: pageResult.keyboard,
      geo: pageResult.geo,
      screenshotKey: pageResult.screenshotKey,
    })
    .from(pageResult)
    .innerJoin(page, eq(page.id, pageResult.pageId))
    .where(eq(pageResult.runId, latest.id));

  const data = (latest.data ?? {}) as { generated?: string; sites?: unknown };
  return {
    name: latest.name,
    generated: data.generated ?? null,
    sites: data.sites ?? {},
    pages: rows,
  };
}

/* ---------- trigge kjøringer (Fase 3) ---------- */

export type RunStatusValue = "queued" | "running" | "done" | "error";

/** Oppretter en køet `run` for prosjektets web_validation-kilde. */
export async function enqueueRun(slug: string): Promise<string | null> {
  const rows = await db
    .select({ sourceId: source.id })
    .from(source)
    .innerJoin(project, eq(project.id, source.projectId))
    .where(and(eq(project.slug, slug), eq(source.type, "web_validation")))
    .limit(1);
  const src = rows[0];
  if (!src) return null;
  const inserted = await db
    .insert(run)
    .values({ sourceId: src.sourceId, status: "queued" })
    .returning({ id: run.id });
  return inserted[0]?.id ?? null;
}

export interface RunStatus {
  status: RunStatusValue;
  progress: { done: number; total: number } | null;
  error: string | null;
}

export async function getRunStatus(runId: string): Promise<RunStatus | null> {
  const rows = await db
    .select({ status: run.status, data: run.data, error: run.error })
    .from(run)
    .where(eq(run.id, runId))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  const data = (r.data ?? {}) as { progress?: { done: number; total: number } };
  return { status: r.status, progress: data.progress ?? null, error: r.error };
}

export async function saveAnnotation(
  projectId: string,
  targetKey: string,
  status: AnnotationStatus | null,
  note: string,
): Promise<void> {
  const cleanNote = note.trim();
  if (!status && !cleanNote) {
    await db
      .delete(annotation)
      .where(and(eq(annotation.projectId, projectId), eq(annotation.targetKey, targetKey)));
    return;
  }
  await db
    .insert(annotation)
    .values({ projectId, targetKey, status, note: cleanNote || null })
    .onConflictDoUpdate({
      target: [annotation.projectId, annotation.targetKey],
      set: { status, note: cleanNote || null, updatedAt: new Date() },
    });
}
