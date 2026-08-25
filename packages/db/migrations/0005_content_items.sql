CREATE TYPE "public"."content_type" AS ENUM('announcement', 'product', 'event', 'news', 'cultural', 'app_update');--> statement-breakpoint
CREATE TABLE "content_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "content_type" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"source" text,
	"track_id" uuid,
	"classification" text,
	"min_tier" text,
	"task_id" uuid,
	"media_key" text,
	"link_url" text,
	"event_at" timestamp with time zone,
	"event_place" text,
	"state" "publish_state" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_item_published_has_date" CHECK (("content_item"."state" = 'published') = ("content_item"."published_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "content_item" ADD CONSTRAINT "content_item_track_id_track_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."track"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_item" ADD CONSTRAINT "content_item_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_item" ADD CONSTRAINT "content_item_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_item_feed_idx" ON "content_item" USING btree ("state","published_at");--> statement-breakpoint
CREATE INDEX "content_item_track_idx" ON "content_item" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "content_item_type_idx" ON "content_item" USING btree ("type");