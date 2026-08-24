CREATE TABLE "member_tier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"min_points" integer NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "member_tier_key_unique" UNIQUE("key"),
	CONSTRAINT "member_tier_min_points_nonneg" CHECK ("member_tier"."min_points" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "member_tier_position_unique" ON "member_tier" USING btree ("position");--> statement-breakpoint
CREATE INDEX "point_award_user_task_idx" ON "point_award" USING btree ("user_id","task_id");--> statement-breakpoint
-- Seed the permission ladder (spec §45-49). Reference data, not sample content:
-- tierForPoints needs these thresholds to resolve a tier, so they ship with the
-- schema. Admin-editable (§46); the exact §45-47 values slot in via a settings edit.
INSERT INTO "member_tier" ("key", "name", "min_points", "position") VALUES
	('visitor', 'زائر', 0, 0),
	('general', 'عام', 100, 1),
	('special', 'خاص', 200, 2),
	('advanced', 'متقدم', 500, 3),
	('faseeli', 'فسيلي', 1000, 4);