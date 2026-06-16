"use server";

import { type RunSummary, runSummarySchema } from "@/lib/analysis-schema";
import { ANALYSIS_MODEL, analyzePerPage } from "@/lib/analyze";
import { spawnWorker } from "@/lib/spawn-worker";
import {
  type AnnotationStatus,
  type RunStatus,
  type SearchResults,
  enqueueRun,
  ensureProject,
  getLatestRunPages,
  getRunStatus,
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

export async function startRunAction(slug: string): Promise<{ runId: string } | { error: string }> {
  const runId = await enqueueRun(slug);
  if (!runId) return { error: "Fant ingen valideringskilde for prosjektet." };
  spawnWorker(runId);
  return { runId };
}

export async function getRunStatusAction(runId: string): Promise<RunStatus | null> {
  return getRunStatus(runId);
}

export async function searchAction(query: string): Promise<SearchResults> {
  return searchEverything(query);
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
