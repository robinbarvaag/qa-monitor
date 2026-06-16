import type { AnalysisSeverity } from "@qa/db";
import type { SeoLevel } from "./report";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "ghost" | "link";

/** Alvorlighetsrekkefølge for a11y-impact (verst først). */
export const IMPACT_ORDER = ["critical", "serious", "moderate", "minor"] as const;
export type Impact = (typeof IMPACT_ORDER)[number];

export function worstImpact(byImpact: Record<string, number>): Impact | null {
  for (const impact of IMPACT_ORDER) {
    if ((byImpact[impact] ?? 0) > 0) return impact;
  }
  return null;
}

export function impactBadge(impact: string): BadgeVariant {
  if (impact === "critical" || impact === "serious") return "destructive";
  return "secondary";
}

export function impactDotClass(impact: Impact | null): string {
  switch (impact) {
    case "critical":
      return "bg-destructive";
    case "serious":
      return "bg-orange-500";
    case "moderate":
      return "bg-yellow-500";
    case "minor":
      return "bg-sky-500";
    default:
      return "bg-emerald-500";
  }
}

export function seoBadge(level: SeoLevel): BadgeVariant {
  if (level === "fail") return "destructive";
  if (level === "warn") return "secondary";
  return "outline";
}

/* ---------- AI-analyse (Fase 4) ---------- */

export const SEVERITY_LABEL: Record<AnalysisSeverity, string> = {
  critical: "kritisk",
  serious: "alvorlig",
  moderate: "middels",
  minor: "lav",
  info: "info",
};

export function severityBadge(s: AnalysisSeverity): BadgeVariant {
  if (s === "critical" || s === "serious") return "destructive";
  if (s === "moderate") return "secondary";
  return "outline";
}

export function severityDotClass(s: AnalysisSeverity): string {
  switch (s) {
    case "critical":
      return "bg-destructive";
    case "serious":
      return "bg-orange-500";
    case "moderate":
      return "bg-yellow-500";
    case "minor":
      return "bg-sky-500";
    default:
      return "bg-muted-foreground";
  }
}
