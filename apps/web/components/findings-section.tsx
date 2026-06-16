"use client";

import { addGithubSourceAction, runGithubScanAction, saveAnnotationAction } from "@/app/actions";
import { FindingsAnalysis } from "@/components/findings-analysis";
import { SEVERITY_LABEL, severityBadge, severityDotClass } from "@/lib/ui-helpers";
import type {
  AnnotationMap,
  AnnotationStatus,
  FindingRow,
  FindingSeverity,
  FindingsAnalysis as FindingsAnalysisData,
  GithubConfig,
} from "@qa/db";
import { Badge } from "@qa/ui/badge";
import { Button } from "@qa/ui/button";
import { Input } from "@qa/ui/input";
import {
  Check,
  ExternalLink,
  Flag,
  GitBranch,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

const RANK: Record<FindingSeverity, number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1,
  info: 0,
};

interface FindingData {
  ghsaId?: string | null;
  cveId?: string | null;
  htmlUrl?: string | null;
  ecosystem?: string | null;
  manifestPath?: string | null;
  vulnerableRange?: string | null;
  firstPatched?: string | null;
}

function ConnectForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function connect() {
    setError(null);
    start(async () => {
      const res = await addGithubSourceAction(slug, owner, repo);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="mb-3 text-sm text-muted-foreground">
        Koble til et GitHub-repo for å lese Dependabot-varsler. Krever <code>GITHUB_TOKEN</code>{" "}
        (fine-grained PAT med «Dependabot alerts: read») i <code>.env.local</code>.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="eier (f.eks. vercel)"
          className="w-48"
        />
        <span className="text-muted-foreground">/</span>
        <Input
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          placeholder="repo (f.eks. next.js)"
          className="w-48"
        />
        <Button onClick={connect} disabled={pending || !owner.trim() || !repo.trim()} size="sm">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <GitBranch className="size-4" />}
          Koble til
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

function FindingCard({
  finding,
  status,
  onStatus,
}: {
  finding: FindingRow;
  status: AnnotationStatus | null;
  onStatus: (fingerprint: string, status: AnnotationStatus) => void;
}) {
  const d = finding.data as FindingData;
  return (
    <li className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`size-2.5 shrink-0 rounded-full ${severityDotClass(finding.severity)}`} />
        <Badge variant={severityBadge(finding.severity)}>{SEVERITY_LABEL[finding.severity]}</Badge>
        {finding.subject && (
          <code className="font-mono text-sm font-medium">{finding.subject}</code>
        )}
        {d.ecosystem && <span className="text-xs text-muted-foreground">{d.ecosystem}</span>}
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
      </div>

      <p className="mt-1.5 text-sm">{finding.title}</p>

      <dl className="mt-2 grid gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-2">
        {d.vulnerableRange && (
          <div>
            Berørt: <span className="font-mono text-foreground/80">{d.vulnerableRange}</span>
          </div>
        )}
        {d.firstPatched && (
          <div>
            Fiks: oppgrader til{" "}
            <span className="font-mono text-emerald-600 dark:text-emerald-500">
              {d.firstPatched}
            </span>
          </div>
        )}
        {d.manifestPath && (
          <div>
            Fil: <span className="font-mono text-foreground/80">{d.manifestPath}</span>
          </div>
        )}
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={status === "followup" ? "default" : "outline"}
          className={status === "followup" ? "bg-amber-500 text-white hover:bg-amber-500/90" : ""}
          onClick={() => onStatus(finding.fingerprint, "followup")}
        >
          <Flag className="size-3.5" />
          Følg opp
        </Button>
        <Button
          type="button"
          size="sm"
          variant={status === "done" ? "default" : "outline"}
          className={status === "done" ? "bg-emerald-600 text-white hover:bg-emerald-600/90" : ""}
          onClick={() => onStatus(finding.fingerprint, "done")}
        >
          <Check className="size-3.5" />
          Ferdig
        </Button>
        {d.htmlUrl && (
          <a
            href={d.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="size-3" />
            {d.ghsaId ?? d.cveId ?? "varsel"}
          </a>
        )}
      </div>
    </li>
  );
}

export function FindingsSection({
  slug,
  source,
  findings,
  initialAnnotations,
  analysis,
}: {
  slug: string;
  source: GithubConfig | null;
  findings: FindingRow[];
  initialAnnotations: AnnotationMap;
  analysis: FindingsAnalysisData | null;
}) {
  const router = useRouter();
  const [annotations, setAnnotations] = useState<AnnotationMap>(initialAnnotations);
  const [, startTransition] = useTransition();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...findings].sort((a, b) => RANK[b.severity] - RANK[a.severity]),
    [findings],
  );

  function handleStatus(fingerprint: string, status: AnnotationStatus) {
    const cur = annotations[fingerprint] ?? { status: null, note: null };
    const next = cur.status === status ? null : status;
    const entry = { status: next, note: cur.note };
    setAnnotations({ ...annotations, [fingerprint]: entry });
    startTransition(() => {
      void saveAnnotationAction(slug, fingerprint, next, cur.note ?? "");
    });
  }

  function scan() {
    setError(null);
    setScanning(true);
    startTransition(async () => {
      const res = await runGithubScanAction(slug);
      setScanning(false);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-muted-foreground" />
          <h2 className="font-heading text-lg font-semibold">Funn — Dependabot</h2>
          {source && (
            <a
              href={`https://github.com/${source.owner}/${source.repo}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-primary hover:underline"
            >
              <GitBranch className="size-3.5" />
              {source.owner}/{source.repo}
            </a>
          )}
        </div>
        {source && (
          <Button onClick={scan} disabled={scanning} size="sm" variant="outline">
            {scanning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {scanning ? "Skanner…" : "Skann Dependabot"}
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {source && sorted.length > 0 && <FindingsAnalysis slug={slug} initial={analysis} />}

      {!source ? (
        <ConnectForm slug={slug} />
      ) : sorted.length === 0 ? (
        <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          Ingen åpne Dependabot-varsler 🎉 (eller ikke skannet ennå — trykk «Skann Dependabot»).
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((f) => (
            <FindingCard
              key={f.fingerprint}
              finding={f}
              status={annotations[f.fingerprint]?.status ?? null}
              onStatus={handleStatus}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
