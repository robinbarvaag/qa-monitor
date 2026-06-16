import type { Report } from "@/lib/report";
import { Card } from "@qa/ui/components/ui/card";

function Stat({ label, value, tone }: { label: string; value: number; tone?: "bad" | "warn" }) {
  const valueClass =
    tone === "bad" && value > 0
      ? "text-destructive"
      : tone === "warn" && value > 0
        ? "text-yellow-600 dark:text-yellow-500"
        : "text-foreground";
  return (
    <Card size="sm" className="gap-1 px-4">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className={`font-heading text-2xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </div>
    </Card>
  );
}

export function SummaryCards({ totals }: { totals: Report["totals"] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Stat label="Sider" value={totals.pages} />
      <Stat label="A11y-brudd" value={totals.a11yViolations} tone="bad" />
      <Stat label="Sider m/ a11y" value={totals.pagesWithA11y} tone="warn" />
      <Stat label="Brutte lenker" value={totals.brokenLinks} tone="bad" />
      <Stat label="SEO-feil" value={totals.seoFails} tone="warn" />
      <Stat label="Lastefeil" value={totals.loadErrors} tone="bad" />
    </div>
  );
}
