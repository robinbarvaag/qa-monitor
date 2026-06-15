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
  error: text("error"),
});

/* ---------- web-validering (rik side-modell) ---------- */
export const page = pgTable("page", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  oldUrl: text("old_url"),
  newUrl: text("new_url"),
  sheetMeta: jsonb("sheet_meta").$type<Record<string, string>>().default({}),
});

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
    column: text("column").notNull(), // 'old' | 'new'
    httpStatus: integer("http_status"),
    loadError: text("load_error"),
    // rike detaljer som jsonb
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

/* ---------- oppfølging (lever på tvers av kjøringer) ---------- */
export const annotation = pgTable(
  "annotation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    // f.eks. "<pageId>|new" for en side, eller en finding-fingerprint
    targetKey: text("target_key").notNull(),
    status: annotationStatus("status"),
    note: text("note"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uq: uniqueIndex("annotation_target_uq").on(t.projectId, t.targetKey),
  }),
);
