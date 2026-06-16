/**
 * Fase 5 — GitHub/Dependabot-kilde. Henter Dependabot-varsler via REST og mapper
 * dem til @qa/db-FindingInput. Bruker en fine-grained PAT fra GITHUB_TOKEN
 * (.env.local) med «Dependabot alerts: read». Tilgangslaget byttes til en
 * GitHub App ved deploy uten å røre denne mappingen.
 */
import "server-only";
import type { FindingInput, FindingSeverity } from "@qa/db";

interface DependabotAlert {
  number: number;
  state: string;
  html_url: string;
  updated_at: string;
  dependency?: { manifest_path?: string; scope?: string };
  security_advisory?: {
    ghsa_id?: string;
    cve_id?: string | null;
    summary?: string;
    severity?: string;
  };
  security_vulnerability?: {
    severity?: string;
    vulnerable_version_range?: string;
    first_patched_version?: { identifier?: string } | null;
    package?: { ecosystem?: string; name?: string };
  };
}

function mapSeverity(s: string | undefined): FindingSeverity {
  switch ((s ?? "").toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
      return "serious";
    case "medium":
      return "moderate";
    case "low":
      return "minor";
    default:
      return "info";
  }
}

/** Henter åpne Dependabot-varsler for et repo og mapper til FindingInput[]. */
export async function fetchDependabotAlerts(owner: string, repo: string): Promise<FindingInput[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN mangler i miljøet (.env.local).");
  }

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/dependabot/alerts?state=open&per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "qa-monitor",
      },
      cache: "no-store",
    },
  );

  if (res.status === 404) {
    throw new Error(
      `Fant ikke ${owner}/${repo}, eller Dependabot er ikke aktivert / token mangler tilgang.`,
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `Ingen tilgang (${res.status}) — token trenger «Dependabot alerts: read» og tilgang til repoet.`,
    );
  }
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const alerts = (await res.json()) as DependabotAlert[];
  return alerts.map((a) => {
    const vuln = a.security_vulnerability ?? {};
    const adv = a.security_advisory ?? {};
    const pkg = vuln.package?.name ?? "ukjent pakke";
    return {
      severity: mapSeverity(vuln.severity ?? adv.severity),
      subject: pkg,
      fingerprint: `github:${owner}/${repo}:${a.number}`,
      title: adv.summary ?? `Sårbarhet i ${pkg}`,
      data: {
        ghsaId: adv.ghsa_id ?? null,
        cveId: adv.cve_id ?? null,
        htmlUrl: a.html_url,
        ecosystem: vuln.package?.ecosystem ?? null,
        manifestPath: a.dependency?.manifest_path ?? null,
        vulnerableRange: vuln.vulnerable_version_range ?? null,
        firstPatched: vuln.first_patched_version?.identifier ?? null,
        updatedAt: a.updated_at,
      },
    };
  });
}
