import type { ChecklistData } from "@/lib/checklist";
import { ChevronRight, ListChecks } from "lucide-react";
import Link from "next/link";

/** Fremdriftskort på prosjektsiden som lenker inn til sjekklista. */
export function ChecklistCard({ slug, checklist }: { slug: string; checklist: ChecklistData }) {
  const pct = checklist.total > 0 ? Math.round((checklist.done / checklist.total) * 100) : 0;

  return (
    <Link
      href={`/p/${slug}/sjekkliste`}
      className="group flex items-center gap-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 transition-colors hover:ring-primary/40"
    >
      <div className="grid size-10 shrink-0 place-content-center rounded-xl bg-primary/10 text-primary">
        <ListChecks className="size-5" />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-base font-semibold">Sjekklister per fagområde</h2>
          <span className="text-sm tabular-nums text-muted-foreground">
            {checklist.done}/{checklist.total} · {pct}%
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {checklist.groups.map((g) => (
            <span
              key={g.discipline}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {g.label}
              <span className="tabular-nums">
                {g.done}/{g.total}
              </span>
            </span>
          ))}
        </div>
      </div>

      <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
