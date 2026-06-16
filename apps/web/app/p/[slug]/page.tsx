import { PageExplorer } from "@/components/page-explorer";
import { RunButton } from "@/components/run-button";
import { SiteSection } from "@/components/site-section";
import { SummaryCards } from "@/components/summary-cards";
import { loadProject } from "@/lib/projects";
import { ensureProject, getAnnotations } from "@qa/db";
import { Badge } from "@qa/ui/badge";
import { Activity } from "lucide-react";
import { notFound } from "next/navigation";

// Oppfølging leses fra DB per request → dynamisk render.
export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await loadProject(slug);
  if (!project) notFound();

  const projectId = await ensureProject(slug, project.name);
  const annotations = await getAnnotations(projectId);

  const { report } = project;
  const clean = report.totals.pages - report.totals.pagesWithA11y;
  const healthPct = report.totals.pages > 0 ? Math.round((clean / report.totals.pages) * 100) : 0;
  const healthTone =
    healthPct >= 80 ? "text-emerald-500" : healthPct >= 50 ? "text-amber-500" : "text-destructive";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-8 overflow-hidden rounded-2xl bg-linear-to-br from-accent/60 to-card p-6 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-content-center rounded-lg bg-primary text-primary-foreground">
                <Activity className="size-4.5" />
              </div>
              <h1 className="font-heading text-2xl font-bold">{project.name}</h1>
              <Badge variant="outline" className="font-mono">
                {project.slug}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Per-side-QA fra sitemap · {report.totals.pages} sider
              {report.generated && ` · kjørt ${new Date(report.generated).toLocaleString("nb-NO")}`}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <RunButton slug={slug} />
            <div className="text-right">
              <div className={`font-heading text-4xl font-bold tabular-nums ${healthTone}`}>
                {healthPct}%
              </div>
              <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                uten a11y-brudd
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-10">
        <SummaryCards totals={report.totals} />
        <PageExplorer pages={report.pages} projectSlug={slug} initialAnnotations={annotations} />
        <SiteSection sites={report.sites} />
      </div>
    </div>
  );
}
