import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "./client";
import { analysis, annotation, page, pageResult, project, run, source } from "./schema";

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

/* ---------- AI-analyse (Fase 4) ---------- */

export type AnalysisSeverity = "critical" | "serious" | "moderate" | "minor" | "info";

/** Ett prioritert problem i helhetsanalysen. */
export interface AnalysisIssue {
  severity: AnalysisSeverity;
  title: string;
  detail: string;
  suggestion: string;
  pages?: string[]; // berørte stier/URL-er
}

/** Helhetlig analyse for én kjøring (kind=run_summary). */
export interface RunSummaryContent {
  headline: string;
  issues: AnalysisIssue[];
}

/** AI-vurdering av én side (kind=page). */
export interface PageAnalysisContent {
  severity: AnalysisSeverity;
  assessment: string;
  suggestions: string[];
}

/** Alt av AI-analyse for siste kjøring, klar for UI. */
export interface RunAnalyses {
  model: string;
  createdAt: string;
  summary: RunSummaryContent | null;
  byUrl: Record<string, PageAnalysisContent>;
}

/** Én side fra siste kjøring med id + detaljer (for å mate analysen). */
export interface RunPageDetail {
  pageId: string;
  url: string;
  httpStatus: number | null;
  loadError: string | null;
  a11y: unknown;
  seo: unknown;
  links: unknown;
  keyboard: unknown;
}

export interface LatestRunPages {
  runId: string;
  name: string;
  pages: RunPageDetail[];
}

async function latestDoneRunId(slug: string): Promise<string | null> {
  const runs = await db
    .select({ id: run.id })
    .from(run)
    .innerJoin(source, eq(source.id, run.sourceId))
    .innerJoin(project, eq(project.id, source.projectId))
    .where(and(eq(project.slug, slug), eq(run.status, "done")))
    .orderBy(desc(run.finishedAt))
    .limit(1);
  return runs[0]?.id ?? null;
}

/** Siste fullførte kjøring med side-id + rå detaljer (input til analysen). */
export async function getLatestRunPages(slug: string): Promise<LatestRunPages | null> {
  const runId = await latestDoneRunId(slug);
  if (!runId) return null;
  const rows = await db
    .select({
      pageId: page.id,
      url: page.url,
      httpStatus: pageResult.httpStatus,
      loadError: pageResult.loadError,
      a11y: pageResult.a11y,
      seo: pageResult.seo,
      links: pageResult.links,
      keyboard: pageResult.keyboard,
    })
    .from(pageResult)
    .innerJoin(page, eq(page.id, pageResult.pageId))
    .where(eq(pageResult.runId, runId));
  return { runId, name: slug, pages: rows };
}

/** Lagrer en frisk analyse for kjøringen (sletter forrige først). */
export async function saveRunAnalyses(
  runId: string,
  model: string,
  summary: RunSummaryContent,
  pages: { pageId: string; content: PageAnalysisContent }[],
): Promise<void> {
  await db.delete(analysis).where(eq(analysis.runId, runId));
  await db.insert(analysis).values({
    runId,
    pageId: null,
    kind: "run_summary",
    model,
    content: summary as unknown as Record<string, unknown>,
  });
  if (pages.length > 0) {
    await db.insert(analysis).values(
      pages.map((p) => ({
        runId,
        pageId: p.pageId,
        kind: "page" as const,
        model,
        content: p.content as unknown as Record<string, unknown>,
      })),
    );
  }
}

/** Henter AI-analysen for siste kjøring, keyet på side-URL. */
export async function getRunAnalyses(slug: string): Promise<RunAnalyses | null> {
  const runId = await latestDoneRunId(slug);
  if (!runId) return null;

  const summaryRows = await db
    .select({ model: analysis.model, content: analysis.content, createdAt: analysis.createdAt })
    .from(analysis)
    .where(and(eq(analysis.runId, runId), isNull(analysis.pageId)))
    .limit(1);
  const summaryRow = summaryRows[0];
  if (!summaryRow) return null;

  const pageRows = await db
    .select({ url: page.url, content: analysis.content })
    .from(analysis)
    .innerJoin(page, eq(page.id, analysis.pageId))
    .where(and(eq(analysis.runId, runId), eq(analysis.kind, "page")));

  const byUrl: Record<string, PageAnalysisContent> = {};
  for (const r of pageRows) byUrl[r.url] = r.content as unknown as PageAnalysisContent;

  return {
    model: summaryRow.model,
    createdAt: summaryRow.createdAt.toISOString(),
    summary: summaryRow.content as unknown as RunSummaryContent,
    byUrl,
  };
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
