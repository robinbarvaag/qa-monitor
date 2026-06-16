"use client";

import { searchAction } from "@/app/actions";
import type { SearchResults } from "@qa/db";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@qa/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@qa/ui/dialog";
import { Skeleton } from "@qa/ui/skeleton";
import { FileText, LayoutGrid, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const EMPTY: SearchResults = { projects: [], pages: [] };

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  // Global ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Debounced serversøk, med request-id mot kappløp
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      const res = await searchAction(q);
      if (id === reqId.current) {
        setResults(res);
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      setResults(EMPTY);
      router.push(href);
    },
    [router],
  );

  const hasResults = results.projects.length > 0 || results.pages.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-2 rounded-lg border border-input bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Søk…</span>
        <kbd className="hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-24 max-w-xl translate-y-0 gap-0 overflow-hidden p-0"
        >
          <DialogTitle className="sr-only">Globalt søk</DialogTitle>
          <Command shouldFilter={false} className="bg-transparent">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Søk prosjekter og sider…"
            />
            <CommandList className="max-h-80">
              {loading ? (
                <div className="space-y-2 p-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Skeleton className="size-4 rounded" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ))}
                </div>
              ) : !hasResults ? (
                <CommandEmpty>
                  {query.trim().length < 2 ? "Skriv minst 2 tegn…" : "Ingen treff."}
                </CommandEmpty>
              ) : (
                <>
                  {results.projects.length > 0 && (
                    <CommandGroup heading="Prosjekter">
                      {results.projects.map((p) => (
                        <CommandItem
                          key={p.slug}
                          value={`project:${p.slug}`}
                          onSelect={() => go(`/p/${p.slug}`)}
                        >
                          <LayoutGrid className="text-muted-foreground" />
                          <span>{p.name}</span>
                          <span className="ml-auto font-mono text-xs text-muted-foreground">
                            {p.slug}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  {results.pages.length > 0 && (
                    <CommandGroup heading="Sider">
                      {results.pages.map((p) => (
                        <CommandItem
                          key={`${p.slug}:${p.url}`}
                          value={`page:${p.slug}:${p.url}`}
                          onSelect={() => go(`/p/${p.slug}`)}
                        >
                          <FileText className="text-muted-foreground" />
                          <span className="truncate font-mono text-xs">{pathOf(p.url)}</span>
                          <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                            {p.slug}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
