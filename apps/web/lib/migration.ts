import "server-only";
import * as XLSX from "xlsx";

/**
 * Leser et migrerings-regneark (server-side) til gammel/ny-URL-par. Kontrakten
 * matcher Python-validatoren: kolonnene `url` (gammel) og `ny-url` (ny);
 * øvrige kolonner blir med som `extra` (lagres på siden som meta). Web parser
 * fila og sender parene som JSON i `source.config`; workeren bygger et
 * midlertidig regneark av dem og kjører validatorens Excel-modus uendret.
 */

export interface MigrationPairInput {
  old: string;
  new: string;
  pairKey: string;
  extra: Record<string, string>;
}

/** Stabil, kort nøkkel for et par — utledet fra gammel-URL, med rad-fallback. */
function pairKeyFrom(oldUrl: string, rowIndex: number): string {
  const slug = oldUrl
    .replace(/^https?:\/\//, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || `rad-${rowIndex}`;
}

export function parsePairsFromXlsx(
  buf: ArrayBuffer,
): { pairs: MigrationPairInput[] } | { error: string } {
  let rows: unknown[][];
  try {
    const wb = XLSX.read(buf, { type: "array" });
    const sheetName = wb.SheetNames[0];
    const ws = sheetName ? wb.Sheets[sheetName] : undefined;
    if (!ws) return { error: "Regnearket har ingen ark." };
    rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: false });
  } catch {
    return { error: "Klarte ikke å lese regnearket. Er det en gyldig .xlsx-fil?" };
  }

  const header = (rows[0] ?? []).map((c) => String(c ?? "").trim());
  const lower = header.map((h) => h.toLowerCase());
  const iOld = lower.indexOf("url");
  const iNew = lower.indexOf("ny-url");
  if (iOld === -1 || iNew === -1) {
    return {
      error: `Fant ikke kolonnene «url» og «ny-url». Overskrifter: ${header.join(", ") || "(tomt)"}`,
    };
  }
  const extraCols = header
    .map((name, idx) => ({ name, idx }))
    .filter((c) => c.idx !== iOld && c.idx !== iNew && c.name);

  const pairs: MigrationPairInput[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const oldUrl = String(row[iOld] ?? "").trim();
    const newUrl = String(row[iNew] ?? "").trim();
    if (!oldUrl && !newUrl) continue;
    const extra: Record<string, string> = {};
    for (const c of extraCols) extra[c.name] = String(row[c.idx] ?? "").trim();
    pairs.push({ old: oldUrl, new: newUrl, pairKey: pairKeyFrom(oldUrl || newUrl, r), extra });
  }

  if (pairs.length === 0) return { error: "Fant ingen rader med URL-er i regnearket." };
  return { pairs };
}
