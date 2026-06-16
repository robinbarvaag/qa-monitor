"use client";

import type { ReportPage } from "@/lib/report";
import { impactBadge, impactDotClass, seoBadge, worstImpact } from "@/lib/ui-helpers";
import { Badge } from "@qa/ui/components/ui/badge";
import { Button } from "@qa/ui/components/ui/button";
import { Card } from "@qa/ui/components/ui/card";
import { Input } from "@qa/ui/components/ui/input";
import { AlertTriangle, ChevronDown, ExternalLink, Keyboard, Link2, Search } from "lucide-react";
import { useMemo, useState } from "react";

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
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function PageRow({ page }: { page: ReportPage }) {
  const [open, setOpen] = useState(false);
  const worst = worstImpact(page.a11y.byImpact);
  const broken = page.links.broken.length;

  return (
    <Card size="sm" className="gap-0 py-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className={`size-2.5 shrink-0 rounded-full ${impactDotClass(worst)}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-sm">{page.path}</span>
          {page.meta.title && (
            <span className="block truncate text-xs text-muted-foreground">{page.meta.title}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {page.loadError || !page.ok ? (
            <Badge variant="destructive">{page.httpStatus ?? "feil"}</Badge>
          ) : null}
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
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div className="border-t px-4 py-4">
          <div className="mb-4 flex items-center gap-2">
            <a
              href={page.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="size-3.5" />
              {page.url}
            </a>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <DetailBlock
              icon={<AlertTriangle className="size-3.5" />}
              title="Tilgjengelighet (axe)"
            >
              {page.a11y.violations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ingen brudd.</p>
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
        </div>
      )}
    </Card>
  );
}

export function PageExplorer({ pages }: { pages: ReportPage[] }) {
  const [query, setQuery] = useState("");
  const [onlyA11y, setOnlyA11y] = useState(false);
  const [onlyBroken, setOnlyBroken] = useState(false);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [seoKey, setSeoKey] = useState("");

  const seoKeys = useMemo(() => {
    const s = new Set<string>();
    for (const p of pages) for (const item of p.seo) s.add(item.key);
    return [...s].sort();
  }, [pages]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pages.filter((p) => {
      if (q && !`${p.path} ${p.url} ${p.meta.title ?? ""}`.toLowerCase().includes(q)) return false;
      if (onlyA11y && p.a11y.violationCount === 0) return false;
      if (onlyBroken && p.links.broken.length === 0) return false;
      if (onlyErrors && !(p.loadError || !p.ok)) return false;
      if (seoKey && !p.seo.some((s) => s.key === seoKey)) return false;
      return true;
    });
  }, [pages, query, onlyA11y, onlyBroken, onlyErrors, seoKey]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
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
          Kun a11y-feil
        </Toggle>
        <Toggle active={onlyBroken} onClick={() => setOnlyBroken((v) => !v)}>
          Kun brutte lenker
        </Toggle>
        <Toggle active={onlyErrors} onClick={() => setOnlyErrors((v) => !v)}>
          Kun lastefeil
        </Toggle>
        <select
          value={seoKey}
          onChange={(e) => setSeoKey(e.target.value)}
          className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
        >
          <option value="">Alle SEO-nøkler</option>
          {seoKeys.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-muted-foreground">
        Viser {filtered.length} av {pages.length} sider
      </p>

      <div className="space-y-2">
        {filtered.map((p) => (
          <PageRow key={p.url} page={p} />
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Ingen sider matcher filteret.
          </p>
        )}
      </div>
    </section>
  );
}
