import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "./client";
import {
  analysis,
  annotation,
  checklistItem,
  finding,
  page,
  pageResult,
  project,
  projectMember,
  run,
  source,
} from "./schema";

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
    .where(and(eq(source.type, "web_validation"), eq(run.status, "done")))
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
  js: unknown;
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
    .where(and(eq(project.slug, slug), eq(source.type, "web_validation"), eq(run.status, "done")))
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
      js: pageResult.js,
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
export type RunMode = "sitemap" | "crawl";

export interface RunOptions {
  limit?: number | null;
  mode?: RunMode;
}

/** Navnet til et prosjekt (uavhengig av kjøringer). */
export async function getProjectName(slug: string): Promise<string | null> {
  const rows = await db
    .select({ name: project.name })
    .from(project)
    .where(eq(project.slug, slug))
    .limit(1);
  return rows[0]?.name ?? null;
}

/** Alle prosjekter som har en web_validation-kilde (uavhengig av kjøringer). */
export async function listWebProjects(): Promise<ProjectRef[]> {
  return db
    .selectDistinct({ slug: project.slug, name: project.name })
    .from(project)
    .innerJoin(source, eq(source.projectId, project.id))
    .where(eq(source.type, "web_validation"))
    .orderBy(project.name);
}

/** Oppretter/oppdaterer et nettsteds-prosjekt med web_validation-kilde (sitemap). */
export async function ensureWebProject(
  slug: string,
  name: string,
  sitemapUrl: string,
): Promise<void> {
  const projectId = await ensureProject(slug, name);
  const config = { mode: "sitemap", url: sitemapUrl, screenshots: true };
  const existing = await db
    .select({ id: source.id })
    .from(source)
    .where(and(eq(source.projectId, projectId), eq(source.type, "web_validation")))
    .limit(1);
  if (existing[0]) {
    await db.update(source).set({ config, name: sitemapUrl }).where(eq(source.id, existing[0].id));
  } else {
    await db.insert(source).values({ projectId, type: "web_validation", name: sitemapUrl, config });
  }
}

/** Ett gammel/ny-URL-par fra et migrerings-regneark. */
export interface MigrationPairInput {
  old: string;
  new: string;
  pairKey: string;
  extra: Record<string, string>;
}

/** Oppretter/oppdaterer et migrerings-prosjekt (mode=migration med par i config). */
export async function ensureMigrationProject(
  slug: string,
  name: string,
  pairs: MigrationPairInput[],
): Promise<void> {
  const projectId = await ensureProject(slug, name);
  const config = { mode: "migration", pairs, screenshots: true };
  const sourceName = `${pairs.length} par (migrering)`;
  const existing = await db
    .select({ id: source.id })
    .from(source)
    .where(and(eq(source.projectId, projectId), eq(source.type, "web_validation")))
    .limit(1);
  if (existing[0]) {
    await db.update(source).set({ config, name: sourceName }).where(eq(source.id, existing[0].id));
  } else {
    await db.insert(source).values({ projectId, type: "web_validation", name: sourceName, config });
  }
}

/** Sletter et prosjekt og alt under det (cascade på source/run/page/… i schema). */
export async function deleteProject(slug: string): Promise<void> {
  await db.delete(project).where(eq(project.slug, slug));
}

/** Oppdaterer navn og/eller web_validation-kildens url + modus-preferanse. */
export async function updateProjectSettings(
  slug: string,
  data: { name?: string; url?: string; modePref?: string },
): Promise<void> {
  if (data.name !== undefined) {
    await db.update(project).set({ name: data.name }).where(eq(project.slug, slug));
  }
  if (data.url === undefined && data.modePref === undefined) return;

  const rows = await db
    .select({ id: source.id, config: source.config })
    .from(source)
    .innerJoin(project, eq(project.id, source.projectId))
    .where(and(eq(project.slug, slug), eq(source.type, "web_validation")))
    .limit(1);
  const src = rows[0];
  if (!src) return;
  const config = { ...((src.config ?? {}) as Record<string, unknown>) };
  if (data.url !== undefined) config.url = data.url;
  if (data.modePref !== undefined) config.modePref = data.modePref;
  await db.update(source).set({ config }).where(eq(source.id, src.id));
}

