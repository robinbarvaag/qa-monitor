"use client";

import { type ModePref, deleteProjectAction, updateProjectSettingsAction } from "@/app/actions";
import { Button } from "@qa/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@qa/ui/dialog";
import { Input } from "@qa/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@qa/ui/select";
import { Loader2, Settings, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const MODE_LABELS: Record<ModePref, string> = {
  auto: "Automatisk (anbefalt)",
  sitemap: "Tving sitemap",
  crawl: "Tving crawl",
};

export function ProjectSettingsDialog({
  slug,
  name: initialName,
  url: initialUrl,
  modePref: initialMode,
  isMigration = false,
}: {
  slug: string;
  name: string;
  url: string;
  modePref: ModePref;
  isMigration?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [url, setUrl] = useState(initialUrl);
  const [modePref, setModePref] = useState<ModePref>(initialMode);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    setError(null);
    setSaving(true);
    const res = await updateProjectSettingsAction(slug, {
      name,
      url: isMigration ? undefined : url,
      modePref: isMigration ? undefined : modePref,
    });
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function remove() {
    setDeleting(true);
    await deleteProjectAction(slug);
    router.push("/");
  }

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        aria-label="Innstillinger"
        onClick={() => setOpen(true)}
      >
        <Settings className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Innstillinger</DialogTitle>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="set-name" className="text-sm font-medium">
                Navn
              </label>
              <Input id="set-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            {!isMigration && (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="set-url" className="text-sm font-medium">
                    Sitemap- / base-URL
                  </label>
                  <Input id="set-url" value={url} onChange={(e) => setUrl(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <span className="text-sm font-medium">Modus</span>
                  <Select
                    items={MODE_LABELS}
                    value={modePref}
                    onValueChange={(v) => setModePref(v as ModePref)}
                  >
                    <SelectTrigger aria-label="Modus" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(MODE_LABELS) as ModePref[]).map((m) => (
                        <SelectItem key={m} value={m}>
                          {MODE_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Automatisk velger sitemap når den finnes, ellers crawl.
                  </p>
                </div>
              </>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Avbryt
              </Button>
              <Button size="sm" onClick={save} disabled={saving || !name.trim()}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                Lagre
              </Button>
            </div>

            <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-destructive">Faresone</p>
              <p className="text-xs text-muted-foreground">
                Sletter prosjektet og alt under det (kjøringer, sider, sjekklister, deltakere). Kan
                ikke angres.
              </p>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="destructive" onClick={remove} disabled={deleting}>
                    {deleting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    Bekreft sletting
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
                    Avbryt
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" />
                  Slett prosjekt
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
