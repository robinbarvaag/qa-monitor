import type { PageCounts } from "@qa/db";
import type { Report } from "./report";

/**
 * «Hva er nytt/verre siden sist» — sammenligner siste kjøring mot forrige
 * (per side, på URL) og finner regresjoner. Bruker de samme tre tellerne som
 * per-side-deltaene (a11y / brutte lenker / SEO-feil). Ren funksjon.
 */

export interface MetricChange {
  key: "a11y" | "broken" | "seo";
  label: string;
  from: number;
  to: number;
}

export interface PageRegression {
  path: string;
  url: string;
  changes: MetricChange[];
  /** Sum av forverring (for sortering: størst først). */
  worseTotal: number;
}

export interface Regressions {
  hasPrevious: boolean;
  worsened: PageRegression[];
  newPages: PageRegression[];
  improvedCount: number;
}

const METRICS: { key: MetricChange["key"]; label: string }[] = [
  { key: "a11y", label: "a11y" },
  { key: "broken", label: "lenker" },
  { key: "seo", label: "SEO" },
];

function countsOf(p: Report["pages"][number]): Record<MetricChange["key"], number> {
  return { a11y: p.a11y.violationCount, broken: p.links.broken.length, seo: p.seoFailCount };
}

export function computeRegressions(
  report: Report,
  previousCounts: Record<string, PageCounts> | null,
): Regressions {
  if (!previousCounts) {
    return { hasPrevious: false, worsened: [], newPages: [], improvedCount: 0 };
  }

  const worsened: PageRegression[] = [];
  const newPages: PageRegression[] = [];
  let improvedCount = 0;

  for (const p of report.pages) {
    const cur = countsOf(p);
    const prev = previousCounts[p.url];

    if (!prev) {
      // Side som ikke fantes i forrige kjøring — flagg om den har avvik.
      const changes = METRICS.map((m) => ({ ...m, from: 0, to: cur[m.key] })).filter(
        (c) => c.to > 0,
      );
      if (changes.length > 0) {
        newPages.push({ path: p.path, url: p.url, changes, worseTotal: 0 });
      }
      continue;
    }

    const changes: MetricChange[] = [];
    let worseTotal = 0;
    let better = 0;
    for (const m of METRICS) {
      const from = prev[m.key];
      const to = cur[m.key];
      if (to > from) {
        changes.push({ ...m, from, to });
        worseTotal += to - from;
      } else if (to < from) {
        better += from - to;
      }
    }
    if (changes.length > 0) worsened.push({ path: p.path, url: p.url, changes, worseTotal });
    else if (better > 0) improvedCount++;
  }

  worsened.sort((a, b) => b.worseTotal - a.worseTotal);
  return { hasPrevious: true, worsened, newPages, improvedCount };
}
