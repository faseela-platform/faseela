ALTER TABLE "point_award" DROP CONSTRAINT "point_award_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "anonymised_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "point_award" ADD CONSTRAINT "point_award_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;