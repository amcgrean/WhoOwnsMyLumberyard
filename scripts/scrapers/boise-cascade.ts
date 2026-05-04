import { parseCliArgs, writeScrape, type ScrapedLocation } from "./_base";

/**
 * Boise Cascade scraper.
 *
 * Boise Cascade's /locations/ page is powered by Awesome Store Locator (ASL),
 * a WordPress plugin that exposes its full dataset via admin-ajax with the
 * action `asl_load_stores`:
 *
 *   POST https://www.bc.com/wp-admin/admin-ajax.php
 *   body: action=asl_load_stores&load_all=1
 *
 * The endpoint returns 158 entries that mix two populations: BC-owned
 * facilities (BMD distribution branches + EWP plants) and independent dealer
 * locations that carry BC products. We filter to BC-owned only by title:
 *   - Titles starting with "Boise Cascade" (BMD branches)
 *   - Titles ending with " EWP"            (Engineered Wood Products plants)
 *
 * Duplicates (same physical site listed under multiple ASL category sets)
 * are deduped by (street, city, state).
 */

const ENDPOINT = "https://www.bc.com/wp-admin/admin-ajax.php";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

type ApiStore = {
  id: string;
  title: string;
  street: string;
  city: string;
  state: string;
  postal_code: string;
  phone?: string;
  lat: string;
  lng: string;
  line_card?: string;
};

function tidyZip(z: string | undefined): string | null {
  if (!z) return null;
  const m = /^(\d{5})/.exec(String(z).trim());
  return m ? m[1] : null;
}

function tidyTitle(t: string): string {
  return t.replace(/\s+/g, " ").trim();
}

function isBoiseOwned(title: string): boolean {
  const t = tidyTitle(title);
  if (t.startsWith("Boise Cascade")) return true;
  if (/\bEWP\b/i.test(t) && !t.includes(",")) return true; // "Alexandria EWP" yes; not "Foo, EWP"
  return false;
}

function toRow(s: ApiStore): ScrapedLocation | null {
  const title = tidyTitle(s.title);
  const street = s.street?.trim();
  const city = s.city?.trim();
  const state = s.state?.trim().toUpperCase();
  const zip = tidyZip(s.postal_code);
  if (!title || !street || !city || !state || !zip) return null;
  const lat = Number(s.lat);
  const lng = Number(s.lng);
  return {
    name: title,
    addressLine1: street,
    city,
    state,
    zip,
    phone: s.phone?.trim() || null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    sourceUrl: `https://www.bc.com/locations/?id=${s.id}`,
  };
}

async function run() {
  const opts = parseCliArgs();

  console.log(`[bc] POST ${ENDPOINT}`);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/json,text/plain,*/*",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "action=asl_load_stores&load_all=1",
  });
  if (!res.ok) throw new Error(`Boise ASL → HTTP ${res.status}`);
  const stores = (await res.json()) as ApiStore[];
  console.log(`[bc] received ${stores.length} entries (mix of BC-owned + dealer locations)`);

  const owned = stores.filter((s) => isBoiseOwned(s.title));
  console.log(`[bc] BC-owned subset: ${owned.length}`);

  // Dedupe by (street, city, state) — some sites appear multiple times under
  // different ASL category sets.
  const seen = new Set<string>();
  let rows: ScrapedLocation[] = [];
  let skipped = 0;
  for (const s of owned) {
    const row = toRow(s);
    if (!row) {
      skipped++;
      continue;
    }
    const key = `${row.addressLine1}|${row.city}|${row.state}`.toLowerCase();
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    rows.push(row);
  }

  if (typeof opts.limit === "number") rows = rows.slice(0, opts.limit);
  console.log(`[bc] after dedupe: ${rows.length} (${skipped} skipped)`);

  await writeScrape("boise-cascade", rows, opts);
  console.log(`[bc] done`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
