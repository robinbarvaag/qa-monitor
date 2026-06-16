import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Leser den native `report.json` fra validatoren (snake_case) og normaliserer
 * den til en typet UI-modell (camelCase). Når Fase 2-workeren skriver det nye
 * formatet direkte til DB, byttes denne kilden ut — UI-modellen er stabil.
 */

/* ---------- native (snake_case) shape fra validate_pages.py ---------- */
interface RawA11y {
  violation_count?: number;
  by_impact?: Record<string, number>;
  violations?: Array<{
    id: string;
    impact: string;
    help: string;
    helpUrl: string;
    nodes: number;
    targets: string[];
  }>;
  incomplete_count?: number;
}
interface RawLink {
  url: string;
  text: string;
  status: number | null;
}
interface RawLinks {
  total?: number;
  broken?: RawLink[];
  uncertain?: RawLink[];
  ignored?: RawLink[];
}
interface RawKeyboard {
  tab_stops?: number;
  trap?: boolean;
  skip_link?: { present: boolean; text: string } | null;
  no_focus_count?: number;
  positive_tabindex?: unknown[];
  aria_hidden_count?: number;
  unreachable_count?: number;
}
interface RawPage {
  url: string;
  status: number | null;
  ok: boolean;
  load_error: string | null;
  meta?: Record<string, unknown>;
  a11y?: RawA11y;
  links?: RawLinks;
  seo?: Array<{ level: "fail" | "warn" | "ok"; key: string; msg: string }>;
  keyboard?: RawKeyboard | null;
  geo?: { signals?: Record<string, unknown>; tips?: unknown[] } | null;
  shot?: string | null;
}
interface RawSite {
  origin: string;
  base: string;
  robots?: {
    exists: boolean;
    ai_bots?: Record<string, boolean>;
    wildcard_allowed?: boolean;
    sitemaps?: string[];
  };
  llms_txt?: { exists: boolean; status?: number };
  llms_full_txt?: { exists: boolean; status?: number };
}
interface RawReport {
  generated?: string;
  source?: unknown;
  pages: RawPage[];
  sites?: Record<string, RawSite>;
}

