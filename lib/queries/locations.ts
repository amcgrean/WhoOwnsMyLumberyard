import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { locations } from "@/lib/db/schema";
import type { Location } from "@/lib/db/schema";

export async function getLocationBySlug(slug: string): Promise<Location | null> {
  const row = await db.query.locations.findFirst({ where: eq(locations.slug, slug) });
  return row ?? null;
}

export async function getLocationsByState(state: string, limit = 500) {
  return db.query.locations.findMany({
    where: eq(locations.state, state.toUpperCase()),
    orderBy: (l, { asc }) => [asc(l.city), asc(l.displayName)],
    limit,
  });
}

/**
 * Closest other locations by haversine distance. Excludes the source location.
 *
 * Inlines the haversine expression in ORDER BY rather than referencing the
 * SELECT alias — Postgres doesn't always resolve a quoted alias from the
 * SELECT list inside ORDER BY, and Drizzle quotes our `distanceMi` alias.
 *
 * Each numeric parameter (lat/lng) is explicitly cast to ::float8 because
 * Drizzle parameterizes JS numbers as int4 by default, which would make
 * Postgres reject 3958.8 ("invalid input syntax for type integer").
 */
export async function getNearbyLocations(
  source: Pick<Location, "id" | "lat" | "lng">,
  limit = 5
): Promise<Array<Location & { distanceMi: number }>> {
  if (!source.lat || !source.lng) return [];
  const lat = Number(source.lat);
  const lng = Number(source.lng);

  // 3958.8 is the earth radius in miles. Inlined as a float literal so
  // Postgres parses it as numeric, not int4.
  const haversine = sql<number>`
    3958.8 * 2 * asin(
      sqrt(
        pow(sin(radians((${locations.lat}::float8 - ${lat}::float8) / 2)), 2)
        + cos(radians(${lat}::float8)) * cos(radians(${locations.lat}::float8))
          * pow(sin(radians((${locations.lng}::float8 - ${lng}::float8) / 2)), 2)
      )
    )
  `;

  const rows = await db
    .select({
      l: locations,
      distanceMi: haversine,
    })
    .from(locations)
    .where(
      and(
        ne(locations.id, source.id),
        sql`${locations.lat} IS NOT NULL AND ${locations.lng} IS NOT NULL`
      )
    )
    .orderBy(sql`${haversine} ASC`)
    .limit(limit);

  return rows.map((r) => ({ ...r.l, distanceMi: Number(r.distanceMi) }));
}

export async function countLocations(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(locations);
  return row?.count ?? 0;
}

export async function countLocationsByState(state: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(locations)
    .where(eq(locations.state, state.toUpperCase()));
  return row?.count ?? 0;
}
