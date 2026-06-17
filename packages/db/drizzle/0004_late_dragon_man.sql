CREATE TYPE "public"."checklist_discipline" AS ENUM('a11y', 'seo', 'content', 'design', 'performance', 'security');--> statement-breakpoint
CREATE TYPE "public"."checklist_source" AS ENUM('curated', 'auto', 'custom');--> statement-breakpoint
CREATE TYPE "public"."checklist_status" AS ENUM('open', 'in_progress', 'done', 'na');--> statement-breakpoint
CREATE TABLE "checklist_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"key" text NOT NULL,
	"discipline" "checklist_discipline" NOT NULL,
	"source" "checklist_source" NOT NULL,
	"title" text NOT NULL,
	"status" "checklist_status" DEFAULT 'open' NOT NULL,
	"assignee" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_item_project_key_uq" ON "checklist_item" USING btree ("project_id","key");