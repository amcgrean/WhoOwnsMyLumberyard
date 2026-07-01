import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ──────────────────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────────────────

export const companyTypeEnum = pgEnum("company_type", [
  "yard",
  "consolidator",
  "pe_firm",
  "public_company",
  "coop",
  "holding_company",
  "family_office",
]);

export const companyStatusEnum = pgEnum("company_status", [
  "active",
  "acquired",
  "defunct",
]);

// The trade / sector a company or physical location operates in. Applies to
// operating brands and their locations; ownership entities (PE firms, holding
// companies, co-ops) leave this null. `lumber` covers the original
// building-materials scope; the rest are the skilled-trade expansion.
export const tradeEnum = pgEnum("trade", [
  "lumber",
  "plumbing",
  "electrical",
  "hvac",
]);

export const locationStatusEnum = pgEnum("location_status", [
  "open",
  "closed",
  "unknown",
]);

export const relationshipEnum = pgEnum("ownership_relationship", [
  "owns",
  "controls",
  "member_of",
  "franchise_of",
  "subsidiary_of",
]);

export const claimSubjectEnum = pgEnum("claim_subject_type", [
  "ownership_edge",
  "acquisition",
  "company",
  "location",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "approved",
  "rejected",
  "merged",
]);

// ──────────────────────────────────────────────────────────────────────────
// Companies
// ──────────────────────────────────────────────────────────────────────────

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    type: companyTypeEnum("type").notNull(),
    // Primary trade for operating brands (null for PE firms, holding
    // companies, co-ops, and other pure ownership entities).
    trade: tradeEnum("trade"),
    foundedYear: integer("founded_year"),
    headquartersCity: text("headquarters_city"),
    headquartersState: text("headquarters_state"),
    website: text("website"),
    ticker: text("ticker"),
    description: text("description"),
    notes: text("notes"),
    logoUrl: text("logo_url"),
    // Social profile URLs (facebook, instagram, x, youtube, linkedin, tiktok),
    // populated by the website-scrape enrichment.
    socials: text("socials").array().notNull().default(sql`ARRAY[]::text[]`),
    status: companyStatusEnum("status").notNull().default("active"),
    // Generated tsvector kept in sync by Postgres
    searchVector: text("search_vector"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("companies_slug_idx").on(t.slug),
    index("companies_type_idx").on(t.type),
    index("companies_trade_idx").on(t.trade),
    index("companies_state_idx").on(t.headquartersState),
    index("companies_search_vector_idx").using("gin", sql`(to_tsvector('english', coalesce(${t.name}, '') || ' ' || coalesce(${t.legalName}, '') || ' ' || coalesce(${t.description}, '')))`),
  ]
);

// ──────────────────────────────────────────────────────────────────────────
// Locations
// ──────────────────────────────────────────────────────────────────────────

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    displayName: text("display_name").notNull(),
    // Trade this physical location operates in. Denormalized from the owning
    // company for fast per-trade map/search filtering.
    trade: tradeEnum("trade"),
    addressLine1: text("address_line_1").notNull(),
    addressLine2: text("address_line_2"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    zip: text("zip").notNull(),
    lat: numeric("lat", { precision: 9, scale: 6 }),
    lng: numeric("lng", { precision: 9, scale: 6 }),
    phone: text("phone"),
    googlePlaceId: text("google_place_id"),
    services: text("services").array().notNull().default(sql`ARRAY[]::text[]`),
    status: locationStatusEnum("status").notNull().default("open"),
    sourceUrl: text("source_url"),
    searchVector: text("search_vector"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("locations_slug_idx").on(t.slug),
    uniqueIndex("locations_google_place_id_idx").on(t.googlePlaceId),
    index("locations_company_idx").on(t.companyId),
    index("locations_trade_idx").on(t.trade),
    index("locations_state_city_idx").on(t.state, t.city),
    index("locations_zip_idx").on(t.zip),
    index("locations_search_vector_idx").using("gin", sql`(to_tsvector('english', coalesce(${t.displayName}, '') || ' ' || coalesce(${t.city}, '') || ' ' || coalesce(${t.state}, '') || ' ' || coalesce(${t.zip}, '')))`),
  ]
);

