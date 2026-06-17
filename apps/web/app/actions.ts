"use server";

import { type RunSummary, runSummarySchema } from "@/lib/analysis-schema";
import { ANALYSIS_MODEL, analyzeOnePage } from "@/lib/analyze";
import { fetchDependabotAlerts } from "@/lib/github";
import { parsePairsFromXlsx } from "@/lib/migration";
import { type SitemapInfo, inspectSitemap } from "@/lib/sitemap";
import { triggerRun } from "@/lib/spawn-worker";
import {
  type AnnotationStatus,
  type ChecklistDiscipline,
  type ChecklistSource,
  type ChecklistStatus,
  type MemberRole,
  type PageAnalysisContent,
  type ProjectMember,
  type RunOptions,
  type RunStatus,
  type SearchResults,
  addCustomChecklistItem,
  addProjectMember,
  deleteChecklistItem,
  deleteProject,
  deleteProjectMember,
  enqueueRun,
  ensureGithubSource,
  ensureMigrationProject,
  ensureProject,
  ensureWebProject,
  failRun,
  getGithubSource,
  getLatestRunPages,
  getRunStatus,
  getWebValidationConfig,
  runGithubFindings,
  saveAnnotation,
  savePageAnalysis,
  saveRunSummary,
  searchEverything,
  setChecklistItem,
  updateProjectSettings,
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
  try {
    await triggerRun(runId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Klarte ikke å starte workeren.";
    await failRun(runId, msg);
    return { error: msg };
  }
  return { runId };
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/æ/g, "ae")
      .replace(/ø/g, "o")
      .replace(/å/g, "a")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "nettsted"
  );
}

/** Oppretter et nytt nettsteds-prosjekt (navn + sitemap-URL) og returnerer slug. */
export async function addProjectAction(
  name: string,
  sitemapUrl: string,
): Promise<{ slug: string } | { error: string }> {
  const trimmedName = name.trim();
  const url = sitemapUrl.trim();
  if (!trimmedName) return { error: "Oppgi et navn." };
  try {
    new URL(url);
  } catch {
    return { error: "Oppgi en gyldig sitemap-URL (f.eks. https://nettsted.no/sitemap.xml)." };
  }
  const slug = slugify(trimmedName);
  await ensureWebProject(slug, trimmedName, url);
  revalidatePath("/");
  return { slug };
}

/** Oppretter et migrerings-prosjekt fra et opplastet Excel-ark (gammel/ny-par). */
export async function addMigrationProjectAction(
  formData: FormData,
): Promise<{ slug: string } | { error: string }> {
  const name = String(formData.get("name") ?? "").trim();
  const file = formData.get("file");
  if (!name) return { error: "Oppgi et navn." };
  if (!(file instanceof File) || file.size === 0) return { error: "Last opp en .xlsx-fil." };

  const parsed = parsePairsFromXlsx(await file.arrayBuffer());
  if ("error" in parsed) return { error: parsed.error };

  const slug = slugify(name);
  await ensureMigrationProject(slug, name, parsed.pairs);
  revalidatePath("/");
  return { slug };
}

export type ModePref = "auto" | "sitemap" | "crawl";

/** Oppdaterer prosjekt-innstillinger (navn, URL, modus-preferanse). */
export async function updateProjectSettingsAction(
  slug: string,
  data: { name?: string; url?: string; modePref?: ModePref },
): Promise<{ ok: true } | { error: string }> {
  const name = data.name?.trim();
  if (data.name !== undefined && !name) return { error: "Oppgi et navn." };
  const url = data.url?.trim();
  if (url) {
    try {
      new URL(url);
    } catch {
      return { error: "Oppgi en gyldig URL." };
    }
  }
  await updateProjectSettings(slug, { name, url, modePref: data.modePref });
  revalidatePath(`/p/${slug}`);
  revalidatePath("/");
  return { ok: true };
}

