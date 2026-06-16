import { PageExplorer } from "@/components/page-explorer";
import { SiteSection } from "@/components/site-section";
import { SummaryCards } from "@/components/summary-cards";
import { loadReport } from "@/lib/report";

export default async function Home() {
  const report = await loadReport();
  const origin = report.sites[0]?.origin ?? "—";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-8 space-y-1">
        <div className="flex items-baseline gap-3">
          <h1 className="font-heading text-2xl font-bold">qa-monitor</h1>
          <span className="font-mono text-sm text-muted-foreground">{origin}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Per-side-QA fra sitemap · {report.totals.pages} sider
          {report.generated && ` · kjørt ${new Date(report.generated).toLocaleString("nb-NO")}`}
        </p>
      </header>

      <div className="space-y-10">
        <SummaryCards totals={report.totals} />
        <PageExplorer pages={report.pages} />
        <SiteSection sites={report.sites} />
      </div>
    </div>
  );
}
