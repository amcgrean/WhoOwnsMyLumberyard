import { parseCliArgs, writeScrape, type ScrapedLocation } from "./_base";
import { slugify } from "@/lib/slug";

/**
 * Do it Best member-store scraper.
 *
 * Do it Best exposes a public GraphQL endpoint that returns every member
 * with full lat/lng/phone/address in a single call:
 *
 *   POST https://www.doitbest.com/api/graphql
 *   { storeLocator(filter: { zipCityOrState: "10001", distance: 5000, limit: 10000 }) { … } }
 *
 * Member status values seen in production:
 *   Hardware     1,710  pure hardware stores (skipped by default — out of LBM scope)
 *   Home Center    767  hardware + housewares + some lumber
 *   Lumber         649  primary lumber yards
 *   INCOM          148  incomplete profile (skipped)
 *
 * For the Who Owns My Lumberyard mission we keep Lumber + Home Center
 * (~1,416 members) and skip pure Hardware unless --include-hardware is set.
 *
 * Each kept member is auto-created as a yard-typed company with a
 * `member_of` ownership edge to Do it Best (slug `do-it-best`).
 *
 * Run:
 *   pnpm scrape:diB                                  # default: Lumber + Home Center
 *   pnpm scrape:diB --include-hardware               # also include pure hardware
 *   pnpm scrape:diB --dry-run --limit 10             # smoke test
 */

const ENDPOINT = "https://www.doitbest.com/api/graphql";
const SOURCE_URL = "https://www.doitbest.com/find-a-store/";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

const SEED_ZIP = "10001";
const SEED_DISTANCE_MI = 5000;
const SEED_LIMIT = 10000;

const QUERY = `query GetStores($zip: String, $distance: Int, $limit: Int) {
  storeLocator(filter: { zipCityOrState: $zip, distance: $distance, limit: $limit }) {
    count
    store {
      name
      street
      city
      state
      zipcode
      lat
      lng
      phone_number
      member_number
      member_microsite_id
      member_status
    }
  }
}`;

type ApiStore = {
  name: string;
  street: string;
  city: string;
  state: string;
  zipcode: string;
  lat: string | null;
  lng: string | null;
  phone_number: string | null;
  member_number: string | null;
  member_microsite_id: string | null;
  member_status: string | null;
};

function parseExtraArgs(): { includeHardware: boolean } {
  return { includeHardware: process.argv.slice(2).includes("--include-hardware") };
}

function tidyZip(z: string | null): string | null {
  if (!z) return null;
  const m = /^(\d{5})/.exec(z.trim());
  return m ? m[1] : null;
}

function tidyPhone(p: string | null): string | null {
  if (!p) return null;
  const digits = p.replace(/[^0-9]/g, "");
  if (digits.length === 10)
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return p.trim() || null;
}

function tidyName(n: string): string {
  return n.replace(/\s+/g, " ").trim();
}

function toRow(s: ApiStore): ScrapedLocation | null {
  const name = tidyName(s.name ?? "");
  const street = (s.street ?? "").trim();
  const city = (s.city ?? "").trim();
  const state = (s.state ?? "").trim().toUpperCase();
  const zip = tidyZip(s.zipcode);
  if (!name || !street || !city || !state || !zip) return null;
  if (!/^[A-Z]{2}$/.test(state)) return null; // skip CA province / international rows

  const lat = s.lat != null ? Number(s.lat) : null;
  const lng = s.lng != null ? Number(s.lng) : null;

  const operatingCompanySlug = slugify(`${name} ${city} ${state}`);
  const operatingCompanyName = name;
  const operatingCompanyWebsite = s.member_microsite_id
    ? `https://www.doitbest.com/store/${s.member_microsite_id}`
    : undefined;

  return {
    name: `${name} – ${city}, ${state}`,
    addressLine1: street,
    city,
    state,
    zip,
    phone: tidyPhone(s.phone_number),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    sourceUrl: operatingCompanyWebsite ?? SOURCE_URL,
    operatingCompanySlug,
    operatingCompanyName,
    operatingCompanyWebsite,
  };
}

async function run() {
  const opts = parseCliArgs();
  const { includeHardware } = parseExtraArgs();

  console.log(`[diB] POST ${ENDPOINT}`);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "user-agent": USER_AGENT,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { zip: SEED_ZIP, distance: SEED_DISTANCE_MI, limit: SEED_LIMIT },
    }),
  });
  if (!res.ok) throw new Error(`Do it Best GraphQL → HTTP ${res.status}`);
  const json = (await res.json()) as {
    data?: { storeLocator?: { count: number; store: ApiStore[] } };
    errors?: Array<{ message: string }>;
  };
  if (json.errors?.length) throw new Error(`GraphQL errors: ${json.errors[0].message}`);
  const stores = json.data?.storeLocator?.store ?? [];
  console.log(`[diB] received ${stores.length} stores`);

  // Status filter
  const KEEP = new Set(["Lumber", "Home Center"]);
  if (includeHardware) KEEP.add("Hardware");

  let rows: ScrapedLocation[] = [];
  let skipped = 0;
  const byStatus = new Map<string, number>();

  for (const s of stores) {
    const status = (s.member_status ?? "").trim();
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    if (!KEEP.has(status)) {
      skipped++;
      continue;
    }
    const row = toRow(s);
    if (!row) {
      skipped++;
      continue;
    }
    rows.push(row);
  }

  console.log("[diB] member_status breakdown:");
  for (const [k, v] of [...byStatus.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${(k || "(empty)").padEnd(20)} ${v.toString().padStart(5)}`);
  }
  console.log(`[diB] kept=${rows.length}  skipped=${skipped}  (filter: ${[...KEEP].join(", ")})`);

  if (typeof opts.limit === "number") rows = rows.slice(0, opts.limit);

  await writeScrape("do-it-best", rows, opts, {
    autoCreateChildrenOf: "do-it-best",
    autoCreateRelationship: "member_of",
    autoCreateSourceUrl: SOURCE_URL,
  });
  console.log(`[diB] done`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