/** Henter web_validation-kildens config (bl.a. sitemap-url) for et prosjekt. */
export async function getWebValidationConfig(
  slug: string,
): Promise<Record<string, unknown> | null> {
  const rows = await db
    .select({ config: source.config })
    .from(source)
    .innerJoin(project, eq(project.id, source.projectId))
    .where(and(eq(project.slug, slug), eq(source.type, "web_validation")))
    .limit(1);
  return rows[0]?.config ?? null;
}

/** Oppretter en køet `run` for prosjektets web_validation-kilde. */
export async function enqueueRun(slug: string, opts?: RunOptions): Promise<string | null> {
  const rows = await db
    .select({ sourceId: source.id, config: source.config })
    .from(source)
    .innerJoin(project, eq(project.id, source.projectId))
    .where(and(eq(project.slug, slug), eq(source.type, "web_validation")))
    .limit(1);
  const src = rows[0];
  if (!src) return null;

  if (opts) {
    const current = (src.config ?? {}) as Record<string, unknown>;
    const config = {
      ...current,
      limit: opts.limit ?? null,
      mode: opts.mode ?? (current.mode as RunMode | undefined) ?? "sitemap",
    };
    await db.update(source).set({ config }).where(eq(source.id, src.sourceId));
  }

  const inserted = await db
    .insert(run)
    .values({ sourceId: src.sourceId, status: "queued" })
    .returning({ id: run.id });
  return inserted[0]?.id ?? null;
}

/** Markerer en kjøring som feilet (f.eks. hvis worker-triggeren ikke nådde fram). */
export async function failRun(runId: string, message: string): Promise<void> {
  await db
    .update(run)
    .set({ status: "error", finishedAt: new Date(), error: message.slice(0, 1000) })
    .where(eq(run.id, runId));
}

export interface RunStatus {
  status: RunStatusValue;
  progress: { done: number; total: number } | null;
  error: string | null;
}

/** Siste ikke-fullførte (queued/running) web_validation-kjøring, om noen. Lar
 *  UI-et gjenoppta progresjons-polling etter en refresh. */
