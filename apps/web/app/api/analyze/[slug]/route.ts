import { runSummarySchema } from "@/lib/analysis-schema";
import { ANALYSIS_MODEL, SUMMARY_SYSTEM, summaryPrompt } from "@/lib/analyze";
import { anthropic } from "@ai-sdk/anthropic";
import { getLatestRunPages } from "@qa/db";
import { streamObject } from "ai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Streamer helhets-oppsummeringen (useObject leser denne live). */
export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const run = await getLatestRunPages(slug);
  if (!run || run.pages.length === 0) {
    return new Response("Ingen fullført kjøring å analysere.", { status: 400 });
  }

  const result = streamObject({
    model: anthropic(ANALYSIS_MODEL),
    schema: runSummarySchema,
    system: SUMMARY_SYSTEM,
    prompt: summaryPrompt(slug, run.pages),
  });

  return result.toTextStreamResponse();
}
