CREATE TYPE "public"."annotation_status" AS ENUM('followup', 'done');--> statement-breakpoint
CREATE TYPE "public"."finding_kind" AS ENUM('a11y', 'seo', 'broken_link', 'keyboard', 'dependency_vuln', 'other');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('queued', 'running', 'done', 'error');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('critical', 'serious', 'moderate', 'minor', 'info');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('web_validation', 'github');--> statement-breakpoint
CREATE TABLE "annotation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"target_key" text NOT NULL,
	"status" "annotation_status",
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" "finding_kind" NOT NULL,
	"severity" "severity" DEFAULT 'info' NOT NULL,
	"subject" text,
	"fingerprint" text NOT NULL,
	"title" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "page" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"url" text NOT NULL,
	"label" text,
	"pair_key" text,
	"meta" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "page_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"http_status" integer,
	"load_error" text,
	"a11y" jsonb,
	"seo" jsonb,
	"links" jsonb,
	"keyboard" jsonb,
	"geo" jsonb,
	"screenshot_key" text,
	"a11y_count" integer DEFAULT 0 NOT NULL,
	"broken_count" integer DEFAULT 0 NOT NULL,
	"seo_fail_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"status" "run_status" DEFAULT 'queued' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"totals" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type" "source_type" NOT NULL,
	"name" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "annotation" ADD CONSTRAINT "annotation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding" ADD CONSTRAINT "finding_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding" ADD CONSTRAINT "finding_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page" ADD CONSTRAINT "page_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_result" ADD CONSTRAINT "page_result_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_result" ADD CONSTRAINT "page_result_page_id_page_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source" ADD CONSTRAINT "source_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "annotation_target_uq" ON "annotation" USING btree ("project_id","target_key");--> statement-breakpoint
CREATE INDEX "finding_fingerprint_idx" ON "finding" USING btree ("project_id","fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "page_project_url_uq" ON "page" USING btree ("project_id","url");--> statement-breakpoint
CREATE INDEX "page_pair_idx" ON "page" USING btree ("project_id","pair_key");--> statement-breakpoint
CREATE INDEX "page_result_run_idx" ON "page_result" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "page_result_page_idx" ON "page_result" USING btree ("page_id");--> statement-breakpoint
CREATE UNIQUE INDEX "page_result_run_page_uq" ON "page_result" USING btree ("run_id","page_id");