"use client";

import { analyzeRunAction } from "@/app/actions";
import { Button } from "@qa/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AnalyzeButton({ slug, hasAnalysis }: { slug: string; hasAnalysis: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setError(null);
    setRunning(true);
    const res = await analyzeRunAction(slug);
    setRunning(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={analyze} disabled={running} size="sm" variant="outline">
        {running ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {running ? "Analyserer…" : hasAnalysis ? "Analyser på nytt" : "Analyser med AI"}
      </Button>
      {error && <span className="max-w-56 text-right text-xs text-destructive">{error}</span>}
    </div>
  );
}
