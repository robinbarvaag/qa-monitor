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
