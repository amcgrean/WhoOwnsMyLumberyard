CREATE TYPE "public"."claim_subject_type" AS ENUM('ownership_edge', 'acquisition', 'company', 'location');--> statement-breakpoint
CREATE TYPE "public"."company_status" AS ENUM('active', 'acquired', 'defunct');--> statement-breakpoint
CREATE TYPE "public"."company_type" AS ENUM('yard', 'consolidator', 'pe_firm', 'public_company', 'coop', 'holding_company', 'family_office');--> statement-breakpoint
CREATE TYPE "public"."location_status" AS ENUM('open', 'closed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."ownership_relationship" AS ENUM('owns', 'controls', 'member_of', 'franchise_of', 'subsidiary_of');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending', 'approved', 'rejected', 'merged');--> statement-breakpoint
CREATE TABLE "acquisitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"acquirer_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"announced_date" date,
	"closed_date" date,
	"deal_value_usd" bigint,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"subject_type" "claim_subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"quote" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claim_sources_unique" UNIQUE("source_id","subject_type","subject_id")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"type" "company_type" NOT NULL,
	"founded_year" integer,
	"headquarters_city" text,
	"headquarters_state" text,
	"website" text,
	"ticker" text,
	"description" text,
	"notes" text,
	"logo_url" text,
	"status" "company_status" DEFAULT 'active' NOT NULL,
	"search_vector" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"company_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"address_line_1" text NOT NULL,
	"address_line_2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"zip" text NOT NULL,
	"lat" numeric(9, 6),
	"lng" numeric(9, 6),
	"phone" text,
	"google_place_id" text,
	"services" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"status" "location_status" DEFAULT 'open' NOT NULL,
	"source_url" text,
	"search_vector" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ownership_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"stake_pct" numeric(5, 2),
	"relationship" "ownership_relationship" DEFAULT 'owns' NOT NULL,
	"start_date" date,
	"end_date" date,
	"note" text,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ownership_no_self_edge" CHECK ("ownership_edges"."parent_id" <> "ownership_edges"."child_id")
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"company_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"archive_url" text,
	"title" text,
	"publication" text,
	"published_date" date,
	"accessed_date" date DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submitter_email" text NOT NULL,
	"subject_type" text,
	"subject_id" uuid,
	"claim" text NOT NULL,
	"source_url" text NOT NULL,
	"notes" text,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"reviewer_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "acquisitions" ADD CONSTRAINT "acquisitions_acquirer_id_companies_id_fk" FOREIGN KEY ("acquirer_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acquisitions" ADD CONSTRAINT "acquisitions_target_id_companies_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_sources" ADD CONSTRAINT "claim_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_edges" ADD CONSTRAINT "ownership_edges_parent_id_companies_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_edges" ADD CONSTRAINT "ownership_edges_child_id_companies_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "acquisitions_slug_idx" ON "acquisitions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "acquisitions_acquirer_idx" ON "acquisitions" USING btree ("acquirer_id");--> statement-breakpoint
CREATE INDEX "acquisitions_target_idx" ON "acquisitions" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "claim_sources_subject_idx" ON "claim_sources" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_slug_idx" ON "companies" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "companies_type_idx" ON "companies" USING btree ("type");--> statement-breakpoint
CREATE INDEX "companies_state_idx" ON "companies" USING btree ("headquarters_state");--> statement-breakpoint
CREATE INDEX "companies_search_vector_idx" ON "companies" USING gin ((to_tsvector('english', coalesce("name", '') || ' ' || coalesce("legal_name", '') || ' ' || coalesce("description", ''))));--> statement-breakpoint
CREATE UNIQUE INDEX "locations_slug_idx" ON "locations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "locations_google_place_id_idx" ON "locations" USING btree ("google_place_id");--> statement-breakpoint
CREATE INDEX "locations_company_idx" ON "locations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "locations_state_city_idx" ON "locations" USING btree ("state","city");--> statement-breakpoint
CREATE INDEX "locations_zip_idx" ON "locations" USING btree ("zip");--> statement-breakpoint
CREATE INDEX "locations_search_vector_idx" ON "locations" USING gin ((to_tsvector('english', coalesce("display_name", '') || ' ' || coalesce("city", '') || ' ' || coalesce("state", '') || ' ' || coalesce("zip", ''))));--> statement-breakpoint
CREATE INDEX "ownership_edges_child_end_idx" ON "ownership_edges" USING btree ("child_id","end_date");--> statement-breakpoint
CREATE INDEX "ownership_edges_parent_idx" ON "ownership_edges" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "people_company_idx" ON "people" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_url_idx" ON "sources" USING btree ("url");