"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@qa/ui/dialog";
import { Expand, ExternalLink } from "lucide-react";

export function ScreenshotViewer({ src, label }: { src: string; label: string }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            className="group/shot relative block max-h-72 w-full overflow-y-auto rounded-lg text-left ring-1 ring-foreground/10"
            title="Klikk for å forstørre"
          />
        }
      >
        <img src={src} alt={`Skjermbilde av ${label}`} loading="lazy" className="w-full" />
        <span className="pointer-events-none sticky bottom-0 flex justify-end p-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs font-medium ring-1 ring-foreground/10">
            <Expand className="size-3.5" />
            Forstørr
          </span>
        </span>
      </DialogTrigger>
      <DialogContent className="max-w-4xl gap-3">
        <DialogTitle className="truncate pr-8 font-mono text-sm">{label}</DialogTitle>
        <DialogDescription className="sr-only">Fullt skjermbilde av siden</DialogDescription>
        <div className="max-h-[78vh] overflow-y-auto rounded-lg ring-1 ring-foreground/10">
          <img src={src} alt={`Skjermbilde av ${label}`} className="w-full" />
        </div>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ExternalLink className="size-3.5" />
          Åpne i ny fane
        </a>
      </DialogContent>
    </Dialog>
  );
}
