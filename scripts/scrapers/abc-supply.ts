import { parseCliArgs, writeScrape, type ScrapedLocation } from "./_base";

/**
 * ABC Supply yard scraper.
 *
 * ABC Supply exposes its full locations list via an unauthenticated WP REST
 * route:
 *   GET https://www.abcsupply.com/wp-json/abcsupply-api/v1/locations
 *
 * One call returns ~718 records covering ABC Supply (storefront "abc") and a
 * small number of Canadian Building Centres (storefront "cbc"). We filter to
 * country=US and storefront in {abc} for the v1 import.
 *
 * Each record exposes lat/lng/phone/full-address. No pagination, no scraping.
 */

const ENDPOINT = "https://www.abcsupply.com/wp-json/abcsupply-api/v1/locations";
// ABC Supply's edge / WAF rejects non-browser user-agents on most page paths;
// the wp-json route is more permissive but we still send a realistic UA.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

type ApiBranch = {
  city: string;
  brand: string;
  state: string;
  address1: string;
  address2: string;
  latitude: number | null;
  longitude: number | null;
  postalCode: string;
  phoneNumber: string | null;
  faxNumber?: string | null;
  branchNumber: string;
  storefront: string; // "abc" | "cbc"
  country: string; // "US" | "CA"
  servicesOffered?: string[];
  productCategories?: string[];
  seoName?: string;
};

function tidyZip(z: string): string {
  // Some records carry ZIP+4. We keep the 5-digit form for consistency.
  const m = /^(\d{5})/.exec(z.trim());
  return m ? m[1] : z.trim();
}

function tidyServices(b: ApiBranch): string[] {
  // Combine product categories + services into the location's services array,
  // lower-cased and deduped.
  const set = new Set<string>();
  for (const v of [...(b.productCategories ?? []), ...(b.servicesOffered ?? [])]) {
    if (typeof v === "string" && v.trim()) set.add(v.trim().toLowerCase());
  }
  return [...set];
}

function toRow(b: ApiBranch): ScrapedLocation | null {
  if (b.country !== "US") return null;
  if (b.storefront !== "abc") return null; // skip CBC for now
  if (!b.address1 || !b.city || !b.state || !b.postalCode) return null;

  // ABC's API gives city already in proper case; trim only.
  const city = b.city.trim();
  const state = b.state.trim().toUpperCase();
  const zip = tidyZip(b.postalCode);

  // Display name: include branch number + city to keep slugs unique
  const branch = b.branchNumber?.trim() || "";
  const seo = b.seoName?.trim() || "";
  const name = seo
    ? `ABC Supply – ${seo}`
    : `ABC Supply – ${city}, ${state}${branch ? ` #${branch}` : ""}`;

  const lat = typeof b.latitude === "number" ? b.latitude : null;
  const lng = typeof b.longitude === "number" ? b.longitude : null;

  return {
    name,
    addressLine1: b.address1.trim(),
    addressLine2: b.address2?.trim() || null,
    city,
    state,
    zip,
    phone: b.phoneNumber?.trim() || null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    services: tidyServices(b),
    sourceUrl: `https://www.abcsupply.com/locations/${b.seoName ?? branch ?? ""}`.replace(/\/$/, ""),
  };
}

async function run() {
  const opts = parseCliArgs();
  console.log(`[abc] GET ${ENDPOINT}`);
  const res = await fetch(ENDPOINT, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`ABC Supply API → HTTP ${res.status}`);
  const branches = (await res.json()) as ApiBranch[];
  console.log(`[abc] received ${branches.length} branches`);

  let rows: ScrapedLocation[] = [];
  let skipped = 0;
  for (const b of branches) {
    const row = toRow(b);
    if (row) rows.push(row);
    else skipped++;
  }

  if (typeof opts.limit === "number") rows = rows.slice(0, opts.limit);

  console.log(`[abc] kept ${rows.length} US ABC-branded rows; skipped ${skipped}`);

  await writeScrape("abc-supply", rows, opts);
  console.log(`[abc] done`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
