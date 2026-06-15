/**
 * Plattform-uavhengig blob-lagring. Bytt mellom Vercel Blob, Azure Blob
 * eller lokal disk ved å sette inn en annen adapter – resten av koden
 * bryr seg bare om dette grensesnittet.
 */
export interface BlobStore {
  put(key: string, data: Uint8Array, contentType?: string): Promise<StoredBlob>;
  get(key: string): Promise<Uint8Array | null>;
  url(key: string): Promise<string>;
  remove(key: string): Promise<void>;
}

export interface StoredBlob {
  key: string;
  url: string;
}

/** Konsistent nøkkel-skjema for skjermbilder o.l. */
export function blobKey(parts: {
  projectSlug: string;
  runId: string;
  pageId: string;
  column: "old" | "new" | "combined";
  ext?: string;
}): string {
  const ext = parts.ext ?? "jpg";
  return `${parts.projectSlug}/${parts.runId}/${parts.pageId}/${parts.column}.${ext}`;
}
