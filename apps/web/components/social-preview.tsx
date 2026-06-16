"use client";

import type { PageMeta, PageSocial } from "@/lib/report";
import { ImageOff, Share2 } from "lucide-react";
import { useState } from "react";

/**
 * Delingskort-forhåndsvisning (à la opengraph.xyz): hvordan siden omtrent ser ut
 * når den deles på Facebook/LinkedIn/Slack. Faller tilbake til <title> / meta
 * description når Open Graph-tagger mangler, og melder fra om hva som mangler.
 */
export function SocialPreview({
  social,
  meta,
  url,
}: {
  social: PageSocial;
  meta: PageMeta;
  url: string;
}) {
  const [imgError, setImgError] = useState(false);
  const title = social.ogTitle ?? meta.title;
  const desc = social.ogDescription ?? meta.metaDescription;
  const image = imgError ? null : social.ogImage;

  let domain = url;
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* behold rå-url */
  }

  const missing: string[] = [];
  if (!social.ogTitle) missing.push("og:title");
  if (!social.ogDescription) missing.push("og:description");
  if (!social.ogImage) missing.push("og:image");

  return (
    <div className="space-y-2 rounded-xl bg-muted/30 p-4 ring-1 ring-foreground/5">
      <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <Share2 className="size-3.5" />
        Delings-forhåndsvisning
      </div>

      <div className="max-w-md overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10">
        <div className="relative aspect-[1.91/1] bg-muted">
          {image ? (
            <img
              src={image}
              alt=""
              className="size-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
              <ImageOff className="size-6" />
              <span className="text-xs">Mangler og:image</span>
            </div>
          )}
        </div>
        <div className="space-y-0.5 p-3">
          <div className="text-[11px] tracking-wide text-muted-foreground uppercase">{domain}</div>
          <div className="line-clamp-2 text-sm font-semibold">
            {title ?? <span className="text-muted-foreground italic">(ingen tittel)</span>}
          </div>
          <div className="line-clamp-2 text-xs text-muted-foreground">
            {desc ?? <span className="italic">(ingen beskrivelse)</span>}
          </div>
        </div>
      </div>

      {missing.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Mangler <span className="font-medium text-foreground">{missing.join(", ")}</span> — fyll
          inn Open Graph-tagger for et tydeligere delingskort (her brukes{" "}
          {social.ogTitle || social.ogDescription ? "delvis " : ""}
          <code>&lt;title&gt;</code>/meta description som reserve).
        </p>
      )}
    </div>
  );
}
