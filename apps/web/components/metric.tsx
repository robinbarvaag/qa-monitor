"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@qa/ui/tooltip";
import { HelpCircle } from "lucide-react";
import type { ReactNode } from "react";

export type MetricTone = "default" | "good" | "warn" | "bad";

const toneText: Record<MetricTone, string> = {
  default: "text-foreground",
  good: "text-emerald-600 dark:text-emerald-500",
  warn: "text-amber-600 dark:text-amber-500",
  bad: "text-destructive",
};
const toneRing: Record<MetricTone, string> = {
  default: "ring-foreground/10",
  good: "ring-emerald-500/30",
  warn: "ring-amber-400/40",
  bad: "ring-destructive/40",
};

/**
 * Liten, gjenbrukbar metrikk-rute: etikett + verdi, fargelagt etter `tone`, med
 * valgfri forklarende tooltip (`hint`). Brukt for tastatur/fokus-tallene m.m.
 */
export function Metric({
  label,
  value,
  tone = "default",
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  tone?: MetricTone;
  hint?: string;
  icon?: ReactNode;
}) {
  const box = (
    <div
      className={`flex w-full flex-col gap-0.5 rounded-lg bg-background/60 px-3 py-2 text-left ring-1 ${toneRing[tone]}`}
    >
      <span className="flex items-center gap-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {icon}
        {label}
        {hint && <HelpCircle className="size-3 opacity-50" />}
      </span>
      <span className={`text-sm font-semibold tabular-nums ${toneText[tone]}`}>{value}</span>
    </div>
  );

  if (!hint) return box;
  return (
    <Tooltip>
      <TooltipTrigger className="cursor-help rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        {box}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-pretty">{hint}</TooltipContent>
    </Tooltip>
  );
}
