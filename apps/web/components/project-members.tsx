"use client";

import { addMemberAction, deleteMemberAction } from "@/app/actions";
import { ROLE_BADGE, ROLE_LABELS, ROLE_ORDER, initials } from "@/lib/members";
import type { MemberRole, ProjectMember } from "@qa/db";
import { Button } from "@qa/ui/button";
import { Input } from "@qa/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@qa/ui/select";
import { Plus, Users, X } from "lucide-react";
import { useState, useTransition } from "react";

/**
 * Deltaker-register per prosjekt: hvem er med (navn + fagrolle). Brukes som
 * «ansvarlig»-valg i sjekklistene. Ikke tilgangsstyring (ingen innlogging ennå).
 */
export function ProjectMembers({
  slug,
  members: initial,
}: {
  slug: string;
  members: ProjectMember[];
}) {
  const [members, setMembers] = useState(initial);
  const [name, setName] = useState("");
  const [role, setRole] = useState<MemberRole>("developer");
  const [, startTransition] = useTransition();

  async function add() {
    const clean = name.trim();
    if (!clean) return;
    setName("");
    const res = await addMemberAction(slug, clean, role);
    if ("member" in res)
      setMembers((m) => [...m, res.member].sort((a, b) => a.name.localeCompare(b.name)));
  }

  function remove(id: string) {
    setMembers((m) => m.filter((x) => x.id !== id));
    startTransition(() => {
      void deleteMemberAction(slug, id);
    });
  }

  return (
    <section className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-center gap-2">
        <Users className="size-4 text-muted-foreground" />
        <h2 className="font-heading text-base font-semibold">Deltakere</h2>
        <span className="text-sm text-muted-foreground">{members.length}</span>
      </div>

      {members.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-2 rounded-full bg-muted/60 py-1 pr-1 pl-1.5 text-sm"
            >
              <span className="grid size-6 shrink-0 place-content-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                {initials(m.name)}
              </span>
              <span className="font-medium">{m.name}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${ROLE_BADGE[m.role]}`}
              >
                {ROLE_LABELS[m.role]}
              </span>
              <button
                type="button"
                onClick={() => remove(m.id)}
                aria-label={`Fjern ${m.name}`}
                className="grid size-5 place-content-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add();
          }}
          placeholder="Navn på deltaker…"
          className="min-w-48 flex-1"
        />
        <Select items={ROLE_LABELS} value={role} onValueChange={(v) => setRole(v as MemberRole)}>
          <SelectTrigger aria-label="Rolle" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_ORDER.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" onClick={() => void add()} disabled={!name.trim()}>
          <Plus className="size-4" />
          Legg til
        </Button>
      </div>
    </section>
  );
}
