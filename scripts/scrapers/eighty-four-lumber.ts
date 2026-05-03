import { parseCliArgs, writeScrape, type ScrapedLocation } from "./_base";

/**
 * 84 Lumber yard scraper.
 *
 * 84 Lumber's locator is backed by an Umbraco surface controller that returns
 * every retail store in one call when given a US-center coordinate and a wide
 * radius. The endpoint:
 *
 *   GET https://www.84lumber.com/umbraco/surface/StoreSupport/StoreSearch
 *       ?radius=3000&storeId=null&latitude=39.8&longitude=-98.6
 *
 * The response body is a JSON-encoded string (double-encoded JSON) of an array
 * of store records with full lat/lng/phone/address/division.
 */

const ENDPOINT =
  "https://www.84lumber.com/umbraco/surface/StoreSupport/StoreSearch?radius=3000&storeId=null&latitude=39.8&longitude=-98.6";
const USER_AGENT =
  "Mozilla/5.0 (compatible; WhoOwnsMyLumberyardBot/1.0; +https://whoownsmylumberyard.com)";

type ApiStore = {
  StoreId: number;
  StoreNumber: number | null;
  Name: string;
  Address: string;
  City: string;
  State: string;
  Zip: string;
  Phone: string | null;
  Latitude: number;
  Longitude: number;
  IsRetailStore: boolean;
  Status: string;
  Division: string | null;
};

function tidyDivision(d: string | null): string | null {
  if (!d) return null;
  // Normalize known typos / casing
  const map: Record<string, string> = {
    SOUTHEST: "SOUTHEAST",
    "WESTERN DIVISION": "WESTERN",
    SOUTHERN: "SOUTHEAST",
  };
  const upper = d.toUpperCase().trim();
  return map[upper] ?? upper;
}

function toRow(s: ApiStore): ScrapedLocation | null {
  if (!s.Address || !s.City || !s.State || !s.Zip) return null;
  if (!s.IsRetailStore) return null;
  if (s.Status && s.Status.toLowerCase() !== "published") return null;

  const cityTitle = s.City.trim().replace(/\b\w/g, (c) => c.toUpperCase());
  const division = tidyDivision(s.Division);
  const services = division ? [`region:${division.toLowerCase().replace(/\s+/g, "-")}`] : [];

  // Display: "84 Lumber – City, ST" so the per-yard page reads cleanly.
  const name = `84 Lumber – ${cityTitle}, ${s.State.toUpperCase()}`;

  // Sanitize phone digits to standard form.
  const phoneDigits = (s.Phone ?? "").replace(/\D/g, "");
  const phone = phoneDigits.length === 10 ? `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}` : s.Phone || null;

  const storeIdParam = s.StoreNumber ?? s.StoreId;
  return {
    name,
    addressLine1: s.Address.trim(),
    city: cityTitle,
    state: s.State.toUpperCase(),
    zip: s.Zip.trim(),
    phone,
    lat: Number.isFinite(s.Latitude) ? s.Latitude : null,
    lng: Number.isFinite(s.Longitude) ? s.Longitude : null,
    services,
    sourceUrl: `https://www.84lumber.com/store-locator/store-detail?storeId=${storeIdParam}`,
  };
}

async function run() {
  const opts = parseCliArgs();

  console.log(`[84] GET ${ENDPOINT}`);
  const res = await fetch(ENDPOINT, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`84 Lumber API → HTTP ${res.status}`);

  // Response is double-encoded JSON: outer body is a JSON-quoted string whose
  // contents are the actual JSON array.
  const outer = (await res.json()) as string;
  const stores = JSON.parse(outer) as ApiStore[];
  console.log(`[84] received ${stores.length} stores`);

  let rows: ScrapedLocation[] = [];
  let skipped = 0;
  for (const s of stores) {
    const row = toRow(s);
    if (row) rows.push(row);
    else skipped++;
  }

  if (typeof opts.limit === "number") rows = rows.slice(0, opts.limit);

  // Top divisions for sanity check
  const byDivision = new Map<string, number>();
  for (const r of rows) {
    const d = r.services?.find((s) => s.startsWith("region:")) ?? "region:(unset)";
    byDivision.set(d, (byDivision.get(d) ?? 0) + 1);
  }
  console.log("[84] per-division counts:");
  for (const [k, v] of [...byDivision.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(28)} ${v.toString().padStart(4)}`);
  }

  await writeScrape("84-lumber", rows, opts);
  console.log(`[84] done — parsed=${rows.length}, skipped=${skipped}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
