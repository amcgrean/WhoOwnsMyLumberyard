import { NextResponse } from "next/server";
import { sql, eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, locations } from "@/lib/db/schema";

// Depends on the ?state= query param, so it must not be statically cached.
// We still cache aggressively at the edge via cache-control below (the CDN
// keys on the full URL, so each state gets its own cached payload).
export const dynamic = "force-dynamic";

/**
 * Returns a GeoJSON FeatureCollection of geocoded locations, optionally scoped
 * to a single state via `?state=IA`. Scoping keeps the payload small — the
 * national set is ~8K features (~1 MB); a single state is a fraction of that,
 * which is why the map defaults to one state.
 *
 * Property keys are intentionally short to keep the wire payload small:
 *   slug   s  – yard slug for the detail-page link
 *   name   n  – display name
 *   city   c  – city
 *   st     t  – two-letter state code
 *   brand  b  – operating-brand (company) name
 *   owner  o  – ultimate ownership parent name, or null when independent
 *   trade  r  – trade (lumber/plumbing/electrical/hvac) or null
 *
 * The single payload drives both the map pins and the results list, so `o`
 * (present ⇒ consolidator/PE-owned) doubles as the red/green pin signal.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stateParam = searchParams.get("state");
  const state = stateParam && /^[A-Za-z]{2}$/.test(stateParam) ? stateParam.toUpperCase() : null;

  let rows: Array<{
    slug: string;
    displayName: string;
    city: string;
    state: string;
    lat: string | null;
    lng: string | null;
    trade: string | null;
    companyName: string;
    ownerName: string | null;
  }> = [];

  try {
    const geocoded = sql`${locations.lat} IS NOT NULL AND ${locations.lng} IS NOT NULL`;
    rows = await db
      .select({
        slug: locations.slug,
        displayName: locations.displayName,
        city: locations.city,
        state: locations.state,
        lat: locations.lat,
        lng: locations.lng,
        trade: locations.trade,
        companyName: companies.name,
        // ownerName: the operating company's current (active) ownership parent,
        // excluding co-op membership (member_of is not ownership).
        ownerName: sql<string | null>`(
          select p.name from ownership_edges e
          join companies p on p.id = e.parent_id
          where e.child_id = ${companies.id} and e.end_date is null
            and e.relationship <> 'member_of'
          order by e.start_date desc nulls last
          limit 1
        )`,
      })
      .from(locations)
      .innerJoin(companies, eq(locations.companyId, companies.id))
      .where(state ? and(geocoded, eq(locations.state, state)) : geocoded);
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
      o: r.ownerName,
      r: r.trade,
    },
  }));

  return NextResponse.json(
    { type: "FeatureCollection", features },
    {
      headers: {
        "cache-control":
          "public, max-age=300, s-maxage=600, stale-while-revalidate=86400",
        "content-type": "application/json; charset=utf-8",
      },
    }
  );
}
