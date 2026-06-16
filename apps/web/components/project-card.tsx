import type { Project } from "@/lib/projects";
import { Badge } from "@qa/ui/badge";
import { Card } from "@qa/ui/card";
import { Globe } from "lucide-react";
import Link from "next/link";

function health(p: Project): number {
  const t = p.report.totals;
  return t.pages > 0 ? Math.round(((t.pages - t.pagesWithA11y) / t.pages) * 100) : 0;
}

export function ProjectCard({ project }: { project: Project }) {
  const t = project.report.totals;
  const h = health(project);
  const tone = h >= 80 ? "text-emerald-500" : h >= 50 ? "text-amber-500" : "text-destructive";
  const issues = t.a11yViolations + t.brokenLinks + t.loadErrors;

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
          <div className={`shrink-0 font-heading text-lg font-bold tabular-nums ${tone}`}>{h}%</div>
        </div>

        <div className="flex flex-wrap gap-1.5 px-(--card-spacing)">
          <Badge variant="outline">{t.pages} sider</Badge>
          {t.a11yViolations > 0 ? (
            <Badge variant="destructive">{t.a11yViolations} a11y</Badge>
          ) : (
            <Badge variant="secondary">0 a11y</Badge>
          )}
          {t.brokenLinks > 0 && <Badge variant="destructive">{t.brokenLinks} brutt</Badge>}
          {t.seoFails > 0 && <Badge variant="secondary">{t.seoFails} SEO</Badge>}
        </div>

        <div className="px-(--card-spacing) text-xs text-muted-foreground">
          {issues === 0 ? "Ingen problemer 🎉" : `${issues} problemer totalt`}
          {project.report.generated &&
            ` · kjørt ${new Date(project.report.generated).toLocaleDateString("nb-NO")}`}
        </div>
      </Card>
    </Link>
  );
}