export async function getActiveRun(slug: string): Promise<string | null> {
  const rows = await db
    .select({ id: run.id })
    .from(run)
    .innerJoin(source, eq(source.id, run.sourceId))
    .innerJoin(project, eq(project.id, source.projectId))
    .where(
      and(
        eq(project.slug, slug),
        eq(source.type, "web_validation"),
        or(eq(run.status, "queued"), eq(run.status, "running")),
      ),
    )
    .orderBy(desc(run.startedAt))
    .limit(1);
  return rows[0]?.id ?? null;
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

/* ---------- historikk / trend over tid ---------- */

/** Aggregatene én kjøring lagrer i `run.totals`. */
export interface RunTotals {
  pages: number;
  a11yViolations: number;
  brokenLinks: number;
  seoFails: number;
  loadErrors: number;
}

/** Ett punkt i trend-grafen: én fullført kjøring med tidspunkt + totaler. */
export interface RunHistoryPoint {
  finishedAt: string;
  totals: RunTotals;
}

/** Denormaliserte tellere for én side i én kjøring (for per-side delta). */
export interface PageCounts {
  a11y: number;
  broken: number;
  seo: number;
}

function normalizeTotals(raw: Record<string, number> | null): RunTotals {
  const t = raw ?? {};
  return {
    pages: t.pages ?? 0,
    a11yViolations: t.a11yViolations ?? 0,
    brokenLinks: t.brokenLinks ?? 0,
    seoFails: t.seoFails ?? 0,
    loadErrors: t.loadErrors ?? 0,
  };
}

/** Siste N fullførte web_validation-kjøringer, kronologisk stigende (for trend). */
export async function getRunHistory(slug: string, limit = 12): Promise<RunHistoryPoint[]> {
  const rows = await db
    .select({ finishedAt: run.finishedAt, totals: run.totals })
    .from(run)
    .innerJoin(source, eq(source.id, run.sourceId))
    .innerJoin(project, eq(project.id, source.projectId))
    .where(and(eq(project.slug, slug), eq(source.type, "web_validation"), eq(run.status, "done")))
    .orderBy(desc(run.finishedAt))
    .limit(limit);
  // hentet nyeste→eldste for å få de N siste; snu til kronologisk stigende for grafen
  return rows.reverse().map((r) => ({
    finishedAt: (r.finishedAt ?? new Date(0)).toISOString(),
    totals: normalizeTotals(r.totals),
  }));
}

/** Tellere per side fra nest siste fullførte kjøring (url → counts), eller null. */
export async function getPreviousRunCounts(
  slug: string,
): Promise<Record<string, PageCounts> | null> {
  const runs = await db
    .select({ id: run.id })
    .from(run)
    .innerJoin(source, eq(source.id, run.sourceId))
    .innerJoin(project, eq(project.id, source.projectId))
    .where(and(eq(project.slug, slug), eq(source.type, "web_validation"), eq(run.status, "done")))
    .orderBy(desc(run.finishedAt))
    .limit(2);
  const prevId = runs[1]?.id;
  if (!prevId) return null;

  const rows = await db
    .select({
      url: page.url,
      a11y: pageResult.a11yCount,
      broken: pageResult.brokenCount,
      seo: pageResult.seoFailCount,
    })
    .from(pageResult)
    .innerJoin(page, eq(page.id, pageResult.pageId))
    .where(eq(pageResult.runId, prevId));

  const map: Record<string, PageCounts> = {};
  for (const r of rows) map[r.url] = { a11y: r.a11y, broken: r.broken, seo: r.seo };
  return map;
}

/* ---------- migrering (gammel vs ny) ---------- */

/** Modus for prosjektets web_validation-kilde ("sitemap" | "crawl" | "migration"). */
export async function getProjectMode(slug: string): Promise<string | null> {
  const config = await getWebValidationConfig(slug);
  const mode = config?.mode;
  return typeof mode === "string" ? mode : null;
}

/** Én side (gammel eller ny) i et migrerings-par. */
export interface MigrationSide {
  url: string;
  httpStatus: number | null;
  a11y: number;
  broken: number;
  seo: number;
  screenshotKey: string | null;
}

/** Et gammel↔ny-par fra siste migrerings-kjøring. */
export interface MigrationPair {
  pairKey: string;
  old: MigrationSide | null;
  new: MigrationSide | null;
}

/** Par fra siste fullførte migrerings-kjøring, gruppert på pairKey. */
export async function getMigrationPairs(slug: string): Promise<MigrationPair[]> {
  const runId = await latestDoneRunId(slug);
  if (!runId) return [];

  const rows = await db
    .select({
      pairKey: page.pairKey,
      label: page.label,
      url: page.url,
      httpStatus: pageResult.httpStatus,
      a11y: pageResult.a11yCount,
      broken: pageResult.brokenCount,
      seo: pageResult.seoFailCount,
      screenshotKey: pageResult.screenshotKey,
    })
    .from(pageResult)
    .innerJoin(page, eq(page.id, pageResult.pageId))
    .where(eq(pageResult.runId, runId));

  const byKey = new Map<string, MigrationPair>();
  for (const r of rows) {
    if (!r.pairKey) continue;
    let pair = byKey.get(r.pairKey);
    if (!pair) {
      pair = { pairKey: r.pairKey, old: null, new: null };
      byKey.set(r.pairKey, pair);
    }
    const side: MigrationSide = {
      url: r.url,
      httpStatus: r.httpStatus,
      a11y: r.a11y,
      broken: r.broken,
      seo: r.seo,
      screenshotKey: r.screenshotKey,
    };
    if (r.label === "gammel") pair.old = side;
    else pair.new = side;
  }

  return [...byKey.values()].sort((a, b) =>
    (a.old?.url ?? a.new?.url ?? "").localeCompare(b.old?.url ?? b.new?.url ?? ""),
  );
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
  /** Visuell vurdering fra skjermbildet (avstander/konsistens); tom hvis ikke vurdert. */
  visual?: string;
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
  meta: unknown;
  a11y: unknown;
  seo: unknown;
  links: unknown;
  keyboard: unknown;
  screenshotKey: string | null;
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
    .where(and(eq(project.slug, slug), eq(source.type, "web_validation"), eq(run.status, "done")))
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
      meta: pageResult.meta,
      a11y: pageResult.a11y,
      seo: pageResult.seo,
      links: pageResult.links,
      keyboard: pageResult.keyboard,
      screenshotKey: pageResult.screenshotKey,
    })
    .from(pageResult)
    .innerJoin(page, eq(page.id, pageResult.pageId))
    .where(eq(pageResult.runId, runId));
  return { runId, name: slug, pages: rows };
}

