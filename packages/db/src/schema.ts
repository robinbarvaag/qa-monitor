import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ---------- enums ---------- */
export const sourceType = pgEnum("source_type", ["web_validation", "github"]);
export const runStatus = pgEnum("run_status", ["queued", "running", "done", "error"]);
export const findingKind = pgEnum("finding_kind", [
  "a11y",
  "seo",
  "broken_link",
  "keyboard",
  "dependency_vuln",
  "other",
]);
export const severity = pgEnum("severity", ["critical", "serious", "moderate", "minor", "info"]);
export const annotationStatus = pgEnum("annotation_status", ["followup", "done"]);
export const analysisKind = pgEnum("analysis_kind", ["run_summary", "page"]);

/* ---------- kjerne ---------- */
export const project = pgTable("project", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** En pluggbar datakilde: web-validering, github/dependabot, … */
export const source = pgTable("source", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  type: sourceType("type").notNull(),
  name: text("name").notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Én utførelse av en kilde på et tidspunkt – gir historikk/trender. */
export const run = pgTable("run", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => source.id, { onDelete: "cascade" }),
  status: runStatus("status").notNull().default("queued"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  totals: jsonb("totals").$type<Record<string, number>>(),
  // kjøring-nivå ekstra: { generated, sites } (nettsted-data: robots/llms/AI-bot)
  data: jsonb("data").$type<Record<string, unknown>>(),
  error: text("error"),
});

/* ---------- web-validering (rik side-modell) ----------
 * En `page` er ÉN overvåket URL (typisk hentet fra sitemap.xml). Stabil identitet
 * på prosjektnivå, så oppfølging/trender overlever nye kjøringer.
 * Migrering (gammel→ny) modelleres som to sider som deler `pairKey`. */
export const page = pgTable(
  "page",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    label: text("label"), // valgfri visningstekst
    pairKey: text("pair_key"), // kobler ny↔gammel i migrerings-modus
    meta: jsonb("meta").$type<Record<string, string>>().default({}), // sitemap lastmod, excel-ekstra
  },
  (t) => ({
    urlUq: uniqueIndex("page_project_url_uq").on(t.projectId, t.url),
    pairIdx: index("page_pair_idx").on(t.projectId, t.pairKey),
  }),
);

export const pageResult = pgTable(
  "page_result",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => run.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => page.id, { onDelete: "cascade" }),
    httpStatus: integer("http_status"),
    loadError: text("load_error"),
    // rike detaljer som jsonb
    meta: jsonb("meta"),
    a11y: jsonb("a11y"),
    seo: jsonb("seo"),
    links: jsonb("links"),
    keyboard: jsonb("keyboard"),
    geo: jsonb("geo"),
    screenshotKey: text("screenshot_key"),
    // indekserte summer for rask filtrering/sortering uten å parse jsonb
    a11yCount: integer("a11y_count").default(0).notNull(),
    brokenCount: integer("broken_count").default(0).notNull(),
    seoFailCount: integer("seo_fail_count").default(0).notNull(),
  },
  (t) => ({
    runIdx: index("page_result_run_idx").on(t.runId),
    pageIdx: index("page_result_page_idx").on(t.pageId),
    // ett resultat per side per kjøring
    runPageUq: uniqueIndex("page_result_run_page_uq").on(t.runId, t.pageId),
  }),
);

/* ---------- generisk funn-strøm (github/dependabot m.m. skriver hit) ---------- */
export const finding = pgTable(
  "finding",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => run.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    kind: findingKind("kind").notNull(),
    severity: severity("severity").notNull().default("info"),
    subject: text("subject"), // url, pakkenavn, repo …
    // stabil id slik at annotering følger samme funn på tvers av kjøringer
    fingerprint: text("fingerprint").notNull(),
    title: text("title").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().default({}),
  },
  (t) => ({
    fpIdx: index("finding_fingerprint_idx").on(t.projectId, t.fingerprint),
  }),
);

/* ---------- AI-analyse (Fase 4) — adskilt fra deterministisk validering ----------
 * Tolkende lag oppå ferdige resultater. `kind=run_summary` har pageId=null (helhet
 * for kjøringen); `kind=page` har én rad per side. Regenereres per kjøring. */
export const analysis = pgTable(
  "analysis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => run.id, { onDelete: "cascade" }),
    pageId: uuid("page_id").references(() => page.id, { onDelete: "cascade" }), // null = kjøring-nivå
    kind: analysisKind("kind").notNull(),
    model: text("model").notNull(),
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    runIdx: index("analysis_run_idx").on(t.runId),
  }),
);

/* ---------- oppfølging (lever på tvers av kjøringer) ---------- */
export const annotation = pgTable(
  "annotation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    // stabil id: en `<pageId>`, en migrerings-`pairKey`, eller en finding-fingerprint
    targetKey: text("target_key").notNull(),
    status: annotationStatus("status"),
    note: text("note"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uq: uniqueIndex("annotation_target_uq").on(t.projectId, t.targetKey),
  }),
);
