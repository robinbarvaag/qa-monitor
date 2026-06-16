"use client";

import { SEVERITY_LABEL, severityBadge, severityDotClass } from "@/lib/ui-helpers";
import type { AnalysisSeverity } from "@qa/db";
import { Badge } from "@qa/ui/badge";
import { ExternalLink } from "lucide-react";

/** Delvis form (streames inn token for token via useObject). */
export interface PartialIssue {
  severity?: AnalysisSeverity;
  title?: string;
  detail?: string;
  suggestion?: string;
  pages?: (string | undefined)[];
}
export interface PartialSummary {
  headline?: string;
  issues?: (PartialIssue | undefined)[];
}

function PageLinks({
  pages,
  pathToUrl,
}: {
  pages: (string | undefined)[];
  pathToUrl: Record<string, string>;
}) {
  const valid = pages.filter((p): p is string => Boolean(p));
  if (valid.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {valid.slice(0, 10).map((p) => {
        const href = p.startsWith("http") ? p : (pathToUrl[p] ?? null);
        const className =
          "inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs transition-colors";
        return href ? (
          <a
            key={p}
            href={href}
            target="_blank"
            rel="noreferrer"
            className={`${className} text-foreground/80 hover:bg-primary/15 hover:text-primary`}
          >
            {p}
            <ExternalLink className="size-3 opacity-60" />
          </a>
        ) : (
          <code key={p} className={`${className} text-muted-foreground`}>
            {p}
          </code>
        );
      })}
    </div>
  );
}

export function AiSummaryView({
  summary,
  pathToUrl,
  streaming = false,
}: {
  summary: PartialSummary | undefined;
  pathToUrl: Record<string, string>;
  streaming?: boolean;
}) {
  const issues = (summary?.issues ?? []).filter((i): i is PartialIssue => Boolean(i));
  return (
    <div className="space-y-4">
      {summary?.headline ? (
        <p className="text-sm leading-relaxed text-foreground/90">{summary.headline}</p>
      ) : (
        streaming && <div className="h-4 w-2/3 animate-pulse rounded bg-foreground/10" />
      )}

      {issues.length > 0 && (
        <ol className="space-y-3">
          {issues.map((issue, i) => {
            const severity = issue.severity ?? "info";
            return (
              <li
                key={`${issue.title ?? "issue"}-${i}`}
                className="animate-in fade-in slide-in-from-bottom-1 rounded-xl bg-card/70 p-4 ring-1 ring-foreground/10 duration-300"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`size-2.5 shrink-0 rounded-full ${severityDotClass(severity)}`}
                  />
                  <span className="font-medium">{issue.title ?? "…"}</span>
                  {issue.severity && (
                    <Badge variant={severityBadge(severity)}>{SEVERITY_LABEL[severity]}</Badge>
                  )}
                </div>
                {issue.detail && (
                  <p className="mt-1.5 text-sm text-muted-foreground">{issue.detail}</p>
                )}
                {issue.suggestion && (
                  <p className="mt-1.5 text-sm">
                    <span className="font-medium text-primary">Forslag: </span>
                    {issue.suggestion}
                  </p>
                )}
                {issue.pages && <PageLinks pages={issue.pages} pathToUrl={pathToUrl} />}
              </li>
            );
          })}
        </ol>
      )}

      {streaming && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          Genererer…
        </div>
      )}
    </div>
  );
}
