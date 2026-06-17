/**
 * Pre-flight: henter og teller URL-er i en sitemap.xml (rekursivt for
 * sitemap-index) før vi kjører validering, så UI-en kan vise størrelse +
 * anslått tid og la brukeren velge antall. Oppdager også manglende sitemap
 * (→ crawl-fallback). Ren TS, ingen Python.
 */
import "server-only";

// Grovt anslag per side (sidelast + axe + tastatur + skjermbilde).
const SECONDS_PER_PAGE = 5;
const CHILD_SITEMAP_CAP = 50;

export interface SitemapInfo {
  hasSitemap: boolean;
  count: number;
  origin: string | null;
  estimateMinutes: number;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "qa-monitor" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function locs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null = re.exec(xml);
  while (m) {
    if (m[1]) out.push(m[1]);
    m = re.exec(xml);
  }
  return out;
}

// Filendelser som ikke er nettsider – noen sitemaps lister bilder/asset-filer.
const ASSET_EXT =
  /\.(jpg|jpeg|png|gif|webp|avif|svg|ico|bmp|tiff|heic|pdf|docx?|xlsx?|pptx?|zip|rar|7z|gz|mp4|webm|mov|avi|mkv|mp3|wav|ogg|m4a|css|m?js|map|woff2?|ttf|eot)$/i;

function isAsset(url: string): boolean {
  try {
    return ASSET_EXT.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function estimate(count: number): number {
  return Math.max(1, Math.ceil((count * SECONDS_PER_PAGE) / 60));
}

export async function inspectSitemap(sitemapUrl: string): Promise<SitemapInfo> {
  let origin: string | null = null;
  try {
    origin = new URL(sitemapUrl).origin;
  } catch {
    /* ugyldig URL → origin forblir null */
  }

  const xml = await fetchText(sitemapUrl);
  if (!xml || !/<(urlset|sitemapindex)/i.test(xml)) {
    return { hasSitemap: false, count: 0, origin, estimateMinutes: 0 };
  }

  let urls: string[];
  if (/<sitemapindex/i.test(xml)) {
    const children = locs(xml).slice(0, CHILD_SITEMAP_CAP);
    const parts = await Promise.all(children.map((u) => fetchText(u)));
    urls = parts.flatMap((p) => (p ? locs(p) : []));
  } else {
    urls = locs(xml);
  }

  // Dropp asset-URL-er (bilder/PDF/…) – vi teller og validerer kun sider.
  const count = new Set(urls.filter((u) => !isAsset(u))).size;
  return { hasSitemap: true, count, origin, estimateMinutes: estimate(count) };
}
