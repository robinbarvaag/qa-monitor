import type { Report, ReportPage } from "./report";

/**
 * Lighthouse-aktig kvalitetsscore (0–100) per kategori, utledet deterministisk
 * fra de eksisterende valideringsdataene. Per side først, så snittet til en
 * rapport-score. Reglene er bevisst enkle og forklarbare — ikke en kopi av
 * Lighthouse, men samme idé: start på 100, trekk fra etter alvorlighet.
 */

export type ScoreKey = "a11y" | "performance" | "seo" | "best";

export interface CategoryScore {
  key: ScoreKey;
  label: string;
  score: number;
}

export interface ReportScore {
  overall: number;
  categories: CategoryScore[];
}

const clamp = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

/** Fargebånd à la Lighthouse. */
export function scoreTone(score: number): "good" | "warn" | "bad" {
  return score >= 90 ? "good" : score >= 50 ? "warn" : "bad";
}

function a11yScore(p: ReportPage): number {
  const bi = p.a11y.byImpact ?? {};
  const penalty =
    (bi.critical ?? 0) * 15 + (bi.serious ?? 0) * 10 + (bi.moderate ?? 0) * 5 + (bi.minor ?? 0) * 2;
  return clamp(100 - penalty);
}

function seoScore(p: ReportPage): number {
  return clamp(100 - p.seoFailCount * 12 - p.seoWarnCount * 3);
}

function performanceScore(p: ReportPage): number {
  const perf = p.perf;
  if (!perf) return p.loadError ? 0 : 75; // ukjent ytelse → nøytralt
  let s = 100;
  const load = perf.loadMs || perf.dclMs || 0;
  if (load > 6000) s -= 40;
  else if (load > 4000) s -= 25;
  else if (load > 2500) s -= 12;
  if (perf.weightTotal > 5_000_000) s -= 25;
  else if (perf.weightTotal > 3_000_000) s -= 15;
  else if (perf.weightTotal > 1_500_000) s -= 7;
  s -= Math.min(20, perf.imgOversized * 4);
  if (perf.domNodes > 3000) s -= 10;
  else if (perf.domNodes > 1500) s -= 4;
  return clamp(s);
}

function bestPracticesScore(p: ReportPage): number {
  let s = 100;
  if (p.js?.hasProblem) s -= 40; // synlig feil-UI / uhåndtert unntak
  if (p.js && p.js.consoleErrorCount > 0) s -= Math.min(15, p.js.consoleErrorCount * 3);
  s -= Math.min(30, p.links.broken.length * 6);
  if (!/^https:/i.test(p.url)) s -= 20; // ikke HTTPS
  if (p.loadError || !p.ok) s -= 30;
  if (p.keyboard?.trap) s -= 15;
  return clamp(s);
}

const CATEGORIES: { key: ScoreKey; label: string; fn: (p: ReportPage) => number }[] = [
  { key: "a11y", label: "Tilgjengelighet", fn: a11yScore },
  { key: "performance", label: "Ytelse", fn: performanceScore },
  { key: "seo", label: "SEO", fn: seoScore },
  { key: "best", label: "Beste praksis", fn: bestPracticesScore },
];

export function scoreReport(report: Report): ReportScore {
  const pages = report.pages;
  if (pages.length === 0) {
    return {
      overall: 0,
      categories: CATEGORIES.map((c) => ({ key: c.key, label: c.label, score: 0 })),
    };
  }
  const categories = CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    score: clamp(pages.reduce((sum, p) => sum + c.fn(p), 0) / pages.length),
  }));
  const overall = clamp(categories.reduce((sum, c) => sum + c.score, 0) / categories.length);
  return { overall, categories };
}
