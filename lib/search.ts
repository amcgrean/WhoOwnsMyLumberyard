import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, locations } from "@/lib/db/schema";

export type SearchResultLocation = {
  kind: "location";
  id: string;
  slug: string;
  displayName: string;
  city: string;
  state: string;
  zip: string;
};

export type SearchResultCompany = {
  kind: "company";
  id: string;
  slug: string;
  name: string;
  type: string;
  description: string | null;
};

export type SearchResult = SearchResultLocation | SearchResultCompany;

// Reusable tsvector / select expressions. Repeating ts_rank() in ORDER BY (vs
// referencing a SELECT alias) avoids a Postgres "column rank does not exist"
// error since Drizzle quotes the alias as "rank" but our raw orderBy SQL
// referenced an unquoted identifier.
const locDoc = sql`to_tsvector('english', coalesce(${locations.displayName}, '') || ' ' || coalesce(${locations.city}, '') || ' ' || coalesce(${locations.state}, '') || ' ' || coalesce(${locations.zip}, ''))`;
const compDoc = sql`to_tsvector('english', coalesce(${companies.name}, '') || ' ' || coalesce(${companies.legalName}, '') || ' ' || coalesce(${companies.description}, ''))`;

async function searchLocationsByZip(zip: string, limit: number): Promise<SearchResultLocation[]> {
  const rows = await db
    .select({
      id: locations.id,
      slug: locations.slug,
      displayName: locations.displayName,
      city: locations.city,
      state: locations.state,
      zip: locations.zip,
    })
    .from(locations)
    .where(sql`${locations.zip} = ${zip}`)
    .limit(limit);
  return rows.map((r) => ({ kind: "location", ...r }));
}

async function searchLocationsByZipPrefix(
  prefix: string,
  limit: number
): Promise<SearchResultLocation[]> {
  const rows = await db
    .select({
      id: locations.id,
      slug: locations.slug,
      displayName: locations.displayName,
      city: locations.city,
      state: locations.state,
      zip: locations.zip,
    })
    .from(locations)
    .where(sql`${locations.zip} LIKE ${prefix + "%"}`)
    .orderBy(locations.zip, locations.city)
    .limit(limit);
  return rows.map((r) => ({ kind: "location", ...r }));
}

export async function searchAll(query: string, limit = 20): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Zip-code shortcuts. Try the exact 5-digit match first; if there's nothing
  // in that exact zip, broaden to a 3-digit zip-prefix (same general area —
  // e.g. 503xx covers most of the Des Moines metro). Falls through to the
  // text search below if nothing matches at any precision.
  if (/^\d{5}$/.test(trimmed)) {
    const exact = await searchLocationsByZip(trimmed, limit);
    if (exact.length > 0) return exact;
    const prefix = await searchLocationsByZipPrefix(trimmed.slice(0, 3), limit);
    if (prefix.length > 0) return prefix;
    // fall through — try the text-search path which can match city names that
    // happen to look numeric (rare) or company names.
  }
  if (/^\d{3,4}$/.test(trimmed)) {
    const prefix = await searchLocationsByZipPrefix(trimmed, limit);
    if (prefix.length > 0) return prefix;
  }

  const tsq = sql`websearch_to_tsquery('english', ${trimmed})`;

  const locResults = await db
    .select({
      id: locations.id,
      slug: locations.slug,
      displayName: locations.displayName,
      city: locations.city,
      state: locations.state,
      zip: locations.zip,
    })
    .from(locations)
    .where(sql`${locDoc} @@ ${tsq}`)
    .orderBy(sql`ts_rank(${locDoc}, ${tsq}) DESC`)
    .limit(limit);

  const compResults = await db
    .select({
      id: companies.id,
      slug: companies.slug,
      name: companies.name,
      type: companies.type,
      description: companies.description,
    })
    .from(companies)
    .where(sql`${compDoc} @@ ${tsq}`)
    .orderBy(sql`ts_rank(${compDoc}, ${tsq}) DESC`)
    .limit(limit);

  let merged: SearchResult[] = [
    ...locResults.map((r) => ({ kind: "location" as const, ...r })),
    ...compResults.map((r) => ({ kind: "company" as const, ...r })),
  ];

  // Fallback: if FTS comes up empty (often because the query tokenizes oddly
  // — e.g. brand names with slashes like "Gilcrest/Jewett" don't always split
  // cleanly), do a case-insensitive substring match across the same columns.
  if (merged.length === 0) {
    const like = `%${trimmed}%`;
    const [locLike, compLike] = await Promise.all([
      db
        .select({
          id: locations.id,
          slug: locations.slug,
          displayName: locations.displayName,
          city: locations.city,
          state: locations.state,
          zip: locations.zip,
        })
        .from(locations)
        .where(
          sql`${locations.displayName} ILIKE ${like} OR ${locations.city} ILIKE ${like}`
        )
        .limit(limit),
      db
        .select({
          id: companies.id,
          slug: companies.slug,
          name: companies.name,
          type: companies.type,
          description: companies.description,
        })
        .from(companies)
        .where(
          sql`${companies.name} ILIKE ${like} OR ${companies.legalName} ILIKE ${like}`
        )
        .limit(limit),
    ]);
    merged = [
      ...locLike.map((r) => ({ kind: "location" as const, ...r })),
      ...compLike.map((r) => ({ kind: "company" as const, ...r })),
    ];
  }

  return merged.slice(0, limit);
}
