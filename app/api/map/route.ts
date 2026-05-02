import { NextResponse } from "next/server";
import { sql, eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, locations, ownershipEdges } from "@/lib/db/schema";

export const revalidate = 600;

/**
 * Returns a GeoJSON FeatureCollection of every geocoded location, with the
 * minimum properties needed to render a clustered map and a flyout card.
 */
export async function GET() {
  // Pull each location with its operating company
  const rows = await db
    .select({
      id: locations.id,
      slug: locations.slug,
      displayName: locations.displayName,
      city: locations.city,
      state: locations.state,
      lat: locations.lat,
      lng: locations.lng,
      companyId: companies.id,
      companyName: companies.name,
      companyType: companies.type,
    })
    .from(locations)
    .innerJoin(companies, eq(locations.companyId, companies.id))
    .where(sql`${locations.lat} IS NOT NULL AND ${locations.lng} IS NOT NULL`);

  // Mark which operating companies have an active parent edge → "consolidated"
  const operatingIds = [...new Set(rows.map((r) => r.companyId))];
  const consolidatedSet = new Set<string>();
  if (operatingIds.length) {
    const edges = await db
      .select({ childId: ownershipEdges.childId })
      .from(ownershipEdges)
      .where(and(isNull(ownershipEdges.endDate)));
    for (const e of edges) consolidatedSet.add(e.childId);
  }

  const features = rows.map((r) => ({
    type: "Feature" as const,
    id: r.id,
    geometry: {
      type: "Point" as const,
      coordinates: [Number(r.lng), Number(r.lat)],
    },
    properties: {
      slug: r.slug,
      name: r.displayName,
      city: r.city,
      state: r.state,
      companyName: r.companyName,
      consolidated: consolidatedSet.has(r.companyId),
    },
  }));

  return NextResponse.json(
    { type: "FeatureCollection", features },
    { headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=86400" } }
  );
}
