/**
 * Kontrakten mellom Python-validatoren og resten av systemet.
 * Valider Python-outputen mot denne (via JSON Schema generert fra disse
 * typene) i CI, så kan ikke de to sidene drifte fra hverandre.
 */
export type Severity = "critical" | "serious" | "moderate" | "minor" | "info";
export type SeoLevel = "fail" | "warn" | "ok";

export interface SeoItem {
  level: SeoLevel;
  key: string;
  msg: string;
}

export interface A11yResult {
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

export interface LinkResult {
  total: number;
  broken: Array<{ url: string; text: string; status: number | null }>;
  uncertain: Array<{ url: string; text: string; status: number | null }>;
  ignored: Array<{ url: string; text: string; status: number | null }>;
}

export interface KeyboardResult {
  tabStops: number;
  trap: boolean;
  skipLink: { present: boolean; text: string } | null;
  noFocusCount: number;
  positiveTabindex: unknown[];
  ariaHiddenCount: number;
  unreachableCount: number;
}

/** Resultat for én overvåket URL i én kjøring. */
export interface PageResultData {
  url: string;
  /** Valgfri migrerings-kobling: to sider med samme pairKey vises side-om-side. */
  pairKey?: string | null;
  label?: string | null;
  httpStatus: number | null;
  loadError: string | null;
  meta: Record<string, unknown>;
  a11y: A11yResult;
  seo: SeoItem[];
  links: LinkResult;
  keyboard: KeyboardResult | null;
  geo?: Record<string, unknown> | null;
  screenshotKey: string | null;
}

/**
 * `source.config` for en `web_validation`-kilde. Mode bestemmer hvordan URL-ene
 * hentes; resten av workeren er lik. Sitemap er primærmodus; migration er
 * spesialtilfellet (gammel→ny side-om-side).
 */
export type WebValidationConfig =
  | {
      mode: "sitemap";
      url: string;
      limit?: number;
      includePaths?: string[];
      excludePaths?: string[];
    }
  | { mode: "list"; urls: string[] }
  | { mode: "migration"; pairs: Array<{ old: string; new: string; pairKey?: string }> };

/** Et generisk funn fra hvilken som helst kilde (web, github/dependabot, …). */
export interface FindingData {
  kind: "a11y" | "seo" | "broken_link" | "keyboard" | "dependency_vuln" | "other";
  severity: Severity;
  subject: string | null;
  fingerprint: string;
  title: string;
  data: Record<string, unknown>;
}