// ──────────────────────────────────────────────────────────────────────────
// Ownership edges (directed graph: parent -> child)
// ──────────────────────────────────────────────────────────────────────────

export const ownershipEdges = pgTable(
  "ownership_edges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parentId: uuid("parent_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    childId: uuid("child_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    stakePct: numeric("stake_pct", { precision: 5, scale: 2 }),
    relationship: relationshipEnum("relationship").notNull().default("owns"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    note: text("note"),
    verified: boolean("verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("ownership_no_self_edge", sql`${t.parentId} <> ${t.childId}`),
    index("ownership_edges_child_end_idx").on(t.childId, t.endDate),
    index("ownership_edges_parent_idx").on(t.parentId),
  ]
);

// ──────────────────────────────────────────────────────────────────────────
// Acquisitions (discrete deal events)
// ──────────────────────────────────────────────────────────────────────────

export const acquisitions = pgTable(
  "acquisitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    acquirerId: uuid("acquirer_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    announcedDate: date("announced_date"),
    closedDate: date("closed_date"),
    dealValueUsd: bigint("deal_value_usd", { mode: "bigint" }),
    summary: text("summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("acquisitions_slug_idx").on(t.slug),
    index("acquisitions_acquirer_idx").on(t.acquirerId),
    index("acquisitions_target_idx").on(t.targetId),
  ]
);

// ──────────────────────────────────────────────────────────────────────────
// People (founders, family owners, key execs — only when story-relevant)
// ──────────────────────────────────────────────────────────────────────────

export const people = pgTable(
  "people",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    role: text("role"),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("people_company_idx").on(t.companyId)]
);

// ──────────────────────────────────────────────────────────────────────────
// Sources
// ──────────────────────────────────────────────────────────────────────────

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    url: text("url").notNull(),
    archiveUrl: text("archive_url"),
    title: text("title"),
    publication: text("publication"),
    publishedDate: date("published_date"),
    accessedDate: date("accessed_date").notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sources_url_idx").on(t.url)]
);

// ──────────────────────────────────────────────────────────────────────────
// Claim sources (polymorphic join: claim X is supported by source Y)
// ──────────────────────────────────────────────────────────────────────────

export const claimSources = pgTable(
  "claim_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    subjectType: claimSubjectEnum("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    quote: text("quote"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("claim_sources_subject_idx").on(t.subjectType, t.subjectId),
    unique("claim_sources_unique").on(t.sourceId, t.subjectType, t.subjectId),
  ]
);

// ──────────────────────────────────────────────────────────────────────────
// Submissions (user-submitted corrections / tips)
// ──────────────────────────────────────────────────────────────────────────

export const submissions = pgTable("submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  submitterEmail: text("submitter_email").notNull(),
  subjectType: text("subject_type"),
  subjectId: uuid("subject_id"),
  claim: text("claim").notNull(),
  sourceUrl: text("source_url").notNull(),
  notes: text("notes"),
  status: submissionStatusEnum("status").notNull().default("pending"),
  reviewerNote: text("reviewer_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ──────────────────────────────────────────────────────────────────────────
// Inferred types
// ──────────────────────────────────────────────────────────────────────────

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
export type OwnershipEdge = typeof ownershipEdges.$inferSelect;
export type NewOwnershipEdge = typeof ownershipEdges.$inferInsert;
export type Acquisition = typeof acquisitions.$inferSelect;
export type NewAcquisition = typeof acquisitions.$inferInsert;
export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type ClaimSource = typeof claimSources.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
export type CompanyType = (typeof companyTypeEnum.enumValues)[number];
export type Trade = (typeof tradeEnum.enumValues)[number];
export type LocationStatus = (typeof locationStatusEnum.enumValues)[number];
export type Relationship = (typeof relationshipEnum.enumValues)[number];
