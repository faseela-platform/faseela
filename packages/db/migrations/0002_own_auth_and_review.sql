CREATE TYPE "public"."user_role" AS ENUM('member', 'editor', 'admin');--> statement-breakpoint
CREATE TYPE "public"."review_decision" AS ENUM('accepted', 'returned', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."submission_state" ADD VALUE 'draft';--> statement-breakpoint
ALTER TYPE "public"."submission_state" ADD VALUE 'cancelled';--> statement-breakpoint
CREATE TABLE "submission_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"attempt_no" integer NOT NULL,
	"body" text,
	"media_key" text,
	"submitted_at" timestamp with time zone NOT NULL,
	"decision" "review_decision",
	"review_note" text,
	"earned_points" integer,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempt_reviewed_together" CHECK (("submission_attempt"."decision" is null) = ("submission_attempt"."reviewed_at" is null) and ("submission_attempt"."decision" is null) = ("submission_attempt"."reviewed_by" is null)),
	CONSTRAINT "attempt_earned_only_on_accept" CHECK ("submission_attempt"."earned_points" is null or ("submission_attempt"."decision" = 'accepted' and "submission_attempt"."earned_points" > 0))
);
--> statement-breakpoint
ALTER TABLE "submission" DROP CONSTRAINT "submission_reviewed_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" "user_role" DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "submission_attempt" ADD CONSTRAINT "submission_attempt_submission_id_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_attempt" ADD CONSTRAINT "submission_attempt_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "submission_attempt_no_unique" ON "submission_attempt" USING btree ("submission_id","attempt_no");--> statement-breakpoint
CREATE INDEX "submission_attempt_submission_idx" ON "submission_attempt" USING btree ("submission_id");--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;