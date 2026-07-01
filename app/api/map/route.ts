import { NextResponse } from "next/server";
import { sql, eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, locations, ownershipEdges } from "@/lib/db/schema";

export const revalidate = 600;

/**
 * Returns a GeoJSON FeatureCollection of every geocoded location.
 *
 * Property keys are intentionally short (single-letter where unambiguous) to
 * keep the wire payload small — at 3K+ features even modest savings per row
 * add up. The map component reads them via a tiny aliasing layer.
 *
 *   slug  s  – yard slug for the detail-page link
 *   name  n  – display name for the flyout
 *   city  c  – city for the flyout subhead
 *   st    t  – two-letter state code for the flyout subhead
 *   brand b  – operating-brand name for the flyout subhead
 *   cons  x  – boolean: true if currently under a consolidator parent edge
 *   trade r  – trade (lumber/plumbing/electrical/hvac) or null, for filtering
 */
export async function GET() {
  let rows: Array<{
    slug: string;
    displayName: string;
    city: string;
    state: string;
    lat: string | null;
    lng: string | null;
    trade: string | null;
    companyId: string;
    companyName: string;
  }> = [];
  const consolidatedSet = new Set<string>();
  try {
    rows = await db
      .select({
        slug: locations.slug,
        displayName: locations.displayName,
        city: locations.city,
        state: locations.state,
        lat: locations.lat,
        lng: locations.lng,
        trade: locations.trade,
        companyId: companies.id,
        companyName: companies.name,
      })
      .from(locations)
      .innerJoin(companies, eq(locations.companyId, companies.id))
      .where(sql`${locations.lat} IS NOT NULL AND ${locations.lng} IS NOT NULL`);

    if (rows.length) {
      const edges = await db
        .select({ childId: ownershipEdges.childId })
        .from(ownershipEdges)
        .where(and(isNull(ownershipEdges.endDate)));
      for (const e of edges) consolidatedSet.add(e.childId);
    }
  } catch (err) {
    console.warn("[api/map] DB read failed", err);
  }

  const features = rows.map((r) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [Number(r.lng), Number(r.lat)],
    },
    properties: {
      s: r.slug,
      n: r.displayName,
      c: r.city,
      t: r.state,
      b: r.companyName,
      x: consolidatedSet.has(r.companyId),
      r: r.trade,
    },
  }));

  return NextResponse.json(
    { type: "FeatureCollection", features },
    {
      headers: {
        // Cache aggressively at the edge; bump revalidate when the seed/import
        // pipeline writes new yards. ISR also revalidates every 600s.
        "cache-control":
          "public, max-age=300, s-maxage=600, stale-while-revalidate=86400",
        // Hint the CDN it's compressible.
        "content-type": "application/json; charset=utf-8",
      },
    }
  );
}
