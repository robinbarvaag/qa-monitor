import { ProjectCard } from "@/components/project-card";
import { listProjects } from "@/lib/projects";
import { Button } from "@qa/ui/button";
import { Plus } from "lucide-react";

export default async function Home() {
  const projects = await listProjects();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">Prosjekter</h1>
          <p className="text-sm text-muted-foreground">{projects.length} overvåkede nettsteder</p>
        </div>
        <Button variant="outline" size="sm" disabled title="Kommer senere">
          <Plus className="size-4" />
          Legg til nettsted
        </Button>
      </div>

      {projects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Ingen prosjekter ennå. Kjør validatoren mot en sitemap og legg en{" "}
          <code className="font-mono">report.json</code> i{" "}
          <code className="font-mono">apps/web/fixtures/</code>.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.slug} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
