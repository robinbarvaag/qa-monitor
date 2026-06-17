CREATE TYPE "public"."member_role" AS ENUM('sales', 'developer', 'designer', 'pm', 'other');--> statement-breakpoint
CREATE TABLE "project_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" "member_role" DEFAULT 'other' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_item" ADD COLUMN "assignees" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_member_project_idx" ON "project_member" USING btree ("project_id");