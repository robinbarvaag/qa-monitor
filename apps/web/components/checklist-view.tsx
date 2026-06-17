"use client";

import {
  addChecklistItemAction,
  deleteChecklistItemAction,
  setChecklistItemAction,
} from "@/app/actions";
import type { ChecklistGroup, ChecklistUiItem } from "@/lib/checklist";
import { initials } from "@/lib/members";
import type { ChecklistDiscipline, ChecklistStatus, ProjectMember } from "@qa/db";
import { Badge } from "@qa/ui/badge";
import { Button } from "@qa/ui/button";
import { Input } from "@qa/ui/input";
import { MultiSelect } from "@qa/ui/multi-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@qa/ui/select";
import { Textarea } from "@qa/ui/textarea";
import {
  Accessibility,
  ChevronDown,
  FileText,
  Gauge,
  GraduationCap,
  Palette,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ComponentType } from "react";

const STATUS_LABELS: Record<ChecklistStatus, string> = {
  open: "Åpen",
  in_progress: "Pågår",
  done: "Ferdig",
  na: "Ikke relevant",
};
const STATUS_ACCENT: Record<ChecklistStatus, string> = {
  open: "border-l-foreground/15",
  in_progress: "border-l-amber-400",
  done: "border-l-emerald-500",
  na: "border-l-foreground/20",
};
const ICONS: Record<ChecklistDiscipline, ComponentType<{ className?: string }>> = {
  a11y: Accessibility,
  design: Palette,
  content: FileText,
  seo: Search,
  performance: Gauge,
  security: ShieldCheck,
};

interface Override {
  status: ChecklistStatus;
  assignees: string[];
  note: string | null;
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {done}/{total}
      </span>
    </div>
  );
}

function Avatars({ ids, byId }: { ids: string[]; byId: Map<string, ProjectMember> }) {
  const present = ids.map((id) => byId.get(id)).filter((m): m is ProjectMember => Boolean(m));
  if (present.length === 0) return null;
  const shown = present.slice(0, 3);
  const extra = present.length - shown.length;
  return (
    <span className="flex items-center -space-x-1.5">
      {shown.map((m) => (
        <span
          key={m.id}
          title={m.name}
          className="grid size-6 place-content-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary ring-2 ring-card"
        >
          {initials(m.name)}
        </span>
      ))}
      {extra > 0 && (
        <span className="grid size-6 place-content-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card">
          +{extra}
        </span>
      )}
    </span>
  );
}

