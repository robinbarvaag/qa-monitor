import { AddProjectDialog } from "@/components/add-project-dialog";
import { ProjectCard } from "@/components/project-card";
import { listProjects } from "@/lib/projects";

// Prosjekter leses fra DB → dynamisk render.
export const dynamic = "force-dynamic";

export default async function Home() {
  const projects = await listProjects();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">Prosjekter</h1>
          <p className="text-sm text-muted-foreground">{projects.length} overvåkede nettsteder</p>
        </div>
        <AddProjectDialog />
      </div>

      {projects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Ingen nettsteder ennå. Trykk «Legg til nettsted» og oppgi en sitemap-URL for å komme i
          gang.
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
