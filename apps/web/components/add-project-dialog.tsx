"use client";

import { addProjectAction } from "@/app/actions";
import { Button } from "@qa/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@qa/ui/dialog";
import { Input } from "@qa/ui/input";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function AddProjectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const res = await addProjectAction(name, url);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.push(`/p/${res.slug}`);
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Legg til nettsted
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Legg til nettsted</DialogTitle>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="proj-name" className="text-sm font-medium">
                Navn
              </label>
              <Input
                id="proj-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="f.eks. Digdir"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="proj-url" className="text-sm font-medium">
                Sitemap-URL
              </label>
              <Input
                id="proj-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.digdir.no/sitemap.xml"
              />
              <p className="text-xs text-muted-foreground">
                Finnes ingen sitemap? Det er greit — oppgi den vanlige adressen likevel, så kan du
                crawle nettstedet fra forsiden når du kjører.
              </p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Avbryt
              </Button>
              <Button size="sm" onClick={submit} disabled={pending || !name.trim() || !url.trim()}>
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Opprett
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