/** Lagrer (kun) helhets-oppsummeringen for kjøringen; rører ikke per-side. */
export async function saveRunSummary(
  runId: string,
  model: string,
  summary: RunSummaryContent,
): Promise<void> {
  await db.delete(analysis).where(and(eq(analysis.runId, runId), isNull(analysis.pageId)));
  await db.insert(analysis).values({
    runId,
    pageId: null,
    kind: "run_summary",
    model,
    content: summary as unknown as Record<string, unknown>,
  });
}

/** Lagrer (on-demand) AI-vurderingen for én side; erstatter evt. forrige. */
export async function savePageAnalysis(
  runId: string,
  pageId: string,
  model: string,
  content: PageAnalysisContent,
): Promise<void> {
  await db
    .delete(analysis)
    .where(and(eq(analysis.runId, runId), eq(analysis.pageId, pageId), eq(analysis.kind, "page")));
  await db.insert(analysis).values({
    runId,
    pageId,
    kind: "page",
    model,
    content: content as unknown as Record<string, unknown>,
  });
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

/* ---------- GitHub / Dependabot-kilde (Fase 5) ---------- */

export type FindingSeverity = "critical" | "serious" | "moderate" | "minor" | "info";

export interface GithubConfig {
  owner: string;
  repo: string;
}

/** Ett Dependabot-funn klart for innskriving. */
export interface FindingInput {
  severity: FindingSeverity;
  subject: string;
  fingerprint: string;
  title: string;
  data: Record<string, unknown>;
}

/** Funn-rad for UI (fra siste github-kjøring). */
export interface FindingRow {
  severity: FindingSeverity;
  subject: string | null;
  fingerprint: string;
  title: string;
  data: Record<string, unknown>;
}

/** Henter github-kildens config (owner/repo) for et prosjekt, om den finnes. */
export async function getGithubSource(slug: string): Promise<GithubConfig | null> {
  const rows = await db
    .select({ config: source.config })
    .from(source)
    .innerJoin(project, eq(project.id, source.projectId))
    .where(and(eq(project.slug, slug), eq(source.type, "github")))
    .limit(1);
  const c = rows[0]?.config as Partial<GithubConfig> | undefined;
  if (!c?.owner || !c.repo) return null;
  return { owner: c.owner, repo: c.repo };
}

/** Oppretter/oppdaterer github-kilden for prosjektet (én per prosjekt). */
export async function ensureGithubSource(slug: string, owner: string, repo: string): Promise<void> {
  const projectId = await ensureProject(slug, slug);
  const existing = await db
    .select({ id: source.id })
    .from(source)
    .where(and(eq(source.projectId, projectId), eq(source.type, "github")))
    .limit(1);
  const config = { owner, repo };
  const name = `${owner}/${repo}`;
  if (existing[0]) {
    await db.update(source).set({ config, name }).where(eq(source.id, existing[0].id));
  } else {
    await db.insert(source).values({ projectId, type: "github", name, config });
  }
}

/** Oppretter en github-kjøring (status=done) og skriver funn-radene. */
export async function runGithubFindings(slug: string, findings: FindingInput[]): Promise<number> {
  const rows = await db
    .select({ sourceId: source.id, projectId: source.projectId })
    .from(source)
    .innerJoin(project, eq(project.id, source.projectId))
    .where(and(eq(project.slug, slug), eq(source.type, "github")))
    .limit(1);
  const src = rows[0];
  if (!src) throw new Error("Ingen GitHub-kilde for prosjektet.");

  const now = new Date();
  const inserted = await db
    .insert(run)
    .values({
      sourceId: src.sourceId,
      status: "done",
      startedAt: now,
      finishedAt: now,
      totals: { findings: findings.length },
    })
    .returning({ id: run.id });
  const runId = inserted[0]?.id;
  if (!runId) throw new Error("Kunne ikke opprette kjøring.");

  if (findings.length > 0) {
    await db.insert(finding).values(
      findings.map((f) => ({
        runId,
        projectId: src.projectId,
        kind: "dependency_vuln" as const,
        severity: f.severity,
        subject: f.subject,
        fingerprint: f.fingerprint,
        title: f.title,
        data: f.data,
      })),
    );
  }
  return findings.length;
}

async function latestGithubRunId(slug: string): Promise<string | null> {
  const runs = await db
    .select({ id: run.id })
    .from(run)
    .innerJoin(source, eq(source.id, run.sourceId))
    .innerJoin(project, eq(project.id, source.projectId))
    .where(and(eq(project.slug, slug), eq(source.type, "github"), eq(run.status, "done")))
    .orderBy(desc(run.finishedAt))
    .limit(1);
  return runs[0]?.id ?? null;
}

/** Funn fra siste fullførte github-kjøring for prosjektet. */
export async function getLatestFindings(slug: string): Promise<FindingRow[]> {
  const runId = await latestGithubRunId(slug);
  if (!runId) return [];

  const rows = await db
    .select({
      severity: finding.severity,
      subject: finding.subject,
      fingerprint: finding.fingerprint,
      title: finding.title,
      data: finding.data,
    })
    .from(finding)
    .where(eq(finding.runId, runId));
  return rows.map((r) => ({ ...r, data: (r.data ?? {}) as Record<string, unknown> }));
}

/* ---------- AI-utbedringsplan for funn (lagres i github-run.data) ---------- */

export type FindingRisk = "low" | "medium" | "high";

export interface FindingsAction {
  title: string;
  severity: FindingSeverity;
  risk: FindingRisk;
  command: string;
  addresses: number;
  detail: string;
}

export interface FindingsSummaryContent {
  headline: string;
  actions: FindingsAction[];
}

export interface FindingsAnalysis {
  model: string;
  analyzedAt: string;
  summary: FindingsSummaryContent;
}

/** Lagrer AI-utbedringsplanen på siste github-kjøring (regenereres ved ny skann). */
export async function saveFindingsAnalysis(
  slug: string,
  model: string,
  summary: FindingsSummaryContent,
): Promise<void> {
  const runId = await latestGithubRunId(slug);
  if (!runId) return;
  await db
    .update(run)
    .set({
      data: { analysis: summary, model, analyzedAt: new Date().toISOString() } as Record<
        string,
        unknown
      >,
    })
    .where(eq(run.id, runId));
}

/** Henter lagret AI-utbedringsplan for siste github-kjøring. */
export async function getFindingsAnalysis(slug: string): Promise<FindingsAnalysis | null> {
  const runId = await latestGithubRunId(slug);
  if (!runId) return null;
  const rows = await db.select({ data: run.data }).from(run).where(eq(run.id, runId)).limit(1);
  const data = rows[0]?.data as
    | { analysis?: FindingsSummaryContent; model?: string; analyzedAt?: string }
    | undefined;
  if (!data?.analysis || !data.model || !data.analyzedAt) return null;
  return { model: data.model, analyzedAt: data.analyzedAt, summary: data.analysis };
}

/* ---------- sjekklister per fagområde ---------- */

export type ChecklistDiscipline =
  | "a11y"
  | "seo"
  | "content"
  | "design"
  | "performance"
  | "security";
export type ChecklistSource = "curated" | "auto" | "custom";
export type ChecklistStatus = "open" | "in_progress" | "done" | "na";

/** Lagret state for én sjekkliste-post (keyet på `key`). */
export interface ChecklistStateEntry {
  source: ChecklistSource;
  discipline: ChecklistDiscipline;
  title: string;
  status: ChecklistStatus;
  assignees: string[]; // project_member-id-er
  note: string | null;
}
export type ChecklistState = Record<string, ChecklistStateEntry>;

/** All lagret sjekkliste-state for et prosjekt, keyet på post-`key`. */
export async function getChecklistState(projectId: string): Promise<ChecklistState> {
  const rows = await db
    .select({
      key: checklistItem.key,
      source: checklistItem.source,
      discipline: checklistItem.discipline,
      title: checklistItem.title,
      status: checklistItem.status,
      assignees: checklistItem.assignees,
      note: checklistItem.note,
    })
    .from(checklistItem)
    .where(eq(checklistItem.projectId, projectId));
  const map: ChecklistState = {};
  for (const r of rows) {
    map[r.key] = {
      source: r.source,
      discipline: r.discipline,
      title: r.title,
      status: r.status,
      assignees: r.assignees ?? [],
      note: r.note,
    };
  }
  return map;
}

/** Upsert state for en sjekkliste-post (kurert/auto/custom). */
export async function setChecklistItem(
  projectId: string,
  key: string,
  data: {
    discipline: ChecklistDiscipline;
    source: ChecklistSource;
    title: string;
    status: ChecklistStatus;
    assignees: string[];
    note: string | null;
  },
): Promise<void> {
  await db
    .insert(checklistItem)
    .values({ projectId, key, ...data })
    .onConflictDoUpdate({
      target: [checklistItem.projectId, checklistItem.key],
      set: {
        status: data.status,
        assignees: data.assignees,
        note: data.note,
        title: data.title,
        updatedAt: new Date(),
      },
    });
}

/** Oppretter en egen (custom) sjekkliste-post; returnerer den nye `key`-en. */
export async function addCustomChecklistItem(
  projectId: string,
  discipline: ChecklistDiscipline,
  title: string,
): Promise<string> {
  const key = `custom:${crypto.randomUUID()}`;
  await db.insert(checklistItem).values({
    projectId,
    key,
    discipline,
    source: "custom",
    title,
    status: "open",
  });
  return key;
}

/** Fjerner en sjekkliste-post (egen post) eller nullstiller lagret state. */
export async function deleteChecklistItem(projectId: string, key: string): Promise<void> {
  await db
    .delete(checklistItem)
    .where(and(eq(checklistItem.projectId, projectId), eq(checklistItem.key, key)));
}

/* ---------- prosjekt-deltakere ---------- */

export type MemberRole = "sales" | "developer" | "designer" | "pm" | "other";

export interface ProjectMember {
  id: string;
  name: string;
  role: MemberRole;
}

/** Deltakerne på et prosjekt (brukes som «ansvarlig»-valg i sjekklistene). */
export async function listProjectMembers(projectId: string): Promise<ProjectMember[]> {
  return db
    .select({ id: projectMember.id, name: projectMember.name, role: projectMember.role })
    .from(projectMember)
    .where(eq(projectMember.projectId, projectId))
    .orderBy(projectMember.name);
}

/** Legger til en deltaker; returnerer den nye raden. */
export async function addProjectMember(
  projectId: string,
  name: string,
  role: MemberRole,
): Promise<ProjectMember> {
  const rows = await db
    .insert(projectMember)
    .values({ projectId, name, role })
    .returning({ id: projectMember.id, name: projectMember.name, role: projectMember.role });
  const row = rows[0];
  if (!row) throw new Error("Kunne ikke opprette deltaker.");
  return row;
}

/** Fjerner en deltaker fra prosjektet. */
export async function deleteProjectMember(projectId: string, memberId: string): Promise<void> {
  await db
    .delete(projectMember)
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.id, memberId)));
}

/* ---------- globalt søk (⌘K) ---------- */

export interface SearchResults {
  projects: { slug: string; name: string }[];
  pages: { slug: string; url: string }[];
}

/** Fritekstsøk på tvers av prosjekter og overvåkede sider (URL). */
export async function searchEverything(query: string): Promise<SearchResults> {
  const q = query.trim();
  if (q.length < 2) return { projects: [], pages: [] };
  const like = `%${q}%`;

  const projects = await db
    .select({ slug: project.slug, name: project.name })
    .from(project)
    .where(or(ilike(project.name, like), ilike(project.slug, like)))
    .orderBy(project.name)
    .limit(6);

  const pages = await db
    .selectDistinct({ slug: project.slug, url: page.url })
    .from(page)
    .innerJoin(project, eq(project.id, page.projectId))
    .where(ilike(page.url, like))
    .orderBy(page.url)
    .limit(12);

  return { projects, pages };
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
