import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, locations } from "@/lib/db/schema";
import { locationSlug } from "@/lib/slug";

/**
 * Google Places Text Search-based importer.
 *
 * Usage:
 *   pnpm import:places --state IA --query "lumber yard"
 *
 * For each result, upserts a location attached to the
 * "Unverified Independent" company. The operator reviews these and reassigns
 * the company_id to the correct operating brand.
 *
 * Note: Text Search returns up to 60 results per query (3 pages of 20).
 * For state-wide coverage you typically run multiple queries with different
 * keywords ("lumber yard", "building materials", "lumberyard supplier", etc.).
 */

const PLACES_KEY = process.env.MAPS_API ?? process.env.GOOGLE_PLACES_API_KEY;
const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

type Place = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  internationalPhoneNumber?: string;
  location?: { latitude: number; longitude: number };
  addressComponents?: Array<{
    longText: string;
    shortText: string;
    types: string[];
  }>;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const out: { state?: string; query?: string } = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--state") out.state = args[++i];
    else if (args[i] === "--query") out.query = args[++i];
  }
  if (!out.state || !out.query) {
    console.error("usage: pnpm import:places --state XX --query \"lumber yard\"");
    process.exit(1);
  }
  return out as { state: string; query: string };
}

function pickComponent(p: Place, type: string) {
  return p.addressComponents?.find((c) => c.types.includes(type))?.longText ?? "";
}

async function ensureUnverifiedIndependent() {
  const slug = "unverified-independent";
  const existing = await db.query.companies.findFirst({ where: eq(companies.slug, slug) });
  if (existing) return existing;
  const [created] = await db
    .insert(companies)
    .values({
      slug,
      name: "Unverified Independent",
      type: "yard",
      status: "active",
    })
    .returning();
  return created;
}

async function searchPage(query: string, pageToken?: string): Promise<{ places: Place[]; nextPageToken?: string }> {
  if (!PLACES_KEY) throw new Error("MAPS_API (or GOOGLE_PLACES_API_KEY) is not set");
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": PLACES_KEY,
      "x-goog-fieldmask":
        "places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress,places.internationalPhoneNumber,places.location,places.addressComponents,nextPageToken",
    },
    body: JSON.stringify({
      textQuery: query,
      pageToken,
      languageCode: "en",
      regionCode: "us",
    }),
  });
  if (!res.ok) {
    throw new Error(`Places API error ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  return { places: json.places ?? [], nextPageToken: json.nextPageToken };
}

async function main() {
  const { state, query } = parseArgs();
  const company = await ensureUnverifiedIndependent();
  const fullQuery = `${query} in ${state}`;

  const all: Place[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 3; page++) {
    const { places, nextPageToken } = await searchPage(fullQuery, pageToken);
    all.push(...places);
    if (!nextPageToken) break;
    pageToken = nextPageToken;
    // Token activation needs ~2s
    await new Promise((r) => setTimeout(r, 2500));
  }

  let inserted = 0;
  let skipped = 0;
  for (const p of all) {
    const name = p.displayName?.text ?? "";
    if (!name) {
      skipped++;
      continue;
    }
    const street = `${pickComponent(p, "street_number")} ${pickComponent(p, "route")}`.trim();
    const city = pickComponent(p, "locality") || pickComponent(p, "postal_town");
    const stateCode = p.addressComponents?.find((c) => c.types.includes("administrative_area_level_1"))?.shortText ?? "";
    const zip = pickComponent(p, "postal_code");

    if (!street || !city || !stateCode || !zip) {
      skipped++;
      continue;
    }

    const dedupe = await db.query.locations.findFirst({
      where: eq(locations.googlePlaceId, p.id),
    });
    if (dedupe) {
      skipped++;
      continue;
    }

    const slug = locationSlug({ name, city, state: stateCode });
    const existingSlug = await db.query.locations.findFirst({
      where: and(eq(locations.companyId, company.id), eq(locations.slug, slug)),
    });
    if (existingSlug) {
      skipped++;
      continue;
    }

    await db.insert(locations).values({
      slug,
      companyId: company.id,
      displayName: name,
      addressLine1: street,
      city,
      state: stateCode.toUpperCase(),
      zip,
      phone: p.internationalPhoneNumber ?? null,
      lat: p.location ? p.location.latitude.toFixed(6) : null,
      lng: p.location ? p.location.longitude.toFixed(6) : null,
      googlePlaceId: p.id,
      sourceUrl: `https://www.google.com/maps/place/?q=place_id:${p.id}`,
      status: "open",
    });
    inserted++;
  }

  console.log(`State ${state}, query "${query}": ${all.length} results · ${inserted} inserted · ${skipped} skipped`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