export function ChecklistView({
  groups,
  slug,
  members,
}: {
  groups: ChecklistGroup[];
  slug: string;
  members: ProjectMember[];
}) {
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const memberOptions = useMemo(
    () => members.map((m) => ({ label: m.name, value: m.id })),
    [members],
  );

  function eff(item: ChecklistUiItem): Override {
    return (
      overrides[item.key] ?? {
        status: item.status,
        assignees: item.assignees,
        note: item.note,
      }
    );
  }

  function persist(item: ChecklistUiItem, patch: Partial<Override>) {
    const next = { ...eff(item), ...patch };
    setOverrides((o) => ({ ...o, [item.key]: next }));
    void setChecklistItemAction(slug, {
      key: item.key,
      discipline: item.discipline,
      source: item.source,
      title: item.title,
      status: next.status,
      assignees: next.assignees,
      note: next.note?.trim() ? next.note.trim() : null,
    });
  }

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function addCustom(discipline: ChecklistDiscipline) {
    const title = (drafts[discipline] ?? "").trim();
    if (!title) return;
    setDrafts((d) => ({ ...d, [discipline]: "" }));
    await addChecklistItemAction(slug, discipline, title);
  }

  async function remove(key: string) {
    await deleteChecklistItemAction(slug, key);
  }

  const liveGroups = useMemo(
    () =>
      groups.map((g) => {
        const done = g.items.filter((i) => {
          const s = overrides[i.key]?.status ?? i.status;
          return s === "done" || s === "na";
        }).length;
        return { ...g, done };
      }),
    [groups, overrides],
  );

  return (
    <div className="space-y-8">
      {liveGroups.map((group) => {
        const Icon = ICONS[group.discipline];
        return (
          <section key={group.discipline} className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="grid size-7 place-content-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="size-4" />
              </div>
              <h2 className="font-heading text-lg font-semibold">{group.label}</h2>
              <ProgressBar done={group.done} total={group.total} />
            </div>

            <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
              {group.items.map((item, idx) => {
                const e = eff(item);
                const isOpen = expanded.has(item.key);
                return (
                  <div
                    key={item.key}
                    className={`border-l-2 bg-card ${STATUS_ACCENT[e.status]} ${
                      idx > 0 ? "border-t border-t-foreground/8" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 px-3 py-2">
                      <Select
                        items={STATUS_LABELS}
                        value={e.status}
                        onValueChange={(v) => persist(item, { status: v as ChecklistStatus })}
                      >
                        <SelectTrigger size="sm" aria-label="Status" className="w-32 shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(STATUS_LABELS) as ChecklistStatus[]).map((k) => (
                            <SelectItem key={k} value={k}>
                              {STATUS_LABELS[k]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <button
                        type="button"
                        onClick={() => toggle(item.key)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span
                          className={`truncate text-sm font-medium ${
                            e.status === "done"
                              ? "text-muted-foreground line-through"
                              : e.status === "na"
                                ? "text-muted-foreground"
                                : ""
                          }`}
                        >
                          {item.title}
                        </span>
                        {item.source === "auto" && (
                          <Badge
                            variant="outline"
                            className="shrink-0 border-primary/40 text-primary"
                          >
                            auto
                          </Badge>
                        )}
                        {item.source === "custom" && (
                          <Badge variant="outline" className="shrink-0">
                            egen
                          </Badge>
                        )}
                      </button>

                      <Avatars ids={e.assignees} byId={memberById} />

                      <button
                        type="button"
                        onClick={() => toggle(item.key)}
                        aria-label={isOpen ? "Lukk" : "Åpne"}
                        className="grid size-7 shrink-0 place-content-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <ChevronDown
                          className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                    </div>

                    {isOpen && (
                      <div className="space-y-3 border-t border-t-foreground/8 px-3 pt-3 pb-4">
                        {item.source === "curated" && (
                          <div className="space-y-1.5 rounded-lg bg-muted/40 p-3 text-sm">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                              <GraduationCap className="size-3.5" />
                              Lær
                            </div>
                            <p>
                              <span className="font-semibold">Hvorfor: </span>
                              <span className="text-muted-foreground">{item.why}</span>
                            </p>
                            <p>
                              <span className="font-semibold">Hvordan: </span>
                              <span className="text-muted-foreground">{item.how}</span>
                            </p>
                            {item.ref && (
                              <a
                                href={item.ref.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block text-xs text-primary hover:underline"
                              >
                                {item.ref.label} ↗
                              </a>
                            )}
                          </div>
                        )}
                        {item.source === "auto" &&
                          item.affectedPaths &&
                          item.affectedPaths.length > 0 && (
                            <ul className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg bg-muted/40 p-3 font-mono text-xs text-muted-foreground">
                              {item.affectedPaths.slice(0, 50).map((p) => (
                                <li key={p} className="truncate">
                                  {p}
                                </li>
                              ))}
                            </ul>
                          )}

                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">
                              Ansvarlig
                            </span>
                            {members.length > 0 ? (
                              <MultiSelect
                                options={memberOptions}
                                value={e.assignees}
                                onChange={(vals) => persist(item, { assignees: vals })}
                                placeholder="Velg ansvarlige…"
                                searchPlaceholder="Søk deltaker…"
                              />
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Legg til deltakere øverst for å kunne tildele.
                              </p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">Notat</span>
                            <Textarea
                              defaultValue={e.note ?? ""}
                              onBlur={(ev) => persist(item, { note: ev.target.value })}
                              placeholder="Notat …"
                              className="min-h-9 resize-y"
                            />
                          </div>
                        </div>

                        {item.source === "custom" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => remove(item.key)}
                          >
                            <Trash2 className="size-4" />
                            Slett post
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <Input
                value={drafts[group.discipline] ?? ""}
                onChange={(ev) => setDrafts((d) => ({ ...d, [group.discipline]: ev.target.value }))}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") void addCustom(group.discipline);
                }}
                placeholder={`Legg til egen post i ${group.label.toLowerCase()}…`}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void addCustom(group.discipline)}
                disabled={!(drafts[group.discipline] ?? "").trim()}
              >
                <Plus className="size-4" />
                Legg til
              </Button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
