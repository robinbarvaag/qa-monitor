"use client";

import { saveAnnotationAction } from "@/app/actions";
import type { ReportPage } from "@/lib/report";
import { impactBadge, impactDotClass, seoBadge, worstImpact } from "@/lib/ui-helpers";
import type { AnnotationEntry, AnnotationMap, AnnotationStatus } from "@qa/db";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@qa/ui/accordion";
import { Badge } from "@qa/ui/badge";
import { Button } from "@qa/ui/button";
import { Input } from "@qa/ui/input";
import { MultiSelect } from "@qa/ui/multi-select";
import { Textarea } from "@qa/ui/textarea";
import {
  AlertTriangle,
  ArrowUpDown,
  Check,
  ExternalLink,
  Flag,
  Image as ImageIcon,
  Keyboard,
  Link2,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

const EMPTY: AnnotationEntry = { status: null, note: null };
type StatusFilter = "all" | "followup" | "done" | "none";
type Sort = "path" | "a11y" | "broken" | "status";

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button type="button" size="sm" variant={active ? "default" : "outline"} onClick={onClick}>
      {children}
    </Button>
  );
}

function DetailBlock({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function statusRing(status: AnnotationStatus | null): string {
  if (status === "followup") return "ring-amber-400/70";
  if (status === "done") return "ring-emerald-500/60";
  return "ring-foreground/10";
}

function PageRow({
  page,
  annotation,
  onStatus,
  onNoteChange,
  onNoteCommit,
}: {
  page: ReportPage;
  annotation: AnnotationEntry;
  onStatus: (target: string, status: AnnotationStatus) => void;
  onNoteChange: (target: string, note: string) => void;
  onNoteCommit: (target: string) => void;
}) {
  const worst = worstImpact(page.a11y.byImpact);
  const broken = page.links.broken.length;
  const isError = Boolean(page.loadError) || !page.ok;
  const status = annotation.status;

  return (
    <AccordionItem
      value={page.url}
      className={`overflow-hidden rounded-xl bg-card ring-1 not-last:border-b-0 ${statusRing(status)}`}
    >
      <AccordionTrigger className="items-center gap-3 rounded-none px-4 hover:no-underline">
        <span className={`size-2.5 shrink-0 rounded-full ${impactDotClass(worst)}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-sm">{page.path}</span>
          {page.meta.title && (
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {page.meta.title}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {status === "followup" && (
            <Badge className="border-amber-400/40 bg-amber-400/15 text-amber-700 dark:text-amber-400">
              <Flag className="size-3" />
              Følg opp
            </Badge>
          )}
          {status === "done" && (
            <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              <Check className="size-3" />
              Ferdig
            </Badge>
          )}
          {isError && <Badge variant="destructive">{page.httpStatus ?? "feil"}</Badge>}
          {page.a11y.violationCount > 0 && (
            <Badge
              variant={worst && impactBadge(worst) === "destructive" ? "destructive" : "secondary"}
            >
              a11y {page.a11y.violationCount}
            </Badge>
          )}
          {broken > 0 && <Badge variant="destructive">{broken} brutt</Badge>}
          {page.seoFailCount > 0 && <Badge variant="secondary">SEO {page.seoFailCount}</Badge>}
          {page.jsDependent && <Badge variant="outline">JS</Badge>}
        </span>
      </AccordionTrigger>

      <AccordionContent className="px-4">
        <a
          href={page.url}
          target="_blank"
          rel="noreferrer"
          className="mb-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ExternalLink className="size-3.5" />
          {page.url}
        </a>

        <div className="mb-6 rounded-lg bg-muted/40 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={status === "followup" ? "default" : "outline"}
              className={
                status === "followup" ? "bg-amber-500 text-white hover:bg-amber-500/90" : ""
              }
              onClick={() => onStatus(page.url, "followup")}
            >
              <Flag className="size-3.5" />
              Følg opp
            </Button>
            <Button
              type="button"
              size="sm"
              variant={status === "done" ? "default" : "outline"}
              className={
                status === "done" ? "bg-emerald-600 text-white hover:bg-emerald-600/90" : ""
              }
              onClick={() => onStatus(page.url, "done")}
            >
              <Check className="size-3.5" />
              Ferdig
            </Button>
          </div>
          <Textarea
            value={annotation.note ?? ""}
            onChange={(e) => onNoteChange(page.url, e.target.value)}
            onBlur={() => onNoteCommit(page.url)}
            placeholder="Notat … (markerer automatisk som «følg opp»)"
            className="min-h-16 bg-background"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <DetailBlock icon={<AlertTriangle className="size-3.5" />} title="Tilgjengelighet (axe)">
            {page.a11y.violations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen brudd 🎉</p>
            ) : (
              <ul className="space-y-2">
                {page.a11y.violations.map((v) => (
                  <li key={v.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={impactBadge(v.impact)}>{v.impact}</Badge>
                      <a
                        href={v.helpUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium hover:underline"
                      >
                        {v.id}
                      </a>
                      <span className="text-muted-foreground">×{v.nodes}</span>
                    </div>
                    <p className="text-muted-foreground">{v.help}</p>
                  </li>
                ))}
              </ul>
            )}
            {page.a11y.incompleteCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {page.a11y.incompleteCount} krever manuell sjekk.
              </p>
            )}
          </DetailBlock>

          <DetailBlock icon={<Search className="size-3.5" />} title="SEO">
            {page.seo.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen SEO-data.</p>
            ) : (
              <ul className="space-y-1.5">
                {page.seo.map((s) => (
                  <li key={s.key} className="flex items-start gap-2 text-sm">
                    <Badge variant={seoBadge(s.level)}>{s.level}</Badge>
                    <span className="text-muted-foreground">{s.msg}</span>
                  </li>
                ))}
              </ul>
            )}
          </DetailBlock>

          <DetailBlock icon={<Keyboard className="size-3.5" />} title="Tastatur / fokus">
            {page.keyboard ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Tab-stopp</dt>
                <dd className="tabular-nums">{page.keyboard.tabStops}</dd>
                <dt className="text-muted-foreground">Skip-lenke</dt>
                <dd>{page.keyboard.skipLink?.present ? "ja" : "nei"}</dd>
                <dt className="text-muted-foreground">Tab-felle</dt>
                <dd>{page.keyboard.trap ? "ja ⚠" : "nei"}</dd>
                <dt className="text-muted-foreground">Usynlig fokus</dt>
                <dd className="tabular-nums">{page.keyboard.noFocusCount}</dd>
                <dt className="text-muted-foreground">Utilgjengelige</dt>
                <dd className="tabular-nums">{page.keyboard.unreachableCount}</dd>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Ikke sjekket.</p>
            )}
          </DetailBlock>

          <DetailBlock icon={<Link2 className="size-3.5" />} title="Lenker">
            <p className="text-sm text-muted-foreground">
              {page.links.total} totalt
              {page.links.uncertain.length > 0 && `, ${page.links.uncertain.length} usikre`}
            </p>
            {page.links.broken.length > 0 && (
              <ul className="space-y-1 text-sm">
                {page.links.broken.slice(0, 8).map((l) => (
                  <li key={l.url} className="flex items-center gap-2">
                    <Badge variant="destructive">{l.status ?? "—"}</Badge>
                    <span className="truncate text-muted-foreground">{l.url}</span>
                  </li>
                ))}
              </ul>
            )}
          </DetailBlock>
        </div>

        {page.screenshot && (
          <div className="mt-6 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <ImageIcon className="size-3.5" />
              Skjermbilde
            </div>
            <a
              href={page.screenshot}
              target="_blank"
              rel="noreferrer"
              className="block max-h-112 overflow-hidden rounded-lg ring-1 ring-foreground/10"
              title="Åpne i full størrelse"
            >
              <img
                src={page.screenshot}
                alt={`Skjermbilde av ${page.path}`}
                loading="lazy"
                className="w-full"
              />
            </a>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

export function PageExplorer({
  pages,
  projectSlug,
  initialAnnotations,
}: {
  pages: ReportPage[];
  projectSlug: string;
  initialAnnotations: AnnotationMap;
}) {
  const [annotations, setAnnotations] = useState<AnnotationMap>(initialAnnotations);
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [onlyA11y, setOnlyA11y] = useState(false);
  const [onlyBroken, setOnlyBroken] = useState(false);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [seoKeys, setSeoKeys] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<Sort>("path");

  function persist(target: string, entry: AnnotationEntry) {
    startTransition(() => {
      void saveAnnotationAction(projectSlug, target, entry.status, entry.note ?? "");
    });
  }

  function handleStatus(target: string, status: AnnotationStatus) {
    const cur = annotations[target] ?? EMPTY;
    const entry: AnnotationEntry = {
      status: cur.status === status ? null : status,
      note: cur.note,
    };
    setAnnotations({ ...annotations, [target]: entry });
    persist(target, entry);
  }

  function handleNoteChange(target: string, note: string) {
    const cur = annotations[target] ?? EMPTY;
    setAnnotations({ ...annotations, [target]: { status: cur.status, note } });
  }

  function handleNoteCommit(target: string) {
    const cur = annotations[target] ?? EMPTY;
    const status = cur.status ?? (cur.note?.trim() ? "followup" : null);
    const entry: AnnotationEntry = { status, note: cur.note };
    setAnnotations({ ...annotations, [target]: entry });
    persist(target, entry);
  }

  const seoOptions = useMemo(() => {
    const s = new Set<string>();
    for (const p of pages) for (const item of p.seo) if (item.level !== "ok") s.add(item.key);
    return [...s].sort().map((k) => ({ label: k, value: k }));
  }, [pages]);

  const counts = useMemo(() => {
    let followup = 0;
    let done = 0;
    for (const v of Object.values(annotations)) {
      if (v.status === "followup") followup++;
      else if (v.status === "done") done++;
    }
    return { followup, done };
  }, [annotations]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const keySet = new Set(seoKeys);
    const rank = (s: AnnotationStatus | null) => (s === "followup" ? 2 : s === "done" ? 1 : 0);
    const list = pages.filter((p) => {
      if (q && !`${p.path} ${p.url} ${p.meta.title ?? ""}`.toLowerCase().includes(q)) return false;
      if (onlyA11y && p.a11y.violationCount === 0) return false;
      if (onlyBroken && p.links.broken.length === 0) return false;
      if (onlyErrors && !(p.loadError || !p.ok)) return false;
      if (keySet.size > 0 && !p.seo.some((s) => keySet.has(s.key))) return false;
      const st = annotations[p.url]?.status ?? null;
      if (statusFilter === "followup" && st !== "followup") return false;
      if (statusFilter === "done" && st !== "done") return false;
      if (statusFilter === "none" && st !== null) return false;
      return true;
    });
    return list.sort((x, y) => {
      if (sort === "a11y") return y.a11y.violationCount - x.a11y.violationCount;
      if (sort === "broken") return y.links.broken.length - x.links.broken.length;
      if (sort === "status")
        return rank(annotations[y.url]?.status ?? null) - rank(annotations[x.url]?.status ?? null);
      return x.path.localeCompare(y.path);
    });
  }, [pages, query, onlyA11y, onlyBroken, onlyErrors, seoKeys, statusFilter, sort, annotations]);

  const selectClass =
    "h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-muted-foreground" />
          <h2 className="font-heading text-lg font-semibold">Per side</h2>
        </div>
        <span className="text-sm text-muted-foreground">
          {filtered.length}/{pages.length}
        </span>
        {counts.followup > 0 && (
          <span className="inline-flex items-center gap-1 text-sm text-amber-600 dark:text-amber-500">
            <Flag className="size-3.5" />
            {counts.followup} følg opp
          </span>
        )}
        {counts.done > 0 && (
          <span className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-500">
            <Check className="size-3.5" />
            {counts.done} ferdig
          </span>
        )}
      </div>

      <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-xl bg-card/80 p-2 ring-1 ring-foreground/10 backdrop-blur">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søk i sti, URL eller tittel…"
            className="pl-8"
          />
        </div>
        <Toggle active={onlyA11y} onClick={() => setOnlyA11y((v) => !v)}>
          a11y-feil
        </Toggle>
        <Toggle active={onlyBroken} onClick={() => setOnlyBroken((v) => !v)}>
          brutte lenker
        </Toggle>
        <Toggle active={onlyErrors} onClick={() => setOnlyErrors((v) => !v)}>
          lastefeil
        </Toggle>
        <MultiSelect
          options={seoOptions}
          value={seoKeys}
          onChange={setSeoKeys}
          placeholder="SEO-nøkler"
          searchPlaceholder="Søk nøkkel…"
        />
        <select
          aria-label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className={selectClass}
        >
          <option value="all">Alle statuser</option>
          <option value="followup">Følg opp</option>
          <option value="done">Ferdig</option>
          <option value="none">Ikke vurdert</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <ArrowUpDown className="size-3.5" />
          <select
            aria-label="Sortering"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className={selectClass}
          >
            <option value="path">Sti</option>
            <option value="a11y">Flest a11y</option>
            <option value="broken">Flest brutte</option>
            <option value="status">Status</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Ingen sider matcher filteret.
        </p>
      ) : (
        <Accordion multiple className="gap-2">
          {filtered.map((p) => (
            <PageRow
              key={p.url}
              page={p}
              annotation={annotations[p.url] ?? EMPTY}
              onStatus={handleStatus}
              onNoteChange={handleNoteChange}
              onNoteCommit={handleNoteCommit}
            />
          ))}
        </Accordion>
      )}
    </section>
  );
}
