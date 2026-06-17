"use client";

import { ScreenshotViewer } from "@/components/screenshot-viewer";
import type { MigrationPair, MigrationSide } from "@qa/db";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@qa/ui/accordion";
import { Badge } from "@qa/ui/badge";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ExternalLink,
  GitCompareArrows,
  Minus,
} from "lucide-react";

/** Full blob-URL beholdes; gammel relativ nøkkel serveres fra /shots. */
function shotSrc(key: string | null): string | null {
  if (!key) return null;
  return /^https?:\/\//.test(key) ? key : `/shots/${key}`;
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

/** Delta new−old for en metrikk der lavere = bedre. */
function MetricDelta({
  label,
  oldV,
  newV,
}: {
  label: string;
  oldV: number | undefined;
  newV: number | undefined;
}) {
  const known = oldV !== undefined && newV !== undefined;
  const diff = known ? (newV as number) - (oldV as number) : 0;
  const tone =
    diff < 0
      ? "text-emerald-600 dark:text-emerald-500"
      : diff > 0
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{oldV ?? "–"}</span>
      <ArrowRight className="size-3 text-muted-foreground" />
      <span className="tabular-nums">{newV ?? "–"}</span>
      {known && diff !== 0 && (
        <span className={`inline-flex items-center font-semibold ${tone}`}>
          {diff < 0 ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />}
          {Math.abs(diff)}
        </span>
      )}
      {known && diff === 0 && <Minus className="size-3 text-muted-foreground" />}
    </span>
  );
}

function SideColumn({ title, side }: { title: string; side: MigrationSide | null }) {
  const src = shotSrc(side?.screenshotKey ?? null);
  return (
    <div className="space-y-2 rounded-xl bg-muted/30 p-3 ring-1 ring-foreground/5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </span>
        {side && (
          <Badge variant={side.httpStatus && side.httpStatus >= 400 ? "destructive" : "secondary"}>
            {side.httpStatus ?? "—"}
          </Badge>
        )}
      </div>
      {side ? (
        <>
          <a
            href={side.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 truncate text-sm text-primary hover:underline"
          >
            <ExternalLink className="size-3.5 shrink-0" />
            <span className="truncate">{side.url}</span>
          </a>
          <div className="flex flex-wrap gap-1.5">
            {side.a11y > 0 && <Badge variant="secondary">a11y {side.a11y}</Badge>}
            {side.broken > 0 && <Badge variant="destructive">{side.broken} brutt</Badge>}
            {side.seo > 0 && <Badge variant="destructive">SEO {side.seo}</Badge>}
          </div>
          {src ? (
            <ScreenshotViewer src={src} label={pathOf(side.url)} />
          ) : (
            <p className="text-xs text-muted-foreground">Ingen skjermbilde.</p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Mangler i kjøringen.</p>
      )}
    </div>
  );
}

export function MigrationCompare({ pairs }: { pairs: MigrationPair[] }) {
  if (pairs.length === 0) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="size-4 text-muted-foreground" />
          <h2 className="font-heading text-lg font-semibold">Sammenlign (gammel → ny)</h2>
        </div>
        <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Ingen par ennå. Kjør valideringen for å sammenligne gammel mot ny.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <GitCompareArrows className="size-4 text-muted-foreground" />
        <h2 className="font-heading text-lg font-semibold">Sammenlign (gammel → ny)</h2>
        <span className="text-sm text-muted-foreground">{pairs.length} par</span>
      </div>

      <Accordion multiple className="gap-2">
        {pairs.map((pair) => {
          const ref = pair.old ?? pair.new;
          return (
            <AccordionItem
              key={pair.pairKey}
              value={pair.pairKey}
              className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
            >
              <AccordionTrigger className="items-center gap-3 rounded-none px-4 hover:no-underline">
                <span className="min-w-0 flex-1 truncate font-mono text-sm">
                  {ref ? pathOf(ref.url) : pair.pairKey}
                </span>
                <span className="hidden shrink-0 items-center gap-3 sm:flex">
                  <MetricDelta label="a11y" oldV={pair.old?.a11y} newV={pair.new?.a11y} />
                  <MetricDelta label="brutt" oldV={pair.old?.broken} newV={pair.new?.broken} />
                  <MetricDelta label="SEO" oldV={pair.old?.seo} newV={pair.new?.seo} />
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <SideColumn title="Gammel (url)" side={pair.old} />
                  <SideColumn title="Ny (ny-url)" side={pair.new} />
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </section>
  );
}
