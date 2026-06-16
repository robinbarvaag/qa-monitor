"use server";

import { spawnWorker } from "@/lib/spawn-worker";
import {
  type AnnotationStatus,
  type RunStatus,
  enqueueRun,
  ensureProject,
  getRunStatus,
  saveAnnotation,
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
