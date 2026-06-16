/**
 * Fase 4 — AI-analyselag. Tolker ferdige, deterministiske valideringsresultater
 * og produserer (1) en helhetlig kjøring-oppsummering og (2) en vurdering per side.
 * Holdes adskilt fra selve valideringen: dette skriver kun til `analysis`-tabellen.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { PageAnalysisContent, RunPageDetail, RunSummaryContent } from "@qa/db";

export const ANALYSIS_MODEL = "claude-opus-4-8";

const SEVERITY = ["critical", "serious", "moderate", "minor", "info"] as const;

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

/* ---------- Anthropic-kall med tvunget strukturert output ---------- */

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY mangler i miljøet (.env.local).");
  }
  return new Anthropic({ apiKey });
}

async function structured<T>(
  anthropic: Anthropic,
  system: string,
  user: string,
  toolName: string,
  schema: Record<string, unknown>,
): Promise<T> {
  const res = await anthropic.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 2048,
    system,
    tools: [
      {
        name: toolName,
        description: "Returner det strukturerte resultatet.",
        input_schema: schema as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: toolName },
    messages: [{ role: "user", content: user }],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("Modellen returnerte ikke strukturert output.");
  }
  return block.input as T;
}

const issueSchema = {
  type: "object",
  properties: {
    severity: { type: "string", enum: SEVERITY },
    title: { type: "string", description: "Kort tittel på problemet" },
    detail: { type: "string", description: "Hva problemet er og hvorfor det betyr noe" },
    suggestion: { type: "string", description: "Konkret hvordan det fikses" },
    pages: {
      type: "array",
      items: { type: "string" },
      description: "Berørte stier (f.eks. /kontakt)",
    },
  },
  required: ["severity", "title", "detail", "suggestion"],
  additionalProperties: false,
};

const summarySchema = {
  type: "object",
  properties: {
    headline: { type: "string", description: "1–2 setningers helsebilde for nettstedet" },
    issues: {
      type: "array",
      description: "Prioriterte problemer, viktigst først (maks 6)",
      items: issueSchema,
    },
  },
  required: ["headline", "issues"],
  additionalProperties: false,
};

const pageSchema = {
  type: "object",
  properties: {
    severity: { type: "string", enum: SEVERITY, description: "Sidens samlede alvorlighet" },
    assessment: { type: "string", description: "1–3 setningers vurdering av siden" },
    suggestions: {
      type: "array",
      items: { type: "string" },
      description: "Konkrete fiks-forslag, viktigst først (maks 5)",
    },
  },
  required: ["severity", "assessment", "suggestions"],
  additionalProperties: false,
};

const SUMMARY_SYSTEM =
  "Du er en norsk QA-ekspert på web-tilgjengelighet (WCAG/axe), SEO og brukskvalitet. " +
  "Du får deterministiske valideringsresultater for flere sider på ett nettsted. " +
  "Gi en kort, presis helhetsvurdering og prioriter de viktigste problemene på tvers av sider. " +
  "Vær konkret og handlingsrettet. Svar på norsk (bokmål). Ikke finn på funn som ikke står i dataene.";

const PAGE_SYSTEM =
  "Du er en norsk QA-ekspert på web-tilgjengelighet (WCAG/axe), SEO og tastaturnavigasjon. " +
  "Du vurderer én enkelt side ut fra deterministiske valideringsresultater. " +
  "Gi en kort vurdering og konkrete, prioriterte fiks-forslag. Svar på norsk (bokmål). " +
  "Ikke finn på funn som ikke står i dataene; hvis siden er ren, si det.";

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

/* ---------- offentlig API ---------- */

export interface AnalysisResult {
  summary: RunSummaryContent;
  pages: { pageId: string; content: PageAnalysisContent }[];
}

/** Kjører helhets- + per-side-analyse for et sett side-resultater. */
export async function analyzePages(pages: RunPageDetail[], name: string): Promise<AnalysisResult> {
  const anthropic = client();
  const digests = pages.map((p) => ({ page: p, d: digest(p) }));

  const summaryPromise = structured<RunSummaryContent>(
    anthropic,
    SUMMARY_SYSTEM,
    `Nettsted: ${name}. ${pages.length} sider validert.\n\nResultater per side (JSON):\n${JSON.stringify(
      digests.map((x) => x.d),
    )}`,
    "rapporter_oppsummering",
    summarySchema,
  );

  const pagesPromise = pool(digests, 5, async ({ page, d }) => ({
    pageId: page.pageId,
    content: await structured<PageAnalysisContent>(
      anthropic,
      PAGE_SYSTEM,
      `Side: ${page.url}\n\nValideringsresultat (JSON):\n${JSON.stringify(d)}`,
      "vurder_side",
      pageSchema,
    ),
  }));

  const [summary, pageItems] = await Promise.all([summaryPromise, pagesPromise]);
  return { summary, pages: pageItems };
}
