"use client";

import { getRunStatusAction, inspectSitemapAction, startRunAction } from "@/app/actions";
import type { RunMode } from "@qa/db";
import { Button } from "@qa/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@qa/ui/dialog";
import { Input } from "@qa/ui/input";
import { Skeleton } from "@qa/ui/skeleton";
import { Clock, Loader2, Play, Radar } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Info {
  hasSitemap: boolean;
  count: number;
  origin: string | null;
  estimateMinutes: number;
}

function estimateMinutes(count: number): number {
  return Math.max(1, Math.ceil((count * 5) / 60));
}

function etaText(progress: { done: number; total: number } | null, startedAt: number | null) {
  if (!progress || !startedAt || progress.done === 0) return null;
  const elapsed = (Date.now() - startedAt) / 1000;
  const rate = elapsed / progress.done;
  const remaining = Math.max(0, (progress.total - progress.done) * rate);
  return remaining < 60
    ? `~${Math.ceil(remaining)} sek igjen`
    : `~${Math.ceil(remaining / 60)} min igjen`;
}

export function RunButton({
  slug,
  migration = false,
  activeRunId = null,
  modePref = "auto",
}: {
  slug: string;
  migration?: boolean;
  activeRunId?: string | null;
  modePref?: "auto" | "sitemap" | "crawl";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [info, setInfo] = useState<Info | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [limitAll, setLimitAll] = useState(true);
  const [limitValue, setLimitValue] = useState("25");

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openDialog() {
    setOpen(true);
    setInfo(null);
    setInspectError(null);
    setInspecting(true);
    const res = await inspectSitemapAction(slug);
    setInspecting(false);
    if ("error" in res) {
      setInspectError(res.error);
      return;
    }
    setInfo(res);
    if (res.hasSitemap) {
      setLimitAll(true);
    } else {
      setLimitAll(false);
      setLimitValue("25");
    }
  }

  function confirmRun() {
    // modePref "auto" → la pre-flight bestemme; ellers tving valgt modus.
    const crawl = modePref === "auto" ? (info ? !info.hasSitemap : false) : modePref === "crawl";
    const mode: RunMode = crawl ? "crawl" : "sitemap";
    const parsed = Number.parseInt(limitValue, 10);
    const limit = !crawl && limitAll ? null : Number.isFinite(parsed) && parsed > 0 ? parsed : 25;
    setOpen(false);
    void start(limit, mode);
  }

  function pollRun(runId: string) {
    const poll = async () => {
      const st = await getRunStatusAction(runId);
      if (!st) {
        setTimeout(poll, 1500);
        return;
      }
      setProgress(st.progress);
      if (st.status === "done") {
        setRunning(false);
        setProgress(null);
        router.refresh();
      } else if (st.status === "error") {
        setRunning(false);
        setError(st.error ?? "Kjøringen feilet.");
      } else {
        setTimeout(poll, 1500);
      }
    };
    void poll();
  }

  // Gjenoppta progresjon etter refresh: hvis serveren melder en pågående kjøring,
  // start polling på nytt uten å trigge workeren igjen.
  const resumedRef = useRef<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: gjenoppta én gang per aktiv kjøring
  useEffect(() => {
    if (!activeRunId || resumedRef.current === activeRunId) return;
    resumedRef.current = activeRunId;
    setRunning(true);
    setStartedAt(Date.now());
    pollRun(activeRunId);
  }, [activeRunId]);

  /** Migrering: ingen sitemap-inspeksjon — kjør kilden som den er (mode bevares). */
  async function startMigration() {
    setError(null);
    setProgress(null);
    setRunning(true);
    setStartedAt(Date.now());
    const res = await startRunAction(slug);
    if ("error" in res) {
      setError(res.error);
      setRunning(false);
      return;
    }
    pollRun(res.runId);
  }

  async function start(limit: number | null, mode: RunMode) {
    setError(null);
    setProgress(null);
    setRunning(true);
    setStartedAt(Date.now());
    const res = await startRunAction(slug, { limit, mode });
    if ("error" in res) {
      setError(res.error);
      setRunning(false);
      return;
    }
    pollRun(res.runId);
  }

  const eta = etaText(progress, startedAt);
  const runLabel = running
    ? progress
      ? `Kjører ${progress.done}/${progress.total}`
      : "Starter…"
    : "Kjør validering";

  // estimat ved valgt grense
  const chosenCount =
    info && !info.hasSitemap
      ? Number.parseInt(limitValue, 10) || 25
      : limitAll
        ? (info?.count ?? 0)
        : Math.min(Number.parseInt(limitValue, 10) || 0, info?.count ?? Number.POSITIVE_INFINITY);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={migration ? startMigration : openDialog} disabled={running} size="sm">
        {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
        {runLabel}
      </Button>
      {running && eta && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" />
          {eta}
        </span>
      )}
      {error && <span className="max-w-56 text-right text-xs text-destructive">{error}</span>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Kjør validering</DialogTitle>

          {inspecting ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : inspectError ? (
            <p className="text-sm text-destructive">{inspectError}</p>
          ) : info?.hasSitemap ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Sitemappen har <span className="font-semibold text-foreground">{info.count}</span>{" "}
                sider.
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="limit"
                    checked={limitAll}
                    onChange={() => setLimitAll(true)}
                    className="accent-primary"
                  />
                  Alle {info.count} sider
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="limit"
                    checked={!limitAll}
                    onChange={() => setLimitAll(false)}
                    className="accent-primary"
                  />
                  Begrens til
                  <Input
                    type="number"
                    min={1}
                    value={limitValue}
                    onChange={(e) => setLimitValue(e.target.value)}
                    onFocus={() => setLimitAll(false)}
                    className="h-7 w-20"
                  />
                  sider
                </label>
              </div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3.5" />
                Anslått tid ~{estimateMinutes(chosenCount)} min ({chosenCount} sider)
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2 text-muted-foreground">
                <Radar className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <p className="min-w-0 wrap-break-word">
                  Fant ingen sitemap
                  {info?.origin ? (
                    <>
                      {" på "}
                      <span className="font-medium break-all text-foreground">{info.origin}</span>
                    </>
                  ) : null}
                  . Vi kan i stedet{" "}
                  <span className="text-foreground">traversere nettstedet fra forsiden</span> og
                  følge interne lenker (crawl).
                </p>
              </div>
              <div className="flex items-center gap-2">
                Maks
                <Input
                  type="number"
                  min={1}
                  value={limitValue}
                  onChange={(e) => setLimitValue(e.target.value)}
                  aria-label="Maks antall sider"
                  className="h-7 w-20"
                />
                sider
              </div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3.5" />
                Anslått tid ~{estimateMinutes(chosenCount)} min
              </p>
            </div>
          )}

          {!inspecting && !inspectError && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Avbryt
              </Button>
              <Button size="sm" onClick={confirmRun}>
                {info?.hasSitemap ? <Play className="size-4" /> : <Radar className="size-4" />}
                {info?.hasSitemap ? "Kjør" : "Kjør crawl"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
