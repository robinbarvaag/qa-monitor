import type { ModePref } from "@/app/actions";
import { AiAnalysisPanel } from "@/components/ai-analysis-panel";
import { ChecklistCard } from "@/components/checklist-card";
import { FindingsSection } from "@/components/findings-section";
import { MigrationCompare } from "@/components/migration-compare";
import { PageExplorer } from "@/components/page-explorer";
import { ProjectSettingsDialog } from "@/components/project-settings-dialog";
import { RegressionPanel } from "@/components/regression-panel";
import { RunButton } from "@/components/run-button";
import { RunTrend } from "@/components/run-trend";
import { ScorePanel } from "@/components/score-panel";
import { SiteSection } from "@/components/site-section";
import { SummaryCards } from "@/components/summary-cards";
import { buildChecklist } from "@/lib/checklist";
import { loadProject } from "@/lib/projects";
import { computeRegressions } from "@/lib/regressions";
import { scoreReport } from "@/lib/score";
import {
  ensureProject,
  getActiveRun,
  getAnnotations,
  getChecklistState,
  getFindingsAnalysis,
  getGithubSource,
  getLatestFindings,
  getMigrationPairs,
  getPreviousRunCounts,
  getProjectName,
  getRunAnalyses,
  getRunHistory,
  getWebValidationConfig,
} from "@qa/db";
import { Badge } from "@qa/ui/badge";
import { Activity, Radar } from "lucide-react";
import { notFound } from "next/navigation";

// Oppfølging leses fra DB per request → dynamisk render.
export const dynamic = "force-dynamic";

function ProjectHeader({
  name,
  slug,
  subtitle,
  children,
}: {
  name: string;
  slug: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-8 overflow-hidden rounded-2xl bg-linear-to-br from-accent/60 to-card p-6 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-content-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="size-4.5" />
            </div>
            <h1 className="font-heading text-2xl font-bold">{name}</h1>
            <Badge variant="outline" className="font-mono">
              {slug}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </div>
    </header>
  );
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await loadProject(slug);
  const webConfig = await getWebValidationConfig(slug);
  const projectMode = typeof webConfig?.mode === "string" ? webConfig.mode : null;
  const isMigration = projectMode === "migration";
  const settingsUrl = typeof webConfig?.url === "string" ? webConfig.url : "";
  const modePref = (webConfig?.modePref as ModePref | undefined) ?? "auto";
  const activeRunId = await getActiveRun(slug);

  // Prosjekt finnes, men ingen fullført kjøring ennå → la brukeren kjøre den første.
  if (!project) {
    const name = await getProjectName(slug);
    if (!name) notFound();
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <ProjectHeader name={name} slug={slug} subtitle="Nytt nettsted · ingen kjøring ennå">
          <div className="flex items-center gap-2">
            <ProjectSettingsDialog
              slug={slug}
              name={name}
              url={settingsUrl}
              modePref={modePref}
              isMigration={isMigration}
            />
            <RunButton
              slug={slug}
              migration={isMigration}
              activeRunId={activeRunId}
              modePref={modePref}
            />
          </div>
        </ProjectHeader>
        <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
          <Radar className="size-8 text-muted-foreground" />
          <p className="max-w-md text-sm text-muted-foreground">
            {isMigration
              ? "Ingen kjøring ennå. Trykk «Kjør validering» for å validere alle gammel/ny-parene og se dem side om side."
              : "Ingen kjøring ennå. Trykk «Kjør validering» for å hente sidene fra sitemap (eller crawle nettstedet) og se tilgjengelighet, SEO, tastatur og lenker."}
          </p>
        </div>
      </div>
    );
  }

  const projectId = await ensureProject(slug, project.name);
  const annotations = await getAnnotations(projectId);
  const analyses = await getRunAnalyses(slug);
  const history = await getRunHistory(slug);
  const previousCounts = await getPreviousRunCounts(slug);
  const migrationPairs = isMigration ? await getMigrationPairs(slug) : [];
  const githubSource = await getGithubSource(slug);
  const findings = githubSource ? await getLatestFindings(slug) : [];
  const findingsAnalysis = githubSource ? await getFindingsAnalysis(slug) : null;
  const checklistState = await getChecklistState(projectId);

  const { report } = project;
  const checklist = buildChecklist(report, findings, checklistState);
  const regressions = computeRegressions(report, previousCounts);
  const score = scoreReport(report);
  // sti/URL → full URL, så AI-panelet kan gjøre side-referanser klikkbare
  const pathToUrl: Record<string, string> = {};
  for (const p of report.pages) {
    pathToUrl[p.path] = p.url;
    pathToUrl[p.url] = p.url;
  }
  const scoreToneClass =
    score.overall >= 90
      ? "text-emerald-500"
      : score.overall >= 50
        ? "text-amber-500"
        : "text-destructive";

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
              {isMigration
                ? "Migrering · gammel vs ny"
                : projectMode === "crawl"
                  ? "Per-side-QA via crawl"
                  : "Per-side-QA fra sitemap"}{" "}
              · {report.totals.pages} sider
              {report.generated && ` · kjørt ${new Date(report.generated).toLocaleString("nb-NO")}`}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ProjectSettingsDialog
              slug={slug}
              name={project.name}
              url={settingsUrl}
              modePref={modePref}
              isMigration={isMigration}
            />
            <RunButton
              slug={slug}
              migration={isMigration}
              activeRunId={activeRunId}
              modePref={modePref}
            />
            <div className="text-right">
              <div className={`font-heading text-4xl font-bold tabular-nums ${scoreToneClass}`}>
                {score.overall}
              </div>
              <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                kvalitetsscore
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-10">
        <SummaryCards totals={report.totals} />
        {!isMigration && <ScorePanel score={score} />}
        {!isMigration && <RegressionPanel regressions={regressions} />}
        <ChecklistCard slug={slug} checklist={checklist} />
        <RunTrend history={history} />
        <AiAnalysisPanel
          slug={slug}
          pathToUrl={pathToUrl}
          initial={{
            summary: analyses?.summary ?? null,
            model: analyses?.model ?? null,
            createdAt: analyses?.createdAt ?? null,
          }}
        />
        {isMigration ? (
          <MigrationCompare pairs={migrationPairs} />
        ) : (
          <>
            <PageExplorer
              pages={report.pages}
              projectSlug={slug}
              initialAnnotations={annotations}
              pageAnalyses={analyses?.byUrl ?? {}}
              previousCounts={previousCounts ?? undefined}
            />
            <SiteSection sites={report.sites} />
            <FindingsSection
              slug={slug}
              source={githubSource}
              findings={findings}
              initialAnnotations={annotations}
              analysis={findingsAnalysis}
            />
          </>
        )}
      </div>
    </div>
  );
}
