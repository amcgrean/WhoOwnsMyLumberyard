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

export async function searchAll(query: string, limit = 20): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Try zip-code shortcut: a 5-digit query lands directly on locations by zip.
  if (/^\d{5}$/.test(trimmed)) {
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
      .where(sql`${locations.zip} = ${trimmed}`)
      .limit(limit);
    return rows.map((r) => ({ kind: "location", ...r }));
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
      rank: sql<number>`ts_rank(to_tsvector('english', coalesce(${locations.displayName}, '') || ' ' || coalesce(${locations.city}, '') || ' ' || coalesce(${locations.state}, '') || ' ' || coalesce(${locations.zip}, '')), ${tsq})`,
    })
    .from(locations)
    .where(
      sql`to_tsvector('english', coalesce(${locations.displayName}, '') || ' ' || coalesce(${locations.city}, '') || ' ' || coalesce(${locations.state}, '') || ' ' || coalesce(${locations.zip}, '')) @@ ${tsq}`
    )
    .orderBy(sql`rank DESC`)
    .limit(limit);

  const compResults = await db
    .select({
      id: companies.id,
      slug: companies.slug,
      name: companies.name,
      type: companies.type,
      description: companies.description,
      rank: sql<number>`ts_rank(to_tsvector('english', coalesce(${companies.name}, '') || ' ' || coalesce(${companies.legalName}, '') || ' ' || coalesce(${companies.description}, '')), ${tsq})`,
    })
    .from(companies)
    .where(
      sql`to_tsvector('english', coalesce(${companies.name}, '') || ' ' || coalesce(${companies.legalName}, '') || ' ' || coalesce(${companies.description}, '')) @@ ${tsq}`
    )
    .orderBy(sql`rank DESC`)
    .limit(limit);

  const merged: SearchResult[] = [
    ...locResults.map((r) => ({
      kind: "location" as const,
      id: r.id,
      slug: r.slug,
      displayName: r.displayName,
      city: r.city,
      state: r.state,
      zip: r.zip,
    })),
    ...compResults.map((r) => ({
      kind: "company" as const,
      id: r.id,
      slug: r.slug,
      name: r.name,
      type: r.type,
      description: r.description,
    })),
  ];

  return merged.slice(0, limit);
}
