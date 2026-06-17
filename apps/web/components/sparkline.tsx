/**
 * Bittliten trend-graf uten avhengigheter — ren inline-SVG. Normaliserer
 * verdiene inn i et fast viewBox og markerer siste punkt. Tåler 0–1 punkt.
 */

type SparkTone = "good" | "bad" | "neutral";

const STROKE: Record<SparkTone, string> = {
  good: "stroke-emerald-500",
  bad: "stroke-destructive",
  neutral: "stroke-muted-foreground",
};
const FILL: Record<SparkTone, string> = {
  good: "fill-emerald-500",
  bad: "fill-destructive",
  neutral: "fill-muted-foreground",
};

export function Sparkline({
  values,
  tone = "neutral",
  width = 96,
  height = 28,
}: {
  values: number[];
  tone?: SparkTone;
  width?: number;
  height?: number;
}) {
  if (values.length === 0) return null;

  const pad = 3;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;

  const x = (i: number) => (values.length === 1 ? w / 2 : (i / (values.length - 1)) * w) + pad;
  // høyere verdi = høyere opp ville være misvisende for «feil»; vi tegner bare
  // formen på kurven, så vi mapper max→topp og min→bunn nøytralt.
  const y = (v: number) => pad + h - ((v - min) / span) * h;

  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const lastX = x(values.length - 1);
  const lastY = y(values[values.length - 1] ?? 0);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      role="img"
      aria-label="Trend over siste kjøringer"
    >
      {values.length > 1 && (
        <polyline
          points={points}
          fill="none"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          className={`${STROKE[tone]} opacity-80`}
        />
      )}
      <circle cx={lastX} cy={lastY} r={2.5} className={FILL[tone]} />
    </svg>
  );
}
