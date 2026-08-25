CREATE TYPE "public"."service_request_status" AS ENUM('new', 'in_progress', 'handled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."service_request_type" AS ENUM('suggestion', 'inquiry', 'note', 'app_issue');--> statement-breakpoint
CREATE TABLE "service_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_type" "service_request_type" NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"body" text NOT NULL,
	"status" "service_request_status" DEFAULT 'new' NOT NULL,
	"user_id" text,
	"handled_by" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_request_has_contact" CHECK (("service_request"."email" is not null) or ("service_request"."phone" is not null) or ("service_request"."user_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "service_request" ADD CONSTRAINT "service_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request" ADD CONSTRAINT "service_request_handled_by_user_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_request_status_created_idx" ON "service_request" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "service_request_ip_created_idx" ON "service_request" USING btree ("ip_hash","created_at");