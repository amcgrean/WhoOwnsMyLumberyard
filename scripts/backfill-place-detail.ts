import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { and, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { locations } from "@/lib/db/schema";

/**
 * Backfill Google Places detail (website, rating, review count, hours, maps
 * link) for locations imported before those fields existed. Only touches rows
 * that have a google_place_id and no rating yet, so it's safe to re-run and
 * costs one Place Details call per un-backfilled business.
 *
 * Flags: --limit N, --concurrency N (default 8).
 */

const PLACES_KEY = process.env.MAPS_API ?? process.env.GOOGLE_PLACES_API_KEY;

function parseArgs() {
  const args = process.argv.slice(2);
  let limit = Infinity;
  let concurrency = 8;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit") limit = Number(args[++i]);
    else if (args[i] === "--concurrency") concurrency = Number(args[++i]);
  }
  return { limit, concurrency };
}

type Detail = {
  websiteUri?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
};

async function fetchDetail(placeId: string): Promise<Detail | null> {
  if (!PLACES_KEY) throw new Error("MAPS_API is not set");
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "x-goog-api-key": PLACES_KEY,
      "x-goog-fieldmask":
        "websiteUri,googleMapsUri,rating,userRatingCount,regularOpeningHours.weekdayDescriptions",
    },
  });
  if (!res.ok) return null;
  return (await res.json()) as Detail;
}

async function main() {
  const { limit, concurrency } = parseArgs();

  const rows = await db
    .select({
      id: locations.id,
      placeId: locations.googlePlaceId,
      website: locations.website,
    })
    .from(locations)
    .where(and(isNotNull(locations.googlePlaceId), isNull(locations.rating)));

  const todo = rows.slice(0, limit === Infinity ? rows.length : limit);
  console.log(`${rows.length} locations need detail; backfilling ${todo.length}…`);

  let updated = 0;
  let processed = 0;
  let idx = 0;
  async function worker() {
    while (idx < todo.length) {
      const loc = todo[idx++];
      processed++;
      if (processed % 200 === 0) console.log(`  …${processed}/${todo.length}`);
      const d = await fetchDetail(loc.placeId!);
      if (!d) continue;
      await db
        .update(locations)
        .set({
          website: loc.website ?? d.websiteUri ?? null,
          googleMapsUri: d.googleMapsUri ?? null,
          rating: typeof d.rating === "number" ? d.rating.toFixed(1) : null,
          reviewCount: d.userRatingCount ?? null,
          hours: d.regularOpeningHours?.weekdayDescriptions ?? null,
          updatedAt: new Date(),
        })
        .where(sql`${locations.id} = ${loc.id}`);
      updated++;
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));

  console.log(`\nDone. Updated ${updated}/${todo.length}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
