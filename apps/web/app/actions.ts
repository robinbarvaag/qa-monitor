"use server";

import { ANALYSIS_MODEL, analyzePages } from "@/lib/analyze";
import { spawnWorker } from "@/lib/spawn-worker";
import {
  type AnnotationStatus,
  type RunStatus,
  enqueueRun,
  ensureProject,
  getLatestRunPages,
  getRunStatus,
  saveAnnotation,
  saveRunAnalyses,
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

export async function analyzeRunAction(
  slug: string,
): Promise<{ pages: number } | { error: string }> {
  try {
    const run = await getLatestRunPages(slug);
    if (!run || run.pages.length === 0) {
      return { error: "Ingen fullført kjøring å analysere ennå." };
    }
    const result = await analyzePages(run.pages, slug);
    await saveRunAnalyses(run.runId, ANALYSIS_MODEL, result.summary, result.pages);
    revalidatePath(`/p/${slug}`);
    return { pages: result.pages.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Analysen feilet." };
  }
}
