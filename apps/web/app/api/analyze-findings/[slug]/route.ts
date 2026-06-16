import { findingsSummarySchema } from "@/lib/analysis-schema";
import { ANALYSIS_MODEL, FINDINGS_SYSTEM, findingsPrompt } from "@/lib/analyze";
import { anthropic } from "@ai-sdk/anthropic";
import { type FindingsSummaryContent, getLatestFindings, saveFindingsAnalysis } from "@qa/db";
import { streamObject } from "ai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Streamer en konsolidert utbedringsplan for funnene (useObject leser denne live). */
export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const findings = await getLatestFindings(slug);
  if (findings.length === 0) {
    return new Response("Ingen funn å analysere.", { status: 400 });
  }

  const result = streamObject({
    model: anthropic(ANALYSIS_MODEL),
    schema: findingsSummarySchema,
    system: FINDINGS_SYSTEM,
    prompt: findingsPrompt(findings),
    onFinish: async ({ object }) => {
      if (object) {
        await saveFindingsAnalysis(slug, ANALYSIS_MODEL, object as FindingsSummaryContent);
      }
    },
  });

  return result.toTextStreamResponse();
}
