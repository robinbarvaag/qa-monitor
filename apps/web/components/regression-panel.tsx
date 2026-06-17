import type { PageRegression, Regressions } from "@/lib/regressions";
import { Badge } from "@qa/ui/badge";
import { ArrowUp, CheckCircle2, ExternalLink, Sparkles, TriangleAlert } from "lucide-react";

/**
 * «Endringer siden forrige kjøring» — løfter regresjoner frem så en feil dere
 * nettopp innførte ikke sklir gjennom. Vises kun når det finnes en forrige
 * kjøring å sammenligne med.
 */

function ChangeChips({ reg, isNew }: { reg: PageRegression; isNew?: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {reg.changes.map((c) =>
        isNew ? (
          <Badge key={c.key} variant="secondary" className="tabular-nums">
            {c.label} {c.to}
          </Badge>
        ) : (
          <Badge key={c.key} variant="destructive" className="tabular-nums">
            {c.label} {c.from}→{c.to}
            <ArrowUp className="size-3" />
            {c.to - c.from}
          </Badge>
        ),
      )}
    </span>
  );
}

function PageRow({ reg, isNew }: { reg: PageRegression; isNew?: boolean }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card px-3 py-2 ring-1 ring-foreground/10">
      <a
        href={reg.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-w-0 items-center gap-1.5 font-mono text-sm hover:text-primary hover:underline"
      >
        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{reg.path}</span>
      </a>
      <ChangeChips reg={reg} isNew={isNew} />
    </li>
  );
}

export function RegressionPanel({ regressions }: { regressions: Regressions }) {
  // Ingen forrige kjøring → ingenting å sammenligne (trend-panelet melder fra).
  if (!regressions.hasPrevious) return null;

  const { worsened, newPages, improvedCount } = regressions;
  const clean = worsened.length === 0 && newPages.length === 0;

  return (
    <section className="space-y-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center gap-2">
        {clean ? (
          <CheckCircle2 className="size-4 text-emerald-500" />
        ) : (
          <TriangleAlert className="size-4 text-amber-500" />
        )}
        <h2 className="font-heading text-base font-semibold">Endringer siden forrige kjøring</h2>
        {worsened.length > 0 && (
          <Badge variant="destructive">{worsened.length} sider ble verre</Badge>
        )}
        {improvedCount > 0 && (
          <span className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-500">
            <Sparkles className="size-3.5" />
            {improvedCount} ble bedre
          </span>
        )}
      </div>

      {clean ? (
        <p className="text-sm text-muted-foreground">
          Ingenting ble verre siden forrige kjøring
          {improvedCount > 0 ? ` — og ${improvedCount} sider ble bedre 🎉` : "."}
        </p>
      ) : (
        <div className="space-y-3">
          {worsened.length > 0 && (
            <ul className="space-y-1.5">
              {worsened.slice(0, 12).map((r) => (
                <PageRow key={r.url} reg={r} />
              ))}
              {worsened.length > 12 && (
                <li className="px-1 text-xs text-muted-foreground">
                  +{worsened.length - 12} flere sider ble verre
                </li>
              )}
            </ul>
          )}

          {newPages.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Nye sider med avvik
              </p>
              <ul className="space-y-1.5">
                {newPages.slice(0, 6).map((r) => (
                  <PageRow key={r.url} reg={r} isNew />
                ))}
                {newPages.length > 6 && (
                  <li className="px-1 text-xs text-muted-foreground">
                    +{newPages.length - 6} flere nye sider
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
