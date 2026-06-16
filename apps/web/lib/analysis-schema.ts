/**
 * Zod-skjemaer for AI-analysen, delt mellom server (streamObject/generateObject)
 * og klient (useObject). Holdes fri for server-only-importer.
 */
import { z } from "zod";

export const SEVERITY = ["critical", "serious", "moderate", "minor", "info"] as const;

export const issueSchema = z.object({
  severity: z.enum(SEVERITY).describe("Alvorlighet"),
  title: z.string().describe("Kort tittel på problemet"),
  detail: z.string().describe("Hva problemet er og hvorfor det betyr noe"),
  suggestion: z.string().describe("Konkret hvordan det fikses"),
  pages: z.array(z.string()).optional().describe("Berørte stier, f.eks. /kontakt"),
});

export const runSummarySchema = z.object({
  headline: z.string().describe("1–2 setningers helsebilde for nettstedet"),
  issues: z.array(issueSchema).describe("Prioriterte problemer, viktigst først (maks 6)"),
});

export const pageAnalysisSchema = z.object({
  severity: z.enum(SEVERITY).describe("Sidens samlede alvorlighet"),
  assessment: z.string().describe("1–3 setningers vurdering av siden"),
  suggestions: z.array(z.string()).describe("Konkrete fiks-forslag, viktigst først (maks 5)"),
});

export type RunSummary = z.infer<typeof runSummarySchema>;
export type PageAnalysis = z.infer<typeof pageAnalysisSchema>;

/* ---------- funn-utbedringsplan (Fase 5 + AI) ---------- */

export const RISK = ["low", "medium", "high"] as const;

export const findingsActionSchema = z.object({
  title: z.string().describe("Kort handling, f.eks. «Oppgrader next til 16.2.5»"),
  severity: z.enum(SEVERITY).describe("Høyeste alvorlighet denne handlingen lukker"),
  risk: z.enum(RISK).describe("Risiko ved selve oppgraderingen: patch/minor=low, major=high"),
  command: z.string().describe("Kommando (prosjektet bruker bun), f.eks. «bun add next@16.2.5»"),
  addresses: z.number().int().describe("Antall funn denne handlingen lukker"),
  detail: z.string().describe("Kort begrunnelse + evt. forbehold"),
});

export const findingsSummarySchema = z.object({
  headline: z.string().describe("1–2 setninger: hva som må gjøres for å lukke flest funn"),
  actions: z.array(findingsActionSchema).describe("Prioriterte handlinger, viktigst først"),
});

export type FindingsSummary = z.infer<typeof findingsSummarySchema>;
