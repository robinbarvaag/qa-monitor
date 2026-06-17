import { ChecklistView } from "@/components/checklist-view";
import { ProjectMembers } from "@/components/project-members";
import { buildChecklist } from "@/lib/checklist";
import { loadProject } from "@/lib/projects";
import {
  ensureProject,
  getChecklistState,
  getGithubSource,
  getLatestFindings,
  getProjectName,
  listProjectMembers,
} from "@qa/db";
import { Badge } from "@qa/ui/badge";
import { ArrowLeft, ListChecks } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

// Sjekkliste-state leses fra DB per request → dynamisk render.
export const dynamic = "force-dynamic";

export default async function ChecklistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const name = await getProjectName(slug);
  if (!name) notFound();

  const project = await loadProject(slug);
  const report = project?.report ?? null;
  const projectId = await ensureProject(slug, name);
  const githubSource = await getGithubSource(slug);
  const findings = githubSource ? await getLatestFindings(slug) : [];
  const state = await getChecklistState(projectId);
  const members = await listProjectMembers(projectId);

  const checklist = buildChecklist(report, findings, state);
  const pct = checklist.total > 0 ? Math.round((checklist.done / checklist.total) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Link
        href={`/p/${slug}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {name}
      </Link>

      <header className="mb-8 overflow-hidden rounded-2xl bg-linear-to-br from-accent/60 to-card p-6 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-content-center rounded-lg bg-primary text-primary-foreground">
              <ListChecks className="size-4.5" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold">Sjekklister</h1>
              <p className="text-sm text-muted-foreground">
                Kvalitetssjekk per fagområde · klikk «hvorfor / hvordan» for å lære
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="font-heading text-4xl font-bold tabular-nums text-emerald-500">
              {pct}%
            </div>
            <Badge variant="outline" className="font-mono">
              {checklist.done}/{checklist.total} ferdig
            </Badge>
          </div>
        </div>
      </header>

      <div className="mb-6">
        <ProjectMembers slug={slug} members={members} />
      </div>

      <ChecklistView groups={checklist.groups} slug={slug} members={members} />
    </div>
  );
}
