/**
 * Beacon Building Products scraper.
 *
 * After QXO acquired Beacon (April 2025), the site at qxo.com/find-a-store
 * drives its location data from a plain REST endpoint:
 *
 *   GET https://beacon-ng.becn.com/v1/store-location
 *       ?lat=<lat>&long=<lng>&range=<miles>
 *
 * The endpoint hard-caps results at 30 per call, so we sweep the continental
 * US, Alaska, and Hawaii with a grid of center points (spacing ~200 mi,
 * radius 150 mi — guarantees every point is covered). De-dupe by `key`
 * (Beacon's internal branch number).
 *
 * Sub-brands (e.g. "HEARTLAND A QXO COMPANY") get their own operating-company
 * row auto-created as a Beacon subsidiary.  Plain "QXO"-branded branches fall
 * directly under the "beacon" seed company.
 *
 * Run:
 *   pnpm scrape:beacon                        # full sweep ~250 API calls
 *   pnpm scrape:beacon --dry-run --limit 5    # smoke-test (5 locations)
 */

import { parseCliArgs, writeScrape, RateLimiter, type ScrapedLocation } from "./_base";

const API_BASE = "https://beacon-ng.becn.com/v1/store-location";
const LOCATOR_URL = "https://www.qxo.com/find-a-store";
const RANGE_MILES = 150;

// ─── Grid points ─────────────────────────────────────────────────────────────
//
// Continental US:
//   lat  25 – 49 step 2.5° (≈172 mi)
//   lng -125 – -67 step 3.0° (≈165 mi at 39°N; safe at all latitudes)
//
// With radius=150 mi and step≤173 mi the farthest any location can be from the
// nearest grid centre is ≤sqrt(86²+83²)≈120 mi < 150 mi — complete coverage.

function buildGrid(): Array<{ lat: number; lng: number }> {
  const pts: Array<{ lat: number; lng: number }> = [];

  // Continental US
  for (let lat = 25; lat <= 49.5; lat += 2.5) {
    for (let lng = -125; lng <= -66.5; lng += 3.0) {
      pts.push({ lat: +lat.toFixed(2), lng: +lng.toFixed(2) });
    }
  }

  // Alaska
  for (const p of [
    { lat: 58.5, lng: -136.0 },
    { lat: 61.0, lng: -149.0 },
    { lat: 64.5, lng: -147.0 },
    { lat: 64.5, lng: -165.0 },
    { lat: 60.0, lng: -162.0 },
  ]) pts.push(p);

  // Hawaii
  for (const p of [
    { lat: 21.3, lng: -157.8 },
    { lat: 20.8, lng: -156.3 },
    { lat: 19.7, lng: -155.1 },
  ]) pts.push(p);

  return pts;
}

// ─── API response types ───────────────────────────────────────────────────────

interface ApiStoreLocation {
  key: string;
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalcode: string;
  latitude: number;
  longitude: number;
  phone?: string;
  branchname?: string;
  url?: string;
  country?: string;
}

interface ApiItem {
  storeLocation: ApiStoreLocation;
  distance: number;
}

interface ApiResponse {
  items: ApiItem[];
  error: string | null;
}

// ─── Brand normalisation ──────────────────────────────────────────────────────
//
// Beacon uses several sub-brand names in the `branchname` field.
// "QXO" is the default (maps directly to the beacon consolidator).
// "HEARTLAND A QXO COMPANY" and similar patterns are legacy regional brands.

function parseBranchName(branchname: string | undefined): {
  operatingCompanySlug?: string;
  operatingCompanyName?: string;
} {
  if (!branchname) return {};
  const clean = branchname.trim().toUpperCase();

  // Plain QXO brand → falls back to the beacon consolidator slug
  if (clean === "QXO") return {};

  // "HEARTLAND A QXO COMPANY" → sub-brand "Heartland"
  const qxoMatch = clean.match(/^(.+?)\s+A\s+QXO\s+COMPANY$/);
  if (qxoMatch) {
    const raw = qxoMatch[1].trim();
    // Title-case the brand name (e.g. "HEARTLAND" → "Heartland")
    const name = raw.charAt(0) + raw.slice(1).toLowerCase();
    const slug = "beacon-" + name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    return { operatingCompanySlug: slug, operatingCompanyName: name };
  }

  // Unknown pattern — title-case and prefix with "beacon-"
  const name = branchname.trim().replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
  const slug = "beacon-" + name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return { operatingCompanySlug: slug, operatingCompanyName: name };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function fetchGrid(
  lat: number,
  lng: number
): Promise<ApiItem[]> {
  const url = `${API_BASE}?lat=${lat}&long=${lng}&range=${RANGE_MILES}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      Origin: "https://www.qxo.com",
      Referer: "https://www.qxo.com/find-a-store",
    },
  });
  if (!res.ok) {
    console.warn(`[beacon] ${lat},${lng} → HTTP ${res.status}`);
    return [];
  }
  const data = (await res.json()) as ApiResponse;
  if (data.error) {
    console.warn(`[beacon] ${lat},${lng} → API error: ${data.error}`);
    return [];
  }
  return data.items ?? [];
}

async function run() {
  const opts = parseCliArgs();
  const limiter = new RateLimiter(opts.minIntervalMs ?? 500);
  const grid = buildGrid();

  const rowsByKey = new Map<string, ScrapedLocation>();
  let apiCalls = 0;

  console.log(`[beacon] sweeping ${grid.length} grid points, radius=${RANGE_MILES} mi`);

  for (const { lat, lng } of grid) {
    await limiter.wait();
    const items = await fetchGrid(lat, lng);
    apiCalls++;

    for (const { storeLocation: s } of items) {
      if (rowsByKey.has(s.key)) continue;
      if (s.country && s.country.toUpperCase() !== "UNITED STATES") continue;

      // Normalise zip: strip the +4 suffix
      const zip = (s.postalcode ?? "").replace(/^(\d{5}).*$/, "$1");
      if (!/^\d{5}$/.test(zip)) continue;

      const { operatingCompanySlug, operatingCompanyName } = parseBranchName(s.branchname);

      const row: ScrapedLocation = {
        name: s.name.trim(),
        addressLine1: s.addressLine1.trim(),
        addressLine2: s.addressLine2?.trim() || null,
        city: s.city.trim(),
        state: s.state.trim().toUpperCase(),
        zip,
        phone: s.phone?.trim() || null,
        lat: typeof s.latitude === "number" && Number.isFinite(s.latitude) ? s.latitude : null,
        lng:
          typeof s.longitude === "number" && Number.isFinite(s.longitude) ? s.longitude : null,
        sourceUrl: s.url?.trim() || LOCATOR_URL,
        ...(operatingCompanySlug ? { operatingCompanySlug, operatingCompanyName } : {}),
      };

      rowsByKey.set(s.key, row);
    }

    if (apiCalls % 50 === 0) {
      console.log(`[beacon] ${apiCalls}/${grid.length} calls, ${rowsByKey.size} unique locations so far`);
    }

    // Honour --limit during sweep (for smoke tests)
    if (typeof opts.limit === "number" && rowsByKey.size >= opts.limit) break;
  }

  console.log(`[beacon] done — ${apiCalls} API calls, ${rowsByKey.size} unique locations`);

  let rows = [...rowsByKey.values()];
  if (typeof opts.limit === "number") rows = rows.slice(0, opts.limit);

  await writeScrape("beacon", rows, opts, {
    autoCreateChildrenOf: "beacon",
    autoCreateRelationship: "subsidiary_of",
    autoCreateSourceUrl: LOCATOR_URL,
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
