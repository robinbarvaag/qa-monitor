"use client";

import { findingsSummarySchema } from "@/lib/analysis-schema";
import { SEVERITY_LABEL, severityBadge } from "@/lib/ui-helpers";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import type {
  FindingRisk,
  FindingSeverity,
  FindingsAnalysis as FindingsAnalysisData,
} from "@qa/db";
import { Badge } from "@qa/ui/badge";
import { Button } from "@qa/ui/button";
import { Loader2, Sparkles, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const RISK_LABEL: Record<FindingRisk, string> = {
  low: "lav risiko",
  medium: "middels risiko",
  high: "høy risiko",
};
function riskClass(risk: FindingRisk): string {
  if (risk === "low")
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (risk === "medium")
    return "border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-400";
  return "border-destructive/40 bg-destructive/10 text-destructive";
}

interface PartialAction {
  title?: string;
  severity?: FindingSeverity;
  risk?: FindingRisk;
  command?: string;
  addresses?: number;
  detail?: string;
}
interface PartialSummary {
  headline?: string;
  actions?: (PartialAction | undefined)[];
}

function PlanView({ summary }: { summary: PartialSummary | undefined }) {
  const actions = (summary?.actions ?? []).filter((a): a is PartialAction => Boolean(a));
  return (
    <div className="space-y-3">
      {summary?.headline && (
        <p className="text-sm leading-relaxed text-foreground/90">{summary.headline}</p>
      )}
      {actions.length > 0 && (
        <ol className="space-y-2.5">
          {actions.map((a, i) => (
            <li
              key={`${a.title ?? "action"}-${i}`}
              className="animate-in fade-in slide-in-from-bottom-1 rounded-xl bg-card/70 p-4 ring-1 ring-foreground/10 duration-300"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Wrench className="size-3.5 text-primary" />
                <span className="font-medium">{a.title ?? "…"}</span>
                {a.severity && (
                  <Badge variant={severityBadge(a.severity)}>{SEVERITY_LABEL[a.severity]}</Badge>
                )}
                {a.risk && <Badge className={riskClass(a.risk)}>{RISK_LABEL[a.risk]}</Badge>}
                {typeof a.addresses === "number" && a.addresses > 0 && (
                  <span className="text-xs text-muted-foreground">lukker {a.addresses} funn</span>
                )}
              </div>
              {a.detail && <p className="mt-1.5 text-sm text-muted-foreground">{a.detail}</p>}
              {a.command && (
                <code className="mt-2 block w-fit rounded-md bg-muted px-2 py-1 font-mono text-xs text-foreground">
                  $ {a.command}
                </code>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function FindingsAnalysis({
  slug,
  initial,
}: {
  slug: string;
  initial: FindingsAnalysisData | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const { object, submit, isLoading } = useObject({
    api: `/api/analyze-findings/${slug}`,
    schema: findingsSummarySchema,
    onError: (e) => setError(e.message || "Analysen feilet."),
    onFinish: ({ error: streamError }) => {
      if (streamError) {
        setError(streamError.message);
        return;
      }
      router.refresh();
    },
  });

  function start() {
    setError(null);
    submit({});
  }

  const shown = isLoading ? object : (initial?.summary ?? undefined);
  const hasPlan = Boolean(shown);

  return (
    <div className="rounded-xl bg-linear-to-br from-primary/8 to-card p-4 ring-1 ring-primary/20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h3 className="font-heading text-sm font-semibold">AI-utbedringsplan</h3>
          {!isLoading && initial && (
            <span className="text-xs text-muted-foreground">
              {initial.model} · {new Date(initial.analyzedAt).toLocaleString("nb-NO")}
            </span>
          )}
        </div>
        <Button onClick={start} disabled={isLoading} size="sm" variant="outline">
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {isLoading ? "Analyserer…" : initial ? "Analyser på nytt" : "Analyser funn med AI"}
        </Button>
      </div>

      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

      {hasPlan ? (
        <PlanView summary={shown} />
      ) : (
        !isLoading && (
          <p className="text-sm text-muted-foreground">
            Få en konsolidert plan: hvilke oppgraderinger lukker flest funn, og hvor trygge de er.
          </p>
        )
      )}
    </div>
  );
}
