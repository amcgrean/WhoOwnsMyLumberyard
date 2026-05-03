import {
  parseCliArgs,
  writeScrape,
  type ScrapedLocation,
} from "./_base";

/**
 * Carter Lumber yard scraper.
 *
 * Carter Lumber's locator is a Vue app backed by a public dotCMS API:
 *   POST https://www.carterlumber.com/api/content/_search
 *   body: {"query":"+contentType:Location","sort":"modDate","limit":-1}
 *
 * The response includes lat/lng/phone/address for every active branch across
 * Carter's family of companies. Each row's storeType1 enum tells us which
 * brand the location operates under; we map that to the matching seeded
 * operating-company slug so the importer can split rows across brands.
 *
 * One request, no rate limiting needed.
 *
 * Run:
 *   pnpm tsx --env-file=.env.local scripts/scrapers/carter-lumber.ts
 */

const ENDPOINT = "https://www.carterlumber.com/api/content/_search";

type CarterStoreType = { [code: string]: string };

type CarterContentlet = {
  storeName: string;
  storeType1?: CarterStoreType[];
  addressLines: string;
  city: string;
  state: string;
  zip: string;
  phoneNumber?: string;
  latitude?: number | string;
  longitude?: number | string;
  identifier: string;
};

type CarterResponse = {
  entity: { jsonObjectView: { contentlets: CarterContentlet[] } };
};

/**
 * Map a Carter storeType1 code to the operating-company slug seeded in the
 * database. All Carter sub-formats (K&B, Components, Custom Millwork) collapse
 * back to the brand they operate under.
 */
function brandSlugFor(storeType: CarterContentlet["storeType1"]): string {
  if (!storeType || storeType.length === 0) return "carter-lumber";
  const code = Object.keys(storeType[0])[0];
  switch (code) {
    case "h":
    case "hcm":
    case "hcomp":
    case "hkb":
      return "holmes-lumber";
    case "k":
    case "kcm":
    case "kcomp":
    case "kkb":
      return "kempsville-building-materials";
    case "K-1":
    case "kicomp":
    case "kikb":
    case "kki":
      return "kight-home-center";
    case "townsend":
    case "tkb":
      return "townsend-building-supply";
    // cl, ckb, cartercomp, ccm, carterclearance, ckbm, corpoffice → Carter
    default:
      return "carter-lumber";
  }
}

function normalizeAddress(addressLines: string): { line1: string; line2: string | null } {
  const parts = (addressLines ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    line1: parts[0] ?? "",
    line2: parts.length > 1 ? parts.slice(1).join(", ") : null,
  };
}

function toRow(c: CarterContentlet): ScrapedLocation | null {
  const { line1, line2 } = normalizeAddress(c.addressLines);
  if (!c.storeName || !line1 || !c.city || !c.state || !c.zip) return null;
  const lat =
    c.latitude != null && c.latitude !== "" ? Number(c.latitude) : null;
  const lng =
    c.longitude != null && c.longitude !== "" ? Number(c.longitude) : null;
  return {
    name: c.storeName,
    addressLine1: line1,
    addressLine2: line2,
    city: c.city.trim(),
    state: c.state.trim().toUpperCase(),
    zip: c.zip.trim(),
    phone: c.phoneNumber?.trim() || null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    sourceUrl: `https://www.carterlumber.com/locations#${c.identifier}`,
    operatingCompanySlug: brandSlugFor(c.storeType1),
  };
}

async function run() {
  const opts = parseCliArgs();

  console.log(`[carter] POST ${ENDPOINT}`);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent":
        "Mozilla/5.0 (compatible; WhoOwnsMyLumberyardBot/1.0; +https://whoownsmylumberyard.com)",
    },
    body: JSON.stringify({
      query: "+contentType:Location",
      sort: "modDate",
      limit: -1,
    }),
  });
  if (!res.ok) throw new Error(`Carter API → HTTP ${res.status}`);
  const json = (await res.json()) as CarterResponse;
  const contentlets = json.entity?.jsonObjectView?.contentlets ?? [];
  console.log(`[carter] received ${contentlets.length} contentlets`);

  let rows: ScrapedLocation[] = [];
  let skipped = 0;
  // Skip the corporate office record — not a yard
  for (const c of contentlets) {
    const code = c.storeType1?.[0] ? Object.keys(c.storeType1[0])[0] : "";
    if (code === "corpoffice") {
      skipped++;
      continue;
    }
    const row = toRow(c);
    if (row) rows.push(row);
    else skipped++;
  }

  // Per-brand counts for the operator's eyeball check
  const byBrand = new Map<string, number>();
  for (const r of rows) {
    const k = r.operatingCompanySlug ?? "(none)";
    byBrand.set(k, (byBrand.get(k) ?? 0) + 1);
  }
  console.log("[carter] per-brand counts:");
  for (const [k, v] of [...byBrand.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }

  if (typeof opts.limit === "number") rows = rows.slice(0, opts.limit);

  await writeScrape("carter-lumber", rows, opts);
  console.log(`[carter] done — parsed=${rows.length}, skipped=${skipped}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
