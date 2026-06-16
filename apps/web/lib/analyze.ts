/**
 * Fase 4 — AI-analyselag (Vercel AI SDK + Anthropic). Tolker ferdige,
 * deterministiske valideringsresultater. Helhets-oppsummeringen streames fra
 * route-handleren (streamObject); per-side-vurderingene genereres her
 * (generateObject) og lagres i `analysis`-tabellen. Adskilt fra valideringen.
 */
import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import type { FindingRow, PageAnalysisContent, RunPageDetail } from "@qa/db";
import { generateObject } from "ai";
import { pageAnalysisSchema } from "./analysis-schema";

export const ANALYSIS_MODEL = "claude-opus-4-8";

/* ---------- kompakt digest av native jsonb (sparer tokens) ---------- */

interface RawA11y {
  violation_count?: number;
  violations?: Array<{ id: string; impact: string; help: string; nodes: number }>;
  incomplete_count?: number;
}
interface RawSeo {
  level: "fail" | "warn" | "ok";
  key: string;
  msg: string;
}
interface RawLinks {
  total?: number;
  broken?: Array<{ url: string; status: number | null }>;
  uncertain?: Array<{ url: string; status: number | null }>;
}
interface RawKeyboard {
  tab_stops?: number;
  trap?: boolean;
  skip_link?: { present: boolean } | null;
  no_focus_count?: number;
  unreachable_count?: number;
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

/** Plukker ut det modellen trenger fra én sides native detaljer. */
function digest(p: RunPageDetail) {
  const a11y = (p.a11y ?? {}) as RawA11y;
  const seo = (p.seo ?? []) as RawSeo[];
  const links = (p.links ?? {}) as RawLinks;
  const kb = (p.keyboard ?? null) as RawKeyboard | null;
  return {
    path: pathOf(p.url),
    httpStatus: p.httpStatus,
    loadError: p.loadError,
    a11y: {
      count: a11y.violation_count ?? 0,
      violations: (a11y.violations ?? [])
        .slice(0, 15)
        .map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes })),
    },
    seo: seo
      .filter((s) => s.level !== "ok")
      .map((s) => ({ level: s.level, key: s.key, msg: s.msg })),
    brokenLinks: (links.broken ?? []).slice(0, 10).map((l) => ({ url: l.url, status: l.status })),
    uncertainLinks: (links.uncertain ?? [])
      .slice(0, 10)
      .map((l) => ({ url: l.url, status: l.status })),
    keyboard: kb
      ? {
          tabStops: kb.tab_stops ?? 0,
          trap: Boolean(kb.trap),
          skipLink: Boolean(kb.skip_link?.present),
          invisibleFocus: kb.no_focus_count ?? 0,
          unreachable: kb.unreachable_count ?? 0,
        }
      : null,
  };
}

/* ---------- prompts (delt mellom streaming-route og finish-action) ---------- */

export const SUMMARY_SYSTEM =
  "Du er en norsk QA-ekspert på web-tilgjengelighet (WCAG/axe), SEO og brukskvalitet. " +
  "Du får deterministiske valideringsresultater for flere sider på ett nettsted. " +
  "Gi en kort, presis helhetsvurdering og prioriter de viktigste problemene på tvers av sider. " +
  "Vær konkret og handlingsrettet. Svar på norsk (bokmål). Ikke finn på funn som ikke står i dataene.";

export const PAGE_SYSTEM =
  "Du er en norsk QA-ekspert på web-tilgjengelighet (WCAG/axe), SEO og tastaturnavigasjon. " +
  "Du vurderer én enkelt side ut fra deterministiske valideringsresultater. " +
  "Gi en kort vurdering og konkrete, prioriterte fiks-forslag. Svar på norsk (bokmål). " +
  "Ikke finn på funn som ikke står i dataene; hvis siden er ren, si det.";

export function summaryPrompt(name: string, pages: RunPageDetail[]): string {
  const digests = pages.map(digest);
  return `Nettsted: ${name}. ${pages.length} sider validert.\n\nResultater per side (JSON):\n${JSON.stringify(digests)}`;
}

function pagePrompt(p: RunPageDetail): string {
  return `Side: ${p.url}\n\nValideringsresultat (JSON):\n${JSON.stringify(digest(p))}`;
}

/* ---------- funn-utbedringsplan (Dependabot) ---------- */

export const FINDINGS_SYSTEM =
  "Du er en norsk sikkerhets- og avhengighetsekspert. Du får en liste Dependabot-funn " +
  "(pakke, økosystem, alvorlighet, sårbar versjon, første patchede versjon, beskrivelse). " +
  "Konsolider dem til en kort, handlingsrettet utbedringsplan: grupper funn som løses av samme " +
  "oppgradering, anbefal konkret målversjon, og vurder hvor trygg oppgraderingen er " +
  "(patch/minor = lav risiko, major = høyere). Prosjektet bruker bun (foreslå bun-kommandoer). " +
  "Vær konkret og ærlig om risiko. Svar på norsk (bokmål). Ikke finn på noe som ikke følger av dataene.";

interface FindingData {
  ecosystem?: string | null;
  vulnerableRange?: string | null;
  firstPatched?: string | null;
}

export function findingsPrompt(findings: FindingRow[]): string {
  const digest = findings.map((f) => {
    const d = (f.data ?? {}) as FindingData;
    return {
      package: f.subject,
      ecosystem: d.ecosystem ?? null,
      severity: f.severity,
      title: f.title,
      vulnerableRange: d.vulnerableRange ?? null,
      firstPatched: d.firstPatched ?? null,
    };
  });
  return `${findings.length} Dependabot-funn.\n\nFunn (JSON):\n${JSON.stringify(digest)}`;
}

/* ---------- enkel samtidighetsbegrensning ---------- */

async function pool<I, O>(items: I[], limit: number, fn: (item: I) => Promise<O>): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i] as I);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Genererer AI-vurdering per side (ikke streamet). */
export async function analyzePerPage(
  pages: RunPageDetail[],
): Promise<{ pageId: string; content: PageAnalysisContent }[]> {
  return pool(pages, 5, async (p) => {
    const { object } = await generateObject({
      model: anthropic(ANALYSIS_MODEL),
      schema: pageAnalysisSchema,
      system: PAGE_SYSTEM,
      prompt: pagePrompt(p),
    });
    return { pageId: p.pageId, content: object as PageAnalysisContent };
  });
}
