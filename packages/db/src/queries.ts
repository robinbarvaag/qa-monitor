import { and, eq } from "drizzle-orm";
import { db } from "./client";
import { annotation, project } from "./schema";

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
