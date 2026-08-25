CREATE TABLE "track_supervisor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "track_supervisor" ADD CONSTRAINT "track_supervisor_track_id_track_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."track"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_supervisor" ADD CONSTRAINT "track_supervisor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "track_supervisor_unique" ON "track_supervisor" USING btree ("track_id","user_id");--> statement-breakpoint
CREATE INDEX "track_supervisor_user_idx" ON "track_supervisor" USING btree ("user_id");