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
const toneBox: Record<MetricTone, string> = {
  default: "bg-muted/40 ring-foreground/10",
  good: "bg-emerald-500/10 ring-emerald-500/30",
  warn: "bg-amber-400/10 ring-amber-400/40",
  bad: "bg-destructive/10 ring-destructive/40",
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
      className={`flex h-full w-full flex-col justify-between gap-1 rounded-lg px-3 py-2 text-left ring-1 ${toneBox[tone]}`}
    >
      <span className="flex min-h-7 items-start gap-1 text-[11px] leading-tight font-medium tracking-wide text-muted-foreground uppercase">
        {icon}
        {label}
        {hint && <HelpCircle className="mt-px size-3 shrink-0 opacity-50" />}
      </span>
      <span className={`text-base font-semibold tabular-nums ${toneText[tone]}`}>{value}</span>
    </div>
  );

  if (!hint) return box;
  return (
    <Tooltip>
      <TooltipTrigger className="block h-full w-full cursor-help rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        {box}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-pretty">{hint}</TooltipContent>
    </Tooltip>
  );
}
