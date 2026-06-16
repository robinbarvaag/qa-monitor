import { PageExplorer } from "@/components/page-explorer";
import { SiteSection } from "@/components/site-section";
import { SummaryCards } from "@/components/summary-cards";
import { loadReport } from "@/lib/report";
import { Badge } from "@qa/ui/badge";
import { Activity } from "lucide-react";

export default async function Home() {
  const report = await loadReport();
  const origin = report.sites[0]?.origin ?? "—";
  const clean = report.totals.pages - report.totals.pagesWithA11y;
  const health = report.totals.pages > 0 ? Math.round((clean / report.totals.pages) * 100) : 0;
  const healthTone =
    health >= 80 ? "text-emerald-500" : health >= 50 ? "text-amber-500" : "text-destructive";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-8 overflow-hidden rounded-2xl bg-linear-to-br from-card to-muted/40 p-6 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-content-center rounded-lg bg-primary text-primary-foreground">
                <Activity className="size-4.5" />
              </div>
              <h1 className="font-heading text-2xl font-bold">qa-monitor</h1>
              <Badge variant="outline" className="font-mono">
                {origin}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Per-side-QA fra sitemap · {report.totals.pages} sider
              {report.generated && ` · kjørt ${new Date(report.generated).toLocaleString("nb-NO")}`}
            </p>
          </div>
          <div className="text-right">
            <div className={`font-heading text-4xl font-bold tabular-nums ${healthTone}`}>
              {health}%
            </div>
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              uten a11y-brudd
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-10">
        <SummaryCards totals={report.totals} />
        <PageExplorer pages={report.pages} />
        <SiteSection sites={report.sites} />
      </div>
    </div>
  );
}
