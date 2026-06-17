import type { Report } from "@/lib/report";
import { Card } from "@qa/ui/card";
import {
  AlertTriangle,
  Bug,
  FileWarning,
  Link2Off,
  ScanSearch,
  ShieldAlert,
  XOctagon,
} from "lucide-react";

type Tone = "neutral" | "bad" | "warn";

function Stat({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: Tone;
}) {
  const active = value > 0 && tone !== "neutral";
  const accent =
    tone === "bad" && active
      ? "text-destructive"
      : tone === "warn" && active
        ? "text-amber-600 dark:text-amber-500"
        : "text-foreground";
  const iconWrap =
    tone === "bad" && active
      ? "bg-destructive/10 text-destructive"
      : tone === "warn" && active
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-500"
        : "bg-muted text-muted-foreground";

  return (
    <Card size="sm" className="flex-row items-center gap-3 px-4">
      <div className={`grid size-9 shrink-0 place-content-center rounded-lg ${iconWrap}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className={`font-heading text-2xl leading-none font-semibold tabular-nums ${accent}`}>
          {value}
        </div>
        <div className="mt-1 truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </div>
      </div>
    </Card>
  );
}

export function SummaryCards({ totals }: { totals: Report["totals"] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      <Stat label="Sider" value={totals.pages} icon={<ScanSearch className="size-4.5" />} />
      <Stat
        label="A11y-brudd"
        value={totals.a11yViolations}
        tone="bad"
        icon={<ShieldAlert className="size-4.5" />}
      />
      <Stat
        label="Sider m/ a11y"
        value={totals.pagesWithA11y}
        tone="warn"
        icon={<AlertTriangle className="size-4.5" />}
      />
      <Stat
        label="Brutte lenker"
        value={totals.brokenLinks}
        tone="bad"
        icon={<Link2Off className="size-4.5" />}
      />
      <Stat
        label="SEO-feil"
        value={totals.seoFails}
        tone="warn"
        icon={<FileWarning className="size-4.5" />}
      />
      <Stat
        label="Lastefeil"
        value={totals.loadErrors}
        tone="bad"
        icon={<XOctagon className="size-4.5" />}
      />
      <Stat
        label="JS-feil"
        value={totals.jsErrors}
        tone="bad"
        icon={<Bug className="size-4.5" />}
      />
    </div>
  );
}
