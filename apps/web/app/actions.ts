"use server";

import { type RunSummary, runSummarySchema } from "@/lib/analysis-schema";
import { ANALYSIS_MODEL, analyzePerPage } from "@/lib/analyze";
import { fetchDependabotAlerts } from "@/lib/github";
import { type SitemapInfo, inspectSitemap } from "@/lib/sitemap";
import { spawnWorker } from "@/lib/spawn-worker";
import {
  type AnnotationStatus,
  type RunOptions,
  type RunStatus,
  type SearchResults,
  enqueueRun,
  ensureGithubSource,
  ensureProject,
  getGithubSource,
  getLatestRunPages,
  getRunStatus,
  getWebValidationConfig,
  runGithubFindings,
  saveAnnotation,
  saveRunAnalyses,
  searchEverything,
} from "@qa/db";
import { revalidatePath } from "next/cache";

export async function saveAnnotationAction(
  slug: string,
  target: string,
  status: AnnotationStatus | null,
  note: string,
): Promise<void> {
  const projectId = await ensureProject(slug, slug);
  await saveAnnotation(projectId, target, status, note);
  revalidatePath(`/p/${slug}`);
}

export async function startRunAction(
  slug: string,
  opts?: RunOptions,
): Promise<{ runId: string } | { error: string }> {
  const runId = await enqueueRun(slug, opts);
  if (!runId) return { error: "Fant ingen valideringskilde for prosjektet." };
  spawnWorker(runId);
  return { runId };
}

/** Pre-flight: teller sitemap-størrelse (eller melder fra om crawl-fallback). */
export async function inspectSitemapAction(slug: string): Promise<SitemapInfo | { error: string }> {
  const config = await getWebValidationConfig(slug);
  const url = typeof config?.url === "string" ? config.url : null;
  if (!url) return { error: "Fant ingen valideringskilde for prosjektet." };
  return inspectSitemap(url);
}

export async function getRunStatusAction(runId: string): Promise<RunStatus | null> {
  return getRunStatus(runId);
}

export async function searchAction(query: string): Promise<SearchResults> {
  return searchEverything(query);
}

/* ---------- GitHub / Dependabot (Fase 5) ---------- */

export async function addGithubSourceAction(
  slug: string,
  owner: string,
  repo: string,
): Promise<{ ok: true } | { error: string }> {
  const o = owner.trim().replace(/^@/, "");
  const r = repo.trim();
  if (!o || !r) return { error: "Oppgi både eier og repo." };
  await ensureGithubSource(slug, o, r);
  revalidatePath(`/p/${slug}`);
  return { ok: true };
}

export async function runGithubScanAction(
  slug: string,
): Promise<{ findings: number } | { error: string }> {
  try {
    const src = await getGithubSource(slug);
    if (!src) return { error: "Ingen GitHub-kilde koblet til prosjektet." };
    const findings = await fetchDependabotAlerts(src.owner, src.repo);
    const n = await runGithubFindings(slug, findings);
    revalidatePath(`/p/${slug}`);
    return { findings: n };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Skanningen feilet." };
  }
}

/**
 * Fullfører analysen etter at helhets-oppsummeringen er streamet til klienten:
 * genererer per-side-vurderinger og lagrer alt (summary + per-side) til DB.
 */
export async function finishAnalysisAction(
  slug: string,
  summary: RunSummary,
): Promise<{ pages: number } | { error: string }> {
  try {
    const parsed = runSummarySchema.safeParse(summary);
    if (!parsed.success) return { error: "Ugyldig oppsummering fra modellen." };
    const run = await getLatestRunPages(slug);
    if (!run || run.pages.length === 0) {
      return { error: "Ingen fullført kjøring å analysere ennå." };
    }
    const pages = await analyzePerPage(run.pages);
    await saveRunAnalyses(run.runId, ANALYSIS_MODEL, parsed.data, pages);
    revalidatePath(`/p/${slug}`);
    return { pages: pages.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Analysen feilet." };
  }
}
