"use server";

import { type AnnotationStatus, ensureProject, saveAnnotation } from "@qa/db";
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
