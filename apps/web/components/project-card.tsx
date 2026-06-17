import type { ProjectSummary } from "@/lib/projects";
import { type ScoreKey, scoreReport, scoreTone } from "@/lib/score";
import { Badge } from "@qa/ui/badge";
import { Card } from "@qa/ui/card";
import { Globe } from "lucide-react";
import Link from "next/link";

const TONE_TEXT: Record<"good" | "warn" | "bad", string> = {
  good: "text-emerald-500",
  warn: "text-amber-500",
  bad: "text-destructive",
};
const SHORT: Record<ScoreKey, string> = {
  a11y: "A11y",
  performance: "Ytelse",
  seo: "SEO",
  best: "Praksis",
};

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const report = project.report;
  const t = report?.totals;
  const score = report ? scoreReport(report) : null;
  const issues = t ? t.a11yViolations + t.brokenLinks + t.loadErrors + t.jsErrors : 0;

  return (
    <Link href={`/p/${project.slug}`} className="group block">
      <Card className="gap-4 transition-colors group-hover:ring-foreground/25">
        <div className="flex items-center justify-between gap-3 px-(--card-spacing)">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid size-9 shrink-0 place-content-center rounded-lg bg-muted text-muted-foreground">
              <Globe className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-heading text-sm font-semibold">{project.name}</div>
              <div className="truncate font-mono text-xs text-muted-foreground">{project.slug}</div>
            </div>
          </div>
          <div
            className={`shrink-0 font-heading text-2xl font-bold tabular-nums ${
              score ? TONE_TEXT[scoreTone(score.overall)] : "text-muted-foreground"
            }`}
          >
            {score ? score.overall : "–"}
          </div>
        </div>

        {score && t ? (
          <>
            <div className="grid grid-cols-4 gap-1 px-(--card-spacing)">
              {score.categories.map((c) => (
                <div key={c.key} className="text-center">
                  <div
                    className={`font-heading text-sm font-bold tabular-nums ${TONE_TEXT[scoreTone(c.score)]}`}
                  >
                    {c.score}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{SHORT[c.key]}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5 px-(--card-spacing) text-xs text-muted-foreground">
              <Badge variant="outline">{t.pages} sider</Badge>
              <span>
                {issues === 0 ? "Ingen problemer 🎉" : `${issues} problemer`}
                {report?.generated &&
                  ` · ${new Date(report.generated).toLocaleDateString("nb-NO")}`}
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 px-(--card-spacing)">
            <Badge variant="secondary">Ikke kjørt ennå</Badge>
            <span className="text-xs text-muted-foreground">Åpne og trykk «Kjør validering»</span>
          </div>
        )}
      </Card>
    </Link>
  );
}
