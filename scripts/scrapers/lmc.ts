import { load } from "cheerio";
import { parseCliArgs, writeScrape, type ScrapedLocation } from "./_base";
import { slugify } from "@/lib/slug";

/**
 * LMC (Lumbermens Merchandising Corporation) member-dealer scraper.
 *
 * LMC's member directory is at:
 *   POST https://www.lmctogetherwebuild.com/api/dealer_locator.php
 *   body: zip=<zip>&radius=<miles>
 *
 * A wide-radius search from any zip returns the entire active member
 * universe in one HTML response (.dealer-card divs with .dealer_address1
 * and .dealer_address2 children for street and city/state/zip).
 *
 * Each member is auto-created in the database as a yard-typed company with
 * a `member_of` ownership edge to LMC (slug `lmc`). Co-op membership does
 * NOT mean the parent owns the member — they are independent operators
 * aggregating purchasing power, so the relationship is `member_of`, not
 * `subsidiary_of`.
 *
 * Run:
 *   pnpm scrape:lmc                   # full member universe
 *   pnpm scrape:lmc --dry-run         # smoke test
 *
 * No API key required.
 */

const ENDPOINT = "https://www.lmctogetherwebuild.com/api/dealer_locator.php";
const SOURCE_URL = "https://www.lmctogetherwebuild.com/find-dealer/";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

// "Continental US covered by 5,000-mile radius from a single zip" is more
// than enough to grab every dealer in one POST.
const SEED_ZIP = "10001";
const SEED_RADIUS_MI = 5000;

const ADDRESS2_RE = /^([A-Za-z .'-]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)$/;

function parseAddressLine2(text: string): { city: string; state: string; zip: string } | null {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const m = ADDRESS2_RE.exec(trimmed);
  if (!m) return null;
  const [, city, state, zipFull] = m;
  const zip = /^(\d{5})/.exec(zipFull)?.[1] ?? zipFull;
  return { city, state: state.toUpperCase(), zip };
}

function normalizePhone(href: string | undefined): string | null {
  if (!href) return null;
  const digits = href.replace(/[^0-9]/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits || null;
}

async function run() {
  const opts = parseCliArgs();

  console.log(`[lmc] POST ${ENDPOINT}  (zip=${SEED_ZIP}, radius=${SEED_RADIUS_MI})`);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,*/*",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      zip: SEED_ZIP,
      radius: String(SEED_RADIUS_MI),
    }).toString(),
  });
  if (!res.ok) throw new Error(`LMC dealer_locator → HTTP ${res.status}`);
  const html = await res.text();
  console.log(`[lmc] received ${html.length} bytes`);

  const $ = load(html);
  const cards = $(".dealer-card").toArray();
  console.log(`[lmc] found ${cards.length} dealer cards`);

  const rowsByKey = new Map<string, ScrapedLocation>();
  let skipped = 0;

  for (const card of cards) {
    const $c = $(card);
    const name = $c.find("h5").first().text().trim().replace(/\s+/g, " ");
    const street = $c.find(".dealer_address1").first().text().trim().replace(/\s+/g, " ");
    const cityLine = $c.find(".dealer_address2").first().text().trim();
    if (!name || !street || !cityLine) {
      skipped++;
      continue;
    }
    const parsed = parseAddressLine2(cityLine);
    if (!parsed) {
      skipped++;
      continue;
    }
    const phoneLink = $c.find('a[href^="tel:"]').first().attr("href");
    const phone = normalizePhone(phoneLink);
    const website = $c.find('a[href^="http"]:not([href*="tel:"])').first().attr("href") ?? undefined;

    // Dedup key: same yard can appear multiple times (different distances).
    const key = `${name}|${street}|${parsed.city}|${parsed.state}|${parsed.zip}`.toLowerCase();
    if (rowsByKey.has(key)) continue;

    const operatingCompanySlug = slugify(`${name} ${parsed.city} ${parsed.state}`);
    const operatingCompanyName = name;

    rowsByKey.set(key, {
      name: `${name} – ${parsed.city}, ${parsed.state}`,
      addressLine1: street,
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
      phone,
      lat: null,
      lng: null,
      sourceUrl: SOURCE_URL,
      operatingCompanySlug,
      operatingCompanyName,
      operatingCompanyWebsite: website,
    });
  }

  let rows = [...rowsByKey.values()];
  if (typeof opts.limit === "number") rows = rows.slice(0, opts.limit);
  console.log(`[lmc] parsed=${rows.length}  skipped=${skipped}`);

  await writeScrape("lmc", rows, opts, {
    autoCreateChildrenOf: "lmc",
    autoCreateRelationship: "member_of",
    autoCreateSourceUrl: SOURCE_URL,
  });
  console.log(`[lmc] done`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
