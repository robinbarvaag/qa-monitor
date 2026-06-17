import type {
  ChecklistDiscipline,
  ChecklistSource,
  ChecklistState,
  ChecklistStatus,
  FindingRow,
} from "@qa/db";
import { CATALOG } from "./checklist-catalog";
import { deriveAutoItems } from "./checklist-derive";
import type { Report } from "./report";

/**
 * Slår sammen de tre kildene til én visningsmodell per fagområde:
 *   kurert katalog (kode) + auto-poster (siste kjøring) + egne poster (DB).
 * Lagret state (status/ansvarlig/notat) legges på per `key`. Ren funksjon.
 */

export interface ChecklistUiItem {
  key: string;
  discipline: ChecklistDiscipline;
  source: ChecklistSource;
  title: string;
  status: ChecklistStatus;
  assignees: string[];
  note: string | null;
  // kurert: opplæring
  why?: string;
  how?: string;
  ref?: { label: string; url: string };
  // auto: berørte sider
  affectedPaths?: string[];
}

export interface ChecklistGroup {
  discipline: ChecklistDiscipline;
  label: string;
  done: number;
  total: number;
  items: ChecklistUiItem[];
}

export interface ChecklistData {
  groups: ChecklistGroup[];
  done: number;
  total: number;
}

/** Rekkefølge + norske etiketter for fagområdene. */
export const DISCIPLINES: { key: ChecklistDiscipline; label: string }[] = [
  { key: "a11y", label: "Tilgjengelighet" },
  { key: "design", label: "Design" },
  { key: "content", label: "Innhold" },
  { key: "seo", label: "SEO" },
  { key: "performance", label: "Ytelse" },
  { key: "security", label: "Sikkerhet" },
];

const isDone = (s: ChecklistStatus) => s === "done" || s === "na";

export function buildChecklist(
  report: Report | null,
  findings: FindingRow[],
  state: ChecklistState,
): ChecklistData {
  const items: ChecklistUiItem[] = [];

  // 1) Kurert katalog (alltid med); state legges på om den finnes.
  for (const c of CATALOG) {
    const st = state[c.key];
    items.push({
      key: c.key,
      discipline: c.discipline,
      source: "curated",
      title: c.title,
      status: st?.status ?? "open",
      assignees: st?.assignees ?? [],
      note: st?.note ?? null,
      why: c.why,
      how: c.how,
      ref: c.ref,
    });
  }

  // 2) Auto-poster fra siste kjøring + funn; state legges på.
  for (const a of deriveAutoItems(report, findings)) {
    const st = state[a.key];
    items.push({
      key: a.key,
      discipline: a.discipline,
      source: "auto",
      title: a.title,
      status: st?.status ?? "open",
      assignees: st?.assignees ?? [],
      note: st?.note ?? null,
      affectedPaths: a.affectedPaths,
    });
  }

  // 3) Egne poster (state-rader med source=custom).
  for (const [key, st] of Object.entries(state)) {
    if (st.source !== "custom") continue;
    items.push({
      key,
      discipline: st.discipline,
      source: "custom",
      title: st.title,
      status: st.status,
      assignees: st.assignees,
      note: st.note,
    });
  }

  const groups: ChecklistGroup[] = DISCIPLINES.map(({ key, label }) => {
    const groupItems = items.filter((i) => i.discipline === key);
    const done = groupItems.filter((i) => isDone(i.status)).length;
    return { discipline: key, label, items: groupItems, done, total: groupItems.length };
  });

  return {
    groups,
    done: groups.reduce((n, g) => n + g.done, 0),
    total: groups.reduce((n, g) => n + g.total, 0),
  };
}
