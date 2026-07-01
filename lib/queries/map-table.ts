import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, locations, type Trade } from "@/lib/db/schema";

export type MapTableRow = {
  slug: string;
  displayName: string;
  city: string;
  state: string;
  companyName: string;
  trade: Trade | null;
  lat: string | null;
  lng: string | null;
};

export async function getMapTableRows(limit = 500): Promise<MapTableRow[]> {
  return db
    .select({
      slug: locations.slug,
      displayName: locations.displayName,
      city: locations.city,
      state: locations.state,
      companyName: companies.name,
      trade: locations.trade,
      lat: locations.lat,
      lng: locations.lng,
    })
    .from(locations)
    .innerJoin(companies, eq(locations.companyId, companies.id))
    .where(sql`${locations.lat} IS NOT NULL AND ${locations.lng} IS NOT NULL`)
    .orderBy(asc(locations.state), asc(locations.city), asc(locations.displayName))
    .limit(limit);
}
