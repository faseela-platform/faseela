CREATE TYPE "public"."body_kind" AS ENUM('program', 'production_body');--> statement-breakpoint
CREATE TABLE "body" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" "body_kind" NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "body_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "track_follow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_item" ADD COLUMN "body_id" uuid;--> statement-breakpoint
ALTER TABLE "submission" ADD COLUMN "content_id" uuid;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "content_scope" text;--> statement-breakpoint
ALTER TABLE "track_follow" ADD CONSTRAINT "track_follow_track_id_track_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."track"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_follow" ADD CONSTRAINT "track_follow_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "body_kind_position_idx" ON "body" USING btree ("kind","position");--> statement-breakpoint
CREATE UNIQUE INDEX "track_follow_unique" ON "track_follow" USING btree ("track_id","user_id");--> statement-breakpoint
CREATE INDEX "track_follow_user_idx" ON "track_follow" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "track_follow_track_idx" ON "track_follow" USING btree ("track_id");--> statement-breakpoint
ALTER TABLE "content_item" ADD CONSTRAINT "content_item_body_id_body_id_fk" FOREIGN KEY ("body_id") REFERENCES "public"."body"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_content_id_content_item_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- The five bodies §2 names (برامج التأهيل ثم هيئات الإنتاج). Data lives in the
-- migration like the 0003 tier seed: the table is meaningless empty, and every
-- environment needs the same rows.
INSERT INTO "body" ("name", "kind", "position") VALUES
	('المعهد التدريبي', 'program', 1),
	('كراسي المنبر الحر', 'program', 2),
	('متجر فسيلة', 'production_body', 3),
	('دار فسيلة', 'production_body', 4),
	('مركز الإنتاج الفني', 'production_body', 5)
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
-- Backfill (owner decision 2026-09-01): a Member starts out following every Track
-- they have already worked in — continuity with the implicit-follow audience the
-- notifications used until now. Work = a submission (any state) or a minted award.
INSERT INTO "track_follow" ("track_id", "user_id")
SELECT DISTINCT t."track_id", w."user_id" FROM (
	SELECT s."task_id", s."user_id" FROM "submission" s
	UNION
	SELECT p."task_id", p."user_id" FROM "point_award" p WHERE p."task_id" IS NOT NULL
) w JOIN "task" t ON t."id" = w."task_id"
ON CONFLICT DO NOTHING;
