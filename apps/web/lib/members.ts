import type { MemberRole } from "@qa/db";

/** Norske etiketter + visuell stil for fagroller (delt mellom deltaker-UI og sjekkliste). */
export const ROLE_LABELS: Record<MemberRole, string> = {
  sales: "Selger",
  pm: "Prosjektleder",
  designer: "Designer",
  developer: "Utvikler",
  other: "Annet",
};

export const ROLE_ORDER: MemberRole[] = ["sales", "pm", "designer", "developer", "other"];

export const ROLE_BADGE: Record<MemberRole, string> = {
  sales: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  pm: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  designer: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
  developer: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  other: "bg-muted text-muted-foreground",
};

/** Initialer (maks 2) for avatar-chip. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}
