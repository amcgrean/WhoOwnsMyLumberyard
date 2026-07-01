ALTER TABLE "locations" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "google_maps_uri" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "rating" numeric(2, 1);--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "review_count" integer;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "hours" text[];