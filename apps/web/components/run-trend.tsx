import { Sparkline } from "@/components/sparkline";
import type { RunHistoryPoint, RunTotals } from "@qa/db";
import { Card } from "@qa/ui/card";
import {
  ArrowDown,
  ArrowUp,
  Link2Off,
  Minus,
  ShieldAlert,
  TrendingUp,
  XOctagon,
} from "lucide-react";
import { FileWarning } from "lucide-react";

/**
 * «Utvikling over tid» — én liten sparkline per metrikk over de siste
 * kjøringene, med delta mot forrige kjøring. Lavere er bedre for alle disse
 * metrikkene, så nedgang vises grønt (↓) og oppgang rødt (↑). Leser kun
 * `run.totals`-historikken; ingen klient-JS.
 */

type MetricKey = keyof RunTotals;

const METRICS: { key: MetricKey; label: string; icon: React.ReactNode }[] = [
  { key: "a11yViolations", label: "A11y-brudd", icon: <ShieldAlert className="size-4" /> },
  { key: "brokenLinks", label: "Brutte lenker", icon: <Link2Off className="size-4" /> },
  { key: "seoFails", label: "SEO-feil", icon: <FileWarning className="size-4" /> },
  { key: "loadErrors", label: "Lastefeil", icon: <XOctagon className="size-4" /> },
];

function Delta({ diff }: { diff: number }) {
  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
        <Minus className="size-3" />
        uendret
      </span>
    );
  }
  const better = diff < 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${
        better ? "text-emerald-600 dark:text-emerald-500" : "text-destructive"
      }`}
    >
      {better ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />}
      {Math.abs(diff)}
    </span>
  );
}

function MetricCard({
  label,
  icon,
  values,
}: {
  label: string;
  icon: React.ReactNode;
  values: number[];
}) {
  const current = values[values.length - 1] ?? 0;
  const previous = values[values.length - 2] ?? current;
  const diff = current - previous;
  const tone = diff < 0 ? "good" : diff > 0 ? "bad" : "neutral";

  return (
    <Card size="sm" className="gap-3 px-4">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {icon}
          {label}
        </span>
        <Delta diff={diff} />
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className="font-heading text-3xl leading-none font-semibold tabular-nums">
          {current}
        </span>
        <Sparkline values={values} tone={tone} />
      </div>
    </Card>
  );
}

export function RunTrend({ history }: { history: RunHistoryPoint[] }) {
  // Trenger minst to kjøringer for å vise en utvikling.
  if (history.length < 2) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <TrendingUp className="size-4" />
        Trend vises etter neste kjøring.
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="size-4 text-muted-foreground" />
        <h2 className="font-heading text-lg font-semibold">Utvikling over tid</h2>
        <span className="text-sm text-muted-foreground">siste {history.length} kjøringer</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {METRICS.map((m) => (
          <MetricCard
            key={m.key}
            label={m.label}
            icon={m.icon}
            values={history.map((h) => h.totals[m.key])}
          />
        ))}
      </div>
    </section>
  );
}
