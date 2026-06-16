"use client";

import { getRunStatusAction, startRunAction } from "@/app/actions";
import { Button } from "@qa/ui/button";
import { Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RunButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setProgress(null);
    setRunning(true);
    const res = await startRunAction(slug);
    if ("error" in res) {
      setError(res.error);
      setRunning(false);
      return;
    }
    const runId = res.runId;

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
    setTimeout(poll, 1500);
  }

  const label = running
    ? progress
      ? `Kjører ${progress.done}/${progress.total}`
      : "Kjører…"
    : "Kjør validering";

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={start} disabled={running} size="sm">
        {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
        {label}
      </Button>
      {error && <span className="max-w-48 text-right text-xs text-destructive">{error}</span>}
    </div>
  );
}
