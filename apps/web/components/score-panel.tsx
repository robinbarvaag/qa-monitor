import { type ReportScore, scoreTone } from "@/lib/score";
import { Gauge } from "lucide-react";

/**
 * Lighthouse-aktig score-panel: én sirkel-måler per kategori med fargebånd
 * (grønn ≥90, gul 50–89, rød <50). Total-scoren vises i prosjekt-headeren.
 */

const STROKE: Record<"good" | "warn" | "bad", string> = {
  good: "stroke-emerald-500",
  warn: "stroke-amber-500",
  bad: "stroke-destructive",
};
const TEXT: Record<"good" | "warn" | "bad", string> = {
  good: "text-emerald-500",
  warn: "text-amber-500",
  bad: "text-destructive",
};

function ScoreGauge({ value, label }: { value: number; label: string }) {
  const size = 72;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = scoreTone(value);
  const offset = c * (1 - value / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          role="img"
          aria-label={`${label}: ${value} av 100`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            className={STROKE[tone]}
            style={{
              strokeDasharray: c,
              strokeDashoffset: offset,
              transition: "stroke-dashoffset .5s",
            }}
          />
        </svg>
        <span
          className={`absolute inset-0 grid place-content-center font-heading text-lg font-bold tabular-nums ${TEXT[tone]}`}
        >
          {value}
        </span>
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

export function ScorePanel({ score }: { score: ReportScore }) {
  return (
    <section className="space-y-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex items-center gap-2">
        <Gauge className="size-4 text-muted-foreground" />
        <h2 className="font-heading text-base font-semibold">Kvalitetsscore</h2>
        <span className="text-sm text-muted-foreground">snitt over alle sider · 0–100</span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {score.categories.map((cat) => (
          <ScoreGauge key={cat.key} value={cat.score} label={cat.label} />
        ))}
      </div>
    </section>
  );
}
