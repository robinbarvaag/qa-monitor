import { SEVERITY_LABEL, severityBadge, severityDotClass } from "@/lib/ui-helpers";
import type { RunSummaryContent } from "@qa/db";
import { Badge } from "@qa/ui/badge";
import { Sparkles } from "lucide-react";

export function AiSummary({
  summary,
  model,
  createdAt,
}: {
  summary: RunSummaryContent;
  model: string;
  createdAt: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-linear-to-br from-primary/8 to-card p-6 ring-1 ring-primary/20">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-content-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <h2 className="font-heading text-lg font-semibold">AI-analyse</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {model} · {new Date(createdAt).toLocaleString("nb-NO")}
        </span>
      </div>

      <p className="mb-5 text-sm leading-relaxed text-foreground/90">{summary.headline}</p>

      {summary.issues.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ingen prioriterte problemer funnet 🎉</p>
      ) : (
        <ol className="space-y-3">
          {summary.issues.map((issue, i) => (
            <li
              key={`${issue.title}-${i}`}
              className="rounded-xl bg-card/70 p-4 ring-1 ring-foreground/10"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`size-2.5 shrink-0 rounded-full ${severityDotClass(issue.severity)}`}
                />
                <span className="font-medium">{issue.title}</span>
                <Badge variant={severityBadge(issue.severity)}>
                  {SEVERITY_LABEL[issue.severity]}
                </Badge>
                {issue.pages && issue.pages.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {issue.pages.length} side{issue.pages.length === 1 ? "" : "r"}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{issue.detail}</p>
              <p className="mt-1.5 text-sm">
                <span className="font-medium text-primary">Forslag: </span>
                {issue.suggestion}
              </p>
              {issue.pages && issue.pages.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {issue.pages.slice(0, 8).map((p) => (
                    <code key={p} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {p}
                    </code>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
