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

/** Hvorfor en SEO/meta-sjekk betyr noe, slått opp på nøkkel-gruppe. */
const SEO_HELP: Record<string, string> = {
  title:
    "Tittelen er den klikkbare overskriften i søkeresultater og delinger. Bør være unik og beskrivende, ~50–60 tegn.",
  desc: "Meta description er sammendraget under tittelen i søk – påvirker om folk klikker. ~50–160 tegn.",
  lang: "lang-attributtet på <html> forteller nettlesere og skjermlesere hvilket språk siden er på (uttale, oversettelse).",
  canonical:
    "Canonical peker på «original-URL-en» ved duplikatinnhold, så samme innhold ikke konkurrerer med seg selv i søk.",
  viewport:
    "Viewport-meta gjør at siden skalerer riktig på mobil. Uten den vises siden ofte som en zoomet-ut desktop-side.",
  h1: "h1 er sidens hovedoverskrift – én per side. Viktig for både SEO og skjermlesere som bygger sidestrukturen.",
  heading:
    "Overskriftsnivåer bør være sammenhengende (h1→h2→h3). Hopp i nivå forvirrer skjermlesere og svekker strukturen.",
  noindex:
    "noindex hindrer søkemotorer i å indeksere siden – den vil ikke dukke opp i søk i det hele tatt.",
  nofollow: "nofollow ber søkemotorer ignorere lenkene på siden for ranking.",
  og: "Open Graph-tagger (og:title/description/image) styrer hvordan siden ser ut når den deles på Facebook, LinkedIn og Slack – og i AI-kort. Uten dem blir delingen tom/kjedelig.",
  twitter: "twitter:card styrer hvordan siden ser ut når den deles på X/Twitter.",
};

export function seoHelp(key: string): string | null {
  return SEO_HELP[key.split("-")[0] ?? ""] ?? null;
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
