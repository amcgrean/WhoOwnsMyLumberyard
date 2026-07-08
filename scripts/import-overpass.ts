import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, locations, tradeEnum } from "@/lib/db/schema";
import { locationSlug } from "@/lib/slug";

/**
 * FREE OpenStreetMap importer via the Overpass API — no key, no per-call cost,
 * ToS-clean (OSM is open data, ODbL). A drop-in alternative to the paid Google
 * Places importer: it stages businesses under the "Unverified Independent"
 * company, tagged by --trade, for `enrich-imported.ts` to promote.
 *
 * Usage:
 *   pnpm import:osm --state IA --trade plumbing
 *   pnpm import:osm --state MO --trade hvac
 *
 * Coverage is thinner than Google (OSM has fewer US business POIs and many
 * lack a full street address, which we require), but it's free. No ratings or
 * hours — those are Google-only.
 */

const TRADES = tradeEnum.enumValues as readonly string[];
// Overpass endpoint. Override with --endpoint <url> or OVERPASS_ENDPOINT to hit
// a faster mirror (e.g. https://overpass.kumi.systems/api/interpreter) when the
// default times out (504) on large states like CA/NY.
const DEFAULT_ENDPOINT = "https://overpass-api.de/api/interpreter";

// OSM craft/shop tags per trade.
const TRADE_FILTERS: Record<string, string> = {
  plumbing: `["craft"="plumber"]`,
  electrical: `["craft"="electrician"]`,
  hvac: `["craft"~"hvac|heating|air_conditioning|heating_engineer",i]`,
  lumber: `["shop"~"trade|doityourself|hardware|building_materials",i]`,
};

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const out: { state?: string; trade?: string; endpoint?: string } = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--state") out.state = args[++i];
    else if (args[i] === "--trade") out.trade = args[++i];
    else if (args[i] === "--endpoint") out.endpoint = args[++i];
  }
  if (!out.state || !out.trade) {
    console.error('usage: pnpm import:osm --state XX --trade plumbing|electrical|hvac|lumber [--endpoint <url>]');
    process.exit(1);
  }
  if (!TRADES.includes(out.trade)) {
    console.error(`--trade must be one of: ${TRADES.join(", ")}`);
    process.exit(1);
  }
  out.endpoint = out.endpoint ?? process.env.OVERPASS_ENDPOINT ?? DEFAULT_ENDPOINT;
  return out as { state: string; trade: string; endpoint: string };
}

async function ensureUnverifiedIndependent() {
  const slug = "unverified-independent";
  const existing = await db.query.companies.findFirst({ where: eq(companies.slug, slug) });
  if (existing) return existing;
  const [created] = await db
    .insert(companies)
    .values({ slug, name: "Unverified Independent", type: "yard", status: "active" })
    .returning();
  return created;
}

async function main() {
  const { state, trade, endpoint } = parseArgs();
  const filter = TRADE_FILTERS[trade];
  const query = `[out:json][timeout:90];
area["ISO3166-2"="US-${state.toUpperCase()}"][admin_level=4]->.a;
(
  nwr(area.a)${filter};
);
out center tags;`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      "user-agent": "WhoOwnsMyTradesBot/1.0 (+https://whoownsmylumberyard.com)",
    },
    body: "data=" + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { elements: OsmElement[] };
  const elements = json.elements ?? [];

  const company = await ensureUnverifiedIndependent();
  let inserted = 0;
  let skipped = 0;

  for (const el of elements) {
    const t = el.tags ?? {};
    const name = t.name;
    const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ").trim();
    const city = t["addr:city"] ?? "";
    const zip = t["addr:postcode"] ?? "";
    const stateCode = (t["addr:state"] || state).toUpperCase();
    if (!name || !street || !city || !zip) {
      skipped++;
      continue;
    }

    const lat = el.lat ?? el.center?.lat ?? null;
    const lon = el.lon ?? el.center?.lon ?? null;
    const website = t.website ?? t["contact:website"] ?? null;
    const phone = t.phone ?? t["contact:phone"] ?? null;

    const slug = locationSlug({ name, city, state: stateCode });
    const existing = await db.query.locations.findFirst({ where: eq(locations.slug, slug) });
    if (existing) {
      skipped++;
      continue;
    }

    await db.insert(locations).values({
      slug,
      companyId: company.id,
      displayName: name,
      addressLine1: street,
      city,
      state: stateCode,
      zip,
      trade: trade as typeof locations.$inferInsert.trade,
      phone,
      website,
      lat: lat != null ? lat.toFixed(6) : null,
      lng: lon != null ? lon.toFixed(6) : null,
      googleMapsUri: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      sourceUrl: website ?? `https://www.openstreetmap.org/${el.type}/${el.id}`,
      status: "open",
    });
    inserted++;
  }

  console.log(`State ${state}, trade "${trade}": ${elements.length} OSM elements · ${inserted} inserted · ${skipped} skipped`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
