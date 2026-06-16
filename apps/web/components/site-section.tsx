import type { ReportSite } from "@/lib/report";
import { Badge } from "@qa/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@qa/ui/card";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

function YesNo({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      {ok ? (
        <CheckCircle2 className="size-4 text-emerald-500" />
      ) : (
        <XCircle className="size-4 text-muted-foreground" />
      )}
      {label}
    </span>
  );
}

export function SiteSection({ sites }: { sites: ReportSite[] }) {
  if (sites.length === 0) return null;
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-heading text-lg font-semibold">Nettsted</h2>
        <p className="text-sm text-muted-foreground">
          robots.txt, AI-bot-tilgang, sitemaps og llms.txt per origin.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {sites.map((site) => {
          const bots = Object.entries(site.aiBots);
          return (
            <Card key={site.origin}>
              <CardHeader>
                <CardTitle className="font-mono text-sm">{site.origin}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  <YesNo ok={site.robotsExists} label="robots.txt" />
                  <YesNo ok={site.wildcardAllowed} label="Wildcard tillatt" />
                  <YesNo ok={site.llmsTxt} label="llms.txt" />
                  <YesNo ok={site.llmsFullTxt} label="llms-full.txt" />
                </div>

                {site.softFound && (
                  <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm ring-1 ring-destructive/30">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <p>
                      <span className="font-medium text-destructive">Soft 404:</span> serveren
                      svarer <span className="font-mono">200 OK</span> på sider som ikke finnes. Det
                      bør gi <span className="font-mono">404</span> — soft-404 skader SEO og skjuler
                      ekte lenkefeil (også i denne rapporten).
                    </p>
                  </div>
                )}

                {site.canonicalConflict ? (
                  <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm ring-1 ring-destructive/30">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <p>
                      <span className="font-medium text-destructive">www vs. non-www:</span> begge
                      svarer <span className="font-mono">200</span> uten å redirecte til hverandre.
                      Da finnes siden på to adresser samtidig — søkemotorer ser duplikatinnhold og
                      splitter ranking-signalene mellom dem. Velg én kanonisk vert og{" "}
                      <span className="font-mono">301</span>-redirect den andre.
                    </p>
                  </div>
                ) : (
                  site.canonicalHost && <YesNo ok label={`Kanonisk vert: ${site.canonicalHost}`} />
                )}

                {bots.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-xs font-medium text-muted-foreground uppercase">
                      AI-boter
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {bots.map(([bot, allowed]) => (
                        <Badge key={bot} variant={allowed ? "outline" : "destructive"}>
                          {bot}
                          <span className="opacity-60">{allowed ? "tillatt" : "blokkert"}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {site.sitemaps.length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Sitemaps: </span>
                    {site.sitemaps.length}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
