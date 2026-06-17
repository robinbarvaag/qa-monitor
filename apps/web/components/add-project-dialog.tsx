"use client";

import { addMigrationProjectAction, addProjectAction } from "@/app/actions";
import { Button } from "@qa/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@qa/ui/dialog";
import { Input } from "@qa/ui/input";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Kind = "sitemap" | "migration";

export function AddProjectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("sitemap");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      let res: { slug: string } | { error: string };
      if (kind === "migration") {
        if (!file) {
          setError("Last opp en .xlsx-fil.");
          return;
        }
        const fd = new FormData();
        fd.append("name", name);
        fd.append("file", file);
        res = await addMigrationProjectAction(fd);
      } else {
        res = await addProjectAction(name, url);
      }
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.push(`/p/${res.slug}`);
    });
  }

  const canSubmit =
    !pending && name.trim() !== "" && (kind === "sitemap" ? url.trim() !== "" : file !== null);

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
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant={kind === "sitemap" ? "default" : "outline"}
                onClick={() => setKind("sitemap")}
              >
                Sitemap
              </Button>
              <Button
                type="button"
                size="sm"
                variant={kind === "migration" ? "default" : "outline"}
                onClick={() => setKind("migration")}
              >
                Migrering (Excel)
              </Button>
            </div>

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

            {kind === "sitemap" ? (
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
            ) : (
              <div className="space-y-1.5">
                <label htmlFor="proj-file" className="text-sm font-medium">
                  Excel-ark (.xlsx)
                </label>
                <Input
                  id="proj-file"
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">
                  Kolonner <span className="font-mono">url</span> (gammel) og{" "}
                  <span className="font-mono">ny-url</span>. Hver rad blir et par som valideres og
                  vises gammel mot ny.
                </p>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Avbryt
              </Button>
              <Button size="sm" onClick={submit} disabled={!canSubmit}>
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