/** Sletter et prosjekt og alt under det. */
export async function deleteProjectAction(slug: string): Promise<void> {
  await deleteProject(slug);
  revalidatePath("/");
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
 * Lagrer helhets-oppsummeringen etter at den er streamet til klienten.
 * Per-side-vurderinger genereres ikke lenger automatisk — de er on-demand
 * (se `analyzePageAction`).
 */
export async function finishAnalysisAction(
  slug: string,
  summary: RunSummary,
): Promise<{ ok: true } | { error: string }> {
  try {
    const parsed = runSummarySchema.safeParse(summary);
    if (!parsed.success) return { error: "Ugyldig oppsummering fra modellen." };
    const run = await getLatestRunPages(slug);
    if (!run || run.pages.length === 0) {
      return { error: "Ingen fullført kjøring å analysere ennå." };
    }
    await saveRunSummary(run.runId, ANALYSIS_MODEL, parsed.data);
    revalidatePath(`/p/${slug}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Analysen feilet." };
  }
}

/* ---------- sjekklister per fagområde ---------- */

function revalidateChecklist(slug: string): void {
  revalidatePath(`/p/${slug}/sjekkliste`);
  revalidatePath(`/p/${slug}`);
}

/** Lagrer state (status/ansvarlige/notat) for en sjekkliste-post. */
export async function setChecklistItemAction(
  slug: string,
  item: {
    key: string;
    discipline: ChecklistDiscipline;
    source: ChecklistSource;
    title: string;
    status: ChecklistStatus;
    assignees: string[];
    note: string | null;
  },
): Promise<{ ok: true } | { error: string }> {
  const projectId = await ensureProject(slug, slug);
  const { key, ...data } = item;
  await setChecklistItem(projectId, key, data);
  revalidateChecklist(slug);
  return { ok: true };
}

/* ---------- prosjekt-deltakere ---------- */

/** Legger til en deltaker på prosjektet. */
export async function addMemberAction(
  slug: string,
  name: string,
  role: MemberRole,
): Promise<{ member: ProjectMember } | { error: string }> {
  const clean = name.trim();
  if (!clean) return { error: "Skriv et navn." };
  const projectId = await ensureProject(slug, slug);
  const member = await addProjectMember(projectId, clean, role);
  revalidateChecklist(slug);
  return { member };
}

/** Fjerner en deltaker fra prosjektet. */
export async function deleteMemberAction(slug: string, memberId: string): Promise<void> {
  const projectId = await ensureProject(slug, slug);
  await deleteProjectMember(projectId, memberId);
  revalidateChecklist(slug);
}

/** Legger til en egen sjekkliste-post; returnerer den nye nøkkelen. */
export async function addChecklistItemAction(
  slug: string,
  discipline: ChecklistDiscipline,
  title: string,
): Promise<{ key: string } | { error: string }> {
  const clean = title.trim();
  if (!clean) return { error: "Skriv en tittel." };
  const projectId = await ensureProject(slug, slug);
  const key = await addCustomChecklistItem(projectId, discipline, clean);
  revalidateChecklist(slug);
  return { key };
}

/** Fjerner en egen post / nullstiller lagret state for en post. */
export async function deleteChecklistItemAction(slug: string, key: string): Promise<void> {
  const projectId = await ensureProject(slug, slug);
  await deleteChecklistItem(projectId, key);
  revalidateChecklist(slug);
}

/** On-demand: analyser én enkelt side med AI og lagre vurderingen. */
export async function analyzePageAction(
  slug: string,
  url: string,
): Promise<{ content: PageAnalysisContent } | { error: string }> {
  try {
    const run = await getLatestRunPages(slug);
    const page = run?.pages.find((p) => p.url === url);
    if (!run || !page) return { error: "Fant ikke siden i siste kjøring." };
    const screenshot = await fetchScreenshot(page.screenshotKey);
    const content = await analyzeOnePage(page, screenshot);
    await savePageAnalysis(run.runId, page.pageId, ANALYSIS_MODEL, content);
    revalidatePath(`/p/${slug}`);
    return { content };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Analysen feilet." };
  }
}

/** Henter skjermbilde-bytes (kun fulle https-blob-URL-er) for vision-analyse. */
async function fetchScreenshot(key: string | null): Promise<Uint8Array | undefined> {
  if (!key || !/^https?:\/\//.test(key)) return undefined;
  try {
    const res = await fetch(key);
    if (!res.ok) return undefined;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return undefined;
  }
}
