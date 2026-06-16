"use client";

import { finishAnalysisAction } from "@/app/actions";
import { Expandable } from "@/components/expandable";
import { runSummarySchema } from "@/lib/analysis-schema";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import type { RunSummaryContent } from "@qa/db";
import { Button } from "@qa/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AiSummaryView } from "./ai-summary-view";

export interface InitialAnalysis {
  summary: RunSummaryContent | null;
  model: string | null;
  createdAt: string | null;
}

export function AiAnalysisPanel({
  slug,
  initial,
  pathToUrl,
}: {
  slug: string;
  initial: InitialAnalysis;
  pathToUrl: Record<string, string>;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "pages">("idle");
  const [error, setError] = useState<string | null>(null);

  const { object, submit, isLoading } = useObject({
    api: `/api/analyze/${slug}`,
    schema: runSummarySchema,
    onError: (e) => {
      setError(e.message || "Analysen feilet.");
      setPhase("idle");
    },
    onFinish: async ({ object: final, error: streamError }) => {
      if (streamError || !final) {
        setError(streamError?.message ?? "Modellen returnerte ikke gyldig oppsummering.");
        return;
      }
      setPhase("pages");
      const res = await finishAnalysisAction(slug, final);
      setPhase("idle");
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
    },
  });

  function start() {
    setError(null);
    submit({});
  }

  const streamingActive = isLoading || phase === "pages";
  const shownSummary = streamingActive ? object : (initial.summary ?? undefined);
  const hasSummary = Boolean(shownSummary);

  const buttonLabel = isLoading
    ? "Analyserer…"
    : phase === "pages"
      ? "Per side…"
      : initial.summary
        ? "Analyser på nytt"
        : "Analyser med AI";

  return (
    <section className="overflow-hidden rounded-2xl bg-linear-to-br from-primary/8 to-card p-6 ring-1 ring-primary/20">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-content-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <h2 className="font-heading text-lg font-semibold">AI-analyse</h2>
          {streamingActive ? (
            <span className="text-xs text-primary">live</span>
          ) : (
            initial.model &&
            initial.createdAt && (
              <span className="text-xs text-muted-foreground">
                {initial.model} · {new Date(initial.createdAt).toLocaleString("nb-NO")}
              </span>
            )
          )}
        </div>
        <Button onClick={start} disabled={streamingActive} size="sm" variant="outline">
          {streamingActive ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {buttonLabel}
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      {hasSummary ? (
        isLoading ? (
          <AiSummaryView summary={shownSummary} pathToUrl={pathToUrl} streaming />
        ) : (
          <Expandable collapsedHeight={360}>
            <AiSummaryView summary={shownSummary} pathToUrl={pathToUrl} />
          </Expandable>
        )
      ) : (
        !streamingActive && (
          <p className="text-sm text-muted-foreground">
            Ingen AI-analyse ennå. Trykk «Analyser med AI» for en tolket gjennomgang av siste
            kjøring.
          </p>
        )
      )}

      {phase === "pages" && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Genererer per-side-vurderinger…
        </p>
      )}
    </section>
  );
}
