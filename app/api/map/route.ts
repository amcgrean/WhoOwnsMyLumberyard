import { NextResponse } from "next/server";
import { sql, eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, locations } from "@/lib/db/schema";
import { ownershipSelect, kindFromRow } from "@/lib/ownership-sql";

// Depends on the ?state= query param, so it must not be statically cached.
// We still cache aggressively at the edge via cache-control below (the CDN
// keys on the full URL, so each state gets its own cached payload).
export const dynamic = "force-dynamic";

/**
 * Returns a GeoJSON FeatureCollection of geocoded locations, optionally scoped
 * to a single state via `?state=IA`. Scoping keeps the payload small — the
 * national set is ~15K features (~4 MB); a single state is a fraction of that,
 * which is why the map defaults to one state.
 *
 * Property keys are intentionally short to keep the wire payload small:
 *   slug   s  – yard slug for the detail-page link
 *   name   n  – display name
 *   city   c  – city
 *   st     t  – two-letter state code
 *   brand  b  – operating-brand (company) name
 *   owner  o  – immediate ownership parent's name, or null
 *   fran.  f  – national brand it's a franchisee of, or null
 *   trade  r  – trade (lumber/plumbing/electrical/hvac) or null
 *   kind   k  – ownership badge kind (see lib/ownership-kind.ts), classified
 *               server-side by walking the full ownership chain
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stateParam = searchParams.get("state");
  const state = stateParam && /^[A-Za-z]{2}$/.test(stateParam) ? stateParam.toUpperCase() : null;

  const features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: Record<string, string | null>;
  }> = [];

  try {
    const geocoded = sql`${locations.lat} IS NOT NULL AND ${locations.lng} IS NOT NULL`;
    const rows = await db
      .select({
        slug: locations.slug,
        displayName: locations.displayName,
        city: locations.city,
        state: locations.state,
        lat: locations.lat,
        lng: locations.lng,
        trade: locations.trade,
        companyName: companies.name,
        companySlug: companies.slug,
        companyType: companies.type,
        ...ownershipSelect(companies.id),
      })
      .from(locations)
      .innerJoin(companies, eq(locations.companyId, companies.id))
      .where(state ? and(geocoded, eq(locations.state, state)) : geocoded);

    for (const r of rows) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [Number(r.lng), Number(r.lat)] },
        properties: {
          s: r.slug,
          n: r.displayName,
          c: r.city,
          t: r.state,
          b: r.companyName,
          o: r.ownerName,
          f: r.franchiseOf,
          r: r.trade,
          k: kindFromRow(r),
        },
      });
    }
  } catch (err) {
    console.warn("[api/map] DB read failed", err);
  }

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
