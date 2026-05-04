import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { isNull, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { locations } from "@/lib/db/schema";

/**
 * Backfill lat/lng for any locations.row where one or both coords are null.
 *
 * Uses Google Maps Geocoding API (forward geocoding). Pricing as of 2025:
 * $5/1000, with the first 10,000 calls per month free. We deliberately cap
 * each run at MAX_CALLS to keep budget predictable.
 *
 * Behavior:
 *   - Reads rows where lat IS NULL OR lng IS NULL.
 *   - Constructs a single "address1, city, state zip" query per row.
 *   - Updates the row with parsed lat/lng on a successful response.
 *   - Persists location_type and partial_match metadata in the location's
 *     services array as `geocode:rooftop` / `geocode:partial` for visibility.
 *
 * Run:
 *   pnpm geocode:missing                     # full run, default limits
 *   pnpm geocode:missing --max 100           # cap calls
 *   pnpm geocode:missing --interval 100      # ms between requests
 *   pnpm geocode:missing --dry-run           # no DB writes
 */

const ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";
const KEY = process.env.GOOGLE_PLACES_API_KEY;

type GeocodeResult = {
  status: string;
  results?: Array<{
    geometry: {
      location: { lat: number; lng: number };
      location_type: string;
    };
    partial_match?: boolean;
  }>;
};

type Opts = {
  maxCalls: number;
  intervalMs: number;
  dryRun: boolean;
};

function parseArgs(): Opts {
  const args = process.argv.slice(2);
  const o: Opts = { maxCalls: 1000, intervalMs: 80, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--max") o.maxCalls = Number(args[++i]);
    else if (args[i] === "--interval") o.intervalMs = Number(args[++i]);
    else if (args[i] === "--dry-run") o.dryRun = true;
  }
  return o;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function geocodeOne(query: string): Promise<{
  lat: number;
  lng: number;
  type: string;
  partial: boolean;
} | null> {
  const url = `${ENDPOINT}?address=${encodeURIComponent(query)}&key=${KEY}&region=us`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Geocode HTTP ${res.status}`);
  const json = (await res.json()) as GeocodeResult;
  if (json.status === "OVER_QUERY_LIMIT" || json.status === "REQUEST_DENIED") {
    throw new Error(`Geocode API status ${json.status}`);
  }
  if (json.status !== "OK" || !json.results?.length) return null;
  const r = json.results[0];
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    type: r.geometry.location_type,
    partial: Boolean(r.partial_match),
  };
}

async function main() {
  if (!KEY) throw new Error("GOOGLE_PLACES_API_KEY is not set");
  const opts = parseArgs();

  const missing = await db
    .select({
      id: locations.id,
      addressLine1: locations.addressLine1,
      city: locations.city,
      state: locations.state,
      zip: locations.zip,
      services: locations.services,
    })
    .from(locations)
    .where(sql`${locations.lat} IS NULL OR ${locations.lng} IS NULL`);
  console.log(`[geocode] ${missing.length} rows missing coords`);

  const cap = Math.min(opts.maxCalls, missing.length);
  console.log(`[geocode] capping at ${cap} calls (max=${opts.maxCalls}, interval=${opts.intervalMs}ms, dryRun=${opts.dryRun})`);

  let success = 0;
  let zeroResults = 0;
  let failed = 0;
  for (let i = 0; i < cap; i++) {
    const row = missing[i];
    const query = `${row.addressLine1}, ${row.city}, ${row.state} ${row.zip}`.trim();
    try {
      const out = await geocodeOne(query);
      if (!out) {
        zeroResults++;
      } else if (!opts.dryRun) {
        const tag = `geocode:${out.partial ? "partial" : out.type.toLowerCase()}`;
        const nextServices = Array.from(new Set([...(row.services ?? []), tag]));
        await db
          .update(locations)
          .set({
            lat: out.lat.toFixed(6),
            lng: out.lng.toFixed(6),
            services: nextServices,
            updatedAt: new Date(),
          })
          .where(eq(locations.id, row.id));
        success++;
      } else {
        success++;
      }
      if ((i + 1) % 25 === 0 || i + 1 === cap) {
        console.log(
          `[geocode] ${i + 1}/${cap}  ok=${success}  zero=${zeroResults}  failed=${failed}`
        );
      }
    } catch (err) {
      failed++;
      console.warn(`[geocode] ${query}:`, err instanceof Error ? err.message : err);
      if (failed >= 5 && success === 0) {
        throw new Error("Aborting: 5 consecutive failures with no successes — likely a key or quota issue.");
      }
    }
    await sleep(opts.intervalMs);
  }
  console.log(
    `[geocode] done — ok=${success}, zero=${zeroResults}, failed=${failed}, total=${cap}`
  );
  // Reference void for isNull import (kept for future filter variants)
  void isNull;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
