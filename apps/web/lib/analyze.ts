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
interface RawPerf {
  load_ms?: number;
  weight_total?: number;
  weight_img?: number;
  weight_js?: number;
  dom_nodes?: number;
  img_oversized?: number;
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
  const perf = ((p.meta ?? {}) as { perf?: RawPerf }).perf;
  const kb2 = (n?: number) => (n ? Math.round(n / 1024) : 0);
  return {
    perf: perf
      ? {
          loadMs: perf.load_ms ?? 0,
          totalKb: kb2(perf.weight_total),
          imgKb: kb2(perf.weight_img),
          jsKb: kb2(perf.weight_js),
          domNodes: perf.dom_nodes ?? 0,
          oversizedImages: perf.img_oversized ?? 0,
        }
      : null,
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
  "Du er en norsk QA-ekspert på web-tilgjengelighet (WCAG/axe), SEO, ytelse og brukskvalitet. " +
  "Du får deterministiske valideringsresultater for flere sider på ett nettsted. " +
  "Gi en kort, presis helhetsvurdering og prioriter de viktigste problemene på tvers av sider. " +
  "Hver side har et `perf`-objekt (lastetid i ms, vekt i KB, bilde-vekt, DOM-noder, antall " +
  "oversized bilder) — trekk inn ytelse der det er tungt (stor sidevekt, mange oversized bilder, " +
  "treg last). Vær konkret og handlingsrettet. Svar på norsk (bokmål). Ikke finn på funn som ikke står i dataene.";

export const PAGE_SYSTEM =
  "Du er en norsk QA- og design-ekspert på web-tilgjengelighet (WCAG/axe), SEO, ytelse, " +
  "tastaturnavigasjon og visuelt design. Du vurderer én enkelt side ut fra deterministiske " +
  "valideringsresultater, og — hvis et skjermbilde er vedlagt — også det visuelle uttrykket. " +
  "`perf` har lastetid (ms), sidevekt/bilde-vekt (KB), DOM-noder og oversized bilder — kommenter " +
  "ytelse når det er et reelt problem (tung side, store bilder, treg last). " +
  "Gi en kort vurdering (`assessment`) og konkrete, prioriterte fiks-forslag (`suggestions`). " +
  "I `visual`: vurder skjermbildet på avstander/whitespace, justering, konsistens (typografi, " +
  "farger, knapper), visuelt hierarki og helhetlig håndverk — vær konkret og ærlig om svakheter. " +
  "Hvis det ikke er noe skjermbilde, sett `visual` til tom streng. " +
  "Svar på norsk (bokmål). Ikke finn på funn som ikke står i dataene; hvis siden er ren, si det.";

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

/** Genererer AI-vurdering for én enkelt side (on-demand, ikke streamet). Hvis et
 *  skjermbilde er gitt, vurderer modellen også det visuelle (avstander/konsistens). */
export async function analyzeOnePage(
  p: RunPageDetail,
  screenshot?: Uint8Array,
): Promise<PageAnalysisContent> {
  const { object } = await generateObject({
    model: anthropic(ANALYSIS_MODEL),
    schema: pageAnalysisSchema,
    system: PAGE_SYSTEM,
    messages: [
      {
        role: "user",
        content: screenshot
          ? [
              { type: "text", text: pagePrompt(p) },
              { type: "text", text: "Skjermbilde av siden:" },
              { type: "image", image: screenshot },
            ]
          : [{ type: "text", text: pagePrompt(p) }],
      },
    ],
  });
  return object as PageAnalysisContent;
}
