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

const EARTH_RADIUS_MI = 3958.8;

/** Closest other locations by haversine distance. Excludes the source location. */
export async function getNearbyLocations(
  source: Pick<Location, "id" | "lat" | "lng">,
  limit = 5
): Promise<Array<Location & { distanceMi: number }>> {
  if (!source.lat || !source.lng) return [];
  const lat = Number(source.lat);
  const lng = Number(source.lng);
  const rows = await db
    .select({
      l: locations,
      distanceMi: sql<number>`
        ${EARTH_RADIUS_MI} * 2 * asin(
          sqrt(
            pow(sin(radians((${locations.lat}::float - ${lat})/2)), 2)
            + cos(radians(${lat})) * cos(radians(${locations.lat}::float))
              * pow(sin(radians((${locations.lng}::float - ${lng})/2)), 2)
          )
        )
      `,
    })
    .from(locations)
    .where(
      and(ne(locations.id, source.id), sql`${locations.lat} IS NOT NULL AND ${locations.lng} IS NOT NULL`)
    )
    .orderBy(sql`"distanceMi"`)
    .limit(limit);

  return rows.map((r) => ({ ...r.l, distanceMi: r.distanceMi }));
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
