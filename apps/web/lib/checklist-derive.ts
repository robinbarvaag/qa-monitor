import type { ChecklistDiscipline, FindingRow } from "@qa/db";
import type { Report, ReportPage } from "./report";

/**
 * Utleder auto-poster fra siste kjøring + Dependabot-funn, så sjekklista speiler
 * faktiske funn. Rene funksjoner; titlene inneholder antall så de er lette å
 * scanne. `affectedPaths` lar UI-et vise hvilke sider posten gjelder.
 */
export interface AutoItem {
  key: string;
  discipline: ChecklistDiscipline;
  title: string;
  affectedPaths: string[];
}

// Terskler i tråd med band() i page-explorer.
const SLOW_MS = 4000;
const HEAVY_BYTES = 3_000_000;

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many.replace("{n}", String(n));
}

export function deriveAutoItems(report: Report | null, findings: FindingRow[]): AutoItem[] {
  const items: AutoItem[] = [];
  if (report) {
    items.push(...deriveA11y(report.pages));
    items.push(...deriveSeo(report.pages));
    items.push(...deriveContent(report.pages));
    items.push(...derivePerformance(report.pages));
  }
  items.push(...deriveSecurity(findings));
  return items;
}

function deriveA11y(pages: ReportPage[]): AutoItem[] {
  const items: AutoItem[] = [];

  // Grupper axe-brudd på regel-id på tvers av sider.
  const byRule = new Map<string, { help: string; paths: Set<string> }>();
  for (const p of pages) {
    for (const v of p.a11y.violations) {
      const entry = byRule.get(v.id) ?? { help: v.help, paths: new Set<string>() };
      entry.paths.add(p.path);
      byRule.set(v.id, entry);
    }
  }
  for (const [id, { help, paths }] of byRule) {
    const n = paths.size;
    // Fargekontrast hører hjemme i Design; resten i Tilgjengelighet.
    const discipline: ChecklistDiscipline = id === "color-contrast" ? "design" : "a11y";
    items.push({
      key: `auto:a11y:${id}`,
      discipline,
      title: `${help} (${id}) — ${plural(n, "1 side", "{n} sider")}`,
      affectedPaths: [...paths],
    });
  }

  const trap = pages.filter((p) => p.keyboard?.trap).map((p) => p.path);
  if (trap.length > 0) {
    items.push({
      key: "auto:a11y:keyboard-trap",
      discipline: "a11y",
      title: `Tab-felle på ${plural(trap.length, "1 side", "{n} sider")}`,
      affectedPaths: trap,
    });
  }

  const noFocus = pages.filter((p) => (p.keyboard?.noFocusCount ?? 0) > 0).map((p) => p.path);
  if (noFocus.length > 0) {
    items.push({
      key: "auto:design:no-focus",
      discipline: "design",
      title: `Usynlig fokusmarkør på ${plural(noFocus.length, "1 side", "{n} sider")}`,
      affectedPaths: noFocus,
    });
  }

  return items;
}

function deriveSeo(pages: ReportPage[]): AutoItem[] {
  const items: AutoItem[] = [];

  const byKey = new Map<string, { msg: string; paths: Set<string> }>();
  for (const p of pages) {
    for (const s of p.seo) {
      if (s.level !== "fail") continue;
      const entry = byKey.get(s.key) ?? { msg: s.msg, paths: new Set<string>() };
      entry.paths.add(p.path);
      byKey.set(s.key, entry);
    }
  }
  for (const [key, { msg, paths }] of byKey) {
    items.push({
      key: `auto:seo:${key}`,
      discipline: "seo",
      title: `${msg} — ${plural(paths.size, "1 side", "{n} sider")}`,
      affectedPaths: [...paths],
    });
  }

  const broken = pages.filter((p) => p.links.broken.length > 0);
  if (broken.length > 0) {
    const total = broken.reduce((n, p) => n + p.links.broken.length, 0);
    items.push({
      key: "auto:seo:broken-links",
      discipline: "seo",
      title: `${total} brutte lenker på ${plural(broken.length, "1 side", "{n} sider")}`,
      affectedPaths: broken.map((p) => p.path),
    });
  }

  return items;
}

function deriveContent(pages: ReportPage[]): AutoItem[] {
  const items: AutoItem[] = [];
  const flag = (key: string, title: string, pred: (p: ReportPage) => boolean): void => {
    const hit = pages.filter(pred).map((p) => p.path);
    if (hit.length > 0) {
      items.push({
        key,
        discipline: "content",
        title: `${title} — ${plural(hit.length, "1 side", "{n} sider")}`,
        affectedPaths: hit,
      });
    }
  };
  flag("auto:content:missing-title", "Mangler sidetittel", (p) => !p.meta.title);
  flag(
    "auto:content:missing-description",
    "Mangler meta-beskrivelse",
    (p) => !p.meta.metaDescription,
  );
  flag("auto:content:h1", "Mangler/flere h1", (p) => p.meta.h1Count !== 1);
  return items;
}

function derivePerformance(pages: ReportPage[]): AutoItem[] {
  const items: AutoItem[] = [];
  const flag = (key: string, title: string, pred: (p: ReportPage) => boolean): void => {
    const hit = pages.filter((p) => p.perf && pred(p)).map((p) => p.path);
    if (hit.length > 0) {
      items.push({
        key,
        discipline: "performance",
        title: `${title} — ${plural(hit.length, "1 side", "{n} sider")}`,
        affectedPaths: hit,
      });
    }
  };
  flag("auto:performance:slow", "Treg lastetid (> 4 s)", (p) => (p.perf?.loadMs ?? 0) > SLOW_MS);
  flag(
    "auto:performance:heavy",
    "Tung side (> 3 MB)",
    (p) => (p.perf?.weightTotal ?? 0) > HEAVY_BYTES,
  );
  flag(
    "auto:performance:oversized-images",
    "Overstore bilder",
    (p) => (p.perf?.imgOversized ?? 0) > 0,
  );
  return items;
}

function deriveSecurity(findings: FindingRow[]): AutoItem[] {
  if (findings.length === 0) return [];
  const bySeverity = new Map<string, string[]>();
  for (const f of findings) {
    const list = bySeverity.get(f.severity) ?? [];
    if (f.subject) list.push(f.subject);
    bySeverity.set(f.severity, list);
  }
  const SEV_LABEL: Record<string, string> = {
    critical: "kritiske",
    serious: "alvorlige",
    moderate: "moderate",
    minor: "små",
    info: "info",
  };
  return [...bySeverity.entries()].map(([severity, subjects]) => ({
    key: `auto:security:${severity}`,
    discipline: "security" as ChecklistDiscipline,
    title: `${subjects.length} ${SEV_LABEL[severity] ?? severity} Dependabot-funn`,
    affectedPaths: [...new Set(subjects)],
  }));
}