/* ---------- normalisert UI-modell ---------- */
export type SeoLevel = "fail" | "warn" | "ok";
export interface SeoItem {
  level: SeoLevel;
  key: string;
  msg: string;
}
export interface PageA11y {
  violationCount: number;
  byImpact: Record<string, number>;
  violations: Array<{
    id: string;
    impact: string;
    help: string;
    helpUrl: string;
    nodes: number;
    targets: string[];
  }>;
  incompleteCount: number;
}
export interface PageLinks {
  total: number;
  broken: RawLink[];
  uncertain: RawLink[];
  ignored: RawLink[];
}
export interface PageKeyboard {
  tabStops: number;
  trap: boolean;
  skipLink: { present: boolean; text: string } | null;
  noFocusCount: number;
  positiveTabindexCount: number;
  ariaHiddenCount: number;
  unreachableCount: number;
}
export interface PageMeta {
  title: string | null;
  titleLength: number | null;
  metaDescription: string | null;
  descriptionLength: number | null;
  lang: string | null;
  h1Count: number;
  canonical: string | null;
  imagesTotal: number;
  imagesMissingAlt: number;
  wordCount: number;
}
export interface ReportPage {
  url: string;
  path: string;
  httpStatus: number | null;
  ok: boolean;
  loadError: string | null;
  meta: PageMeta;
  a11y: PageA11y;
  links: PageLinks;
  seo: SeoItem[];
  keyboard: PageKeyboard | null;
  jsDependent: boolean | null;
  seoFailCount: number;
}
export interface ReportSite {
  origin: string;
  base: string;
  robotsExists: boolean;
  aiBots: Record<string, boolean>;
  wildcardAllowed: boolean;
  sitemaps: string[];
  llmsTxt: boolean;
  llmsFullTxt: boolean;
}
export interface Report {
  generated: string | null;
  pages: ReportPage[];
  sites: ReportSite[];
  totals: {
    pages: number;
    a11yViolations: number;
    pagesWithA11y: number;
    brokenLinks: number;
    loadErrors: number;
    seoFails: number;
  };
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function normalizeMeta(m: Record<string, unknown> = {}): PageMeta {
  return {
    title: str(m.title),
    titleLength: typeof m.title_length === "number" ? m.title_length : null,
    metaDescription: str(m.meta_description),
    descriptionLength: typeof m.description_length === "number" ? m.description_length : null,
    lang: str(m.lang),
    h1Count: num(m.h1_count),
    canonical: str(m.canonical),
    imagesTotal: num(m.images_total),
    imagesMissingAlt: num(m.images_missing_alt),
    wordCount: num(m.word_count),
  };
}

function normalizeKeyboard(k: RawKeyboard | null | undefined): PageKeyboard | null {
  if (!k) return null;
  return {
    tabStops: num(k.tab_stops),
    trap: Boolean(k.trap),
    skipLink: k.skip_link ?? null,
    noFocusCount: num(k.no_focus_count),
    positiveTabindexCount: Array.isArray(k.positive_tabindex) ? k.positive_tabindex.length : 0,
    ariaHiddenCount: num(k.aria_hidden_count),
    unreachableCount: num(k.unreachable_count),
  };
}

function normalizePage(p: RawPage): ReportPage {
  let pathname = p.url;
  try {
    pathname = new URL(p.url).pathname || "/";
  } catch {
    /* behold rå-url */
  }
  const seo = p.seo ?? [];
  const a11y: PageA11y = {
    violationCount: num(p.a11y?.violation_count),
    byImpact: p.a11y?.by_impact ?? {},
    violations: p.a11y?.violations ?? [],
    incompleteCount: num(p.a11y?.incomplete_count),
  };
  const links: PageLinks = {
    total: num(p.links?.total),
    broken: p.links?.broken ?? [],
    uncertain: p.links?.uncertain ?? [],
    ignored: p.links?.ignored ?? [],
  };
  const jsDep = p.geo?.signals?.js_dependent;
  return {
    url: p.url,
    path: pathname,
    httpStatus: p.status,
    ok: p.ok,
    loadError: p.load_error,
    meta: normalizeMeta(p.meta),
    a11y,
    links,
    seo,
    keyboard: normalizeKeyboard(p.keyboard),
    jsDependent: typeof jsDep === "boolean" ? jsDep : null,
    seoFailCount: seo.filter((s) => s.level === "fail").length,
  };
}

function normalizeSite(s: RawSite): ReportSite {
  return {
    origin: s.origin,
    base: s.base,
    robotsExists: Boolean(s.robots?.exists),
    aiBots: s.robots?.ai_bots ?? {},
    wildcardAllowed: Boolean(s.robots?.wildcard_allowed),
    sitemaps: s.robots?.sitemaps ?? [],
    llmsTxt: Boolean(s.llms_txt?.exists),
    llmsFullTxt: Boolean(s.llms_full_txt?.exists),
  };
}

export function normalize(raw: RawReport): Report {
  const pages = (raw.pages ?? []).map(normalizePage);
  return {
    generated: str(raw.generated),
    pages,
    sites: Object.values(raw.sites ?? {}).map(normalizeSite),
    totals: {
      pages: pages.length,
      a11yViolations: pages.reduce((n, p) => n + p.a11y.violationCount, 0),
      pagesWithA11y: pages.filter((p) => p.a11y.violationCount > 0).length,
      brokenLinks: pages.reduce((n, p) => n + p.links.broken.length, 0),
      loadErrors: pages.filter((p) => p.loadError || !p.ok).length,
      seoFails: pages.reduce((n, p) => n + p.seoFailCount, 0),
    },
  };
}

export async function loadReport(): Promise<Report> {
  const file = path.join(process.cwd(), "fixtures", "report.json");
  const raw = JSON.parse(await readFile(file, "utf8")) as RawReport;
  return normalize(raw);
}
