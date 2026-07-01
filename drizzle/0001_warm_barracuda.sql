CREATE TYPE "public"."trade" AS ENUM('lumber', 'plumbing', 'electrical', 'hvac');--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "trade" "trade";--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "trade" "trade";--> statement-breakpoint
CREATE INDEX "companies_trade_idx" ON "companies" USING btree ("trade");--> statement-breakpoint
CREATE INDEX "locations_trade_idx" ON "locations" USING btree ("trade");--> statement-breakpoint
-- Backfill: the entire pre-expansion dataset is building-materials / lumber.
-- Every existing location is a lumberyard, and existing operating brands
-- (yards, consolidators) are building-materials operators. Ownership-only
-- entities (PE firms, holding companies, co-ops, public parents) stay null.
UPDATE "locations" SET "trade" = 'lumber' WHERE "trade" IS NULL;--> statement-breakpoint
UPDATE "companies" SET "trade" = 'lumber' WHERE "trade" IS NULL AND "type" IN ('yard', 'consolidator');