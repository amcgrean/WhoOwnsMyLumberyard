import { load } from "cheerio";
import {
  parseCliArgs,
  RateLimiter,
  writeScrape,
  type ScrapedLocation,
} from "./_base";

/**
 * US LBM yard scraper.
 *
 * US LBM publishes its locations on a paginated WP Grid Builder page:
 *   https://uslbm.com/about/locations/?_pager=N    (N = 1..24)
 *
 * Each <article.wpgb-card> embeds an inline modal containing:
 *   - <h3> first <span> = street, second <span> = "City, ST 12345"
 *   - <a class="company-phone" href="tel:..."> = phone
 *   - <h1> = "City, State"
 *   - first <p> in modal = brand description (e.g. "Founded in 1904, ALCO Doors is...")
 *   - first external https link in modal = brand website (e.g. homesteadbuilding.com)
 *   - <a href="https://www.google.com/maps/place/..."> = canonical address
 *   - <div class="loc-block-term"> = facility type (Lumber Yard, Manufacturing, …)
 *
 * The brand-website hostname is the most reliable identifier of the operating
 * sub-brand under US LBM. We slugify it and emit per-row operatingCompanySlug
 * + operatingCompanyName so the importer can auto-create the brand company
 * and parent it to US LBM.
 */

const ROOT = "https://uslbm.com";
const PAGE_URL = (n: number) => `${ROOT}/about/locations/?_pager=${n}`;
const TOTAL_PAGES = 24;
const USER_AGENT =
  "Mozilla/5.0 (compatible; WhoOwnsMyLumberyardBot/1.0; +https://whoownsmylumberyard.com)";

const SOCIAL_OR_INFRA = [
  "google.",
  "maps.",
  "tel:",
  "mailto:",
  "facebook.",
  "instagram.",
  "twitter.",
  "linkedin.",
  "youtube.",
  "tiktok.",
  "pinterest.",
  "fonts.",
  "gravatar.",
  "cdn.",
  "wp.com",
  "wordpress.org",
  "gstatic.",
  "goo.gl",
  "yelp.com",
  "addthis",
  "wpgridbuilder.com",
  "github.com",
  "iubenda.",
  "jsdelivr.",
  "sucuri",
  "uslbm.com",
];

function isExternalBrandHost(host: string): boolean {
  const h = host.toLowerCase();
  return !SOCIAL_OR_INFRA.some((s) => h.includes(s));
}

function hostFromUrl(u: string): string | null {
  try {
    const url = new URL(u);
    return url.host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Hostname → (canonical name, slug) lookup for the top US LBM banners. When a
 * hostname isn't here, we fall back to a slugify of the domain stem which the
 * operator can rename in Drizzle Studio later.
 */
const KNOWN_BRANDS: Record<string, { name: string; slug: string }> = {
  "higginbothams.com": { name: "Higginbotham Brothers", slug: "higginbotham-brothers" },
  "foxgal.com": { name: "Foxworth-Galbraith Lumber", slug: "foxworth-galbraith" },
  "meeks.com": { name: "Meek's Lumber & Hardware", slug: "meeks-lumber" },
  "lampertlumber.com": { name: "Lampert Lumber", slug: "lampert-lumber" },
  "parkersbuildingsupply.com": { name: "Parker's Building Supply", slug: "parkers-building-supply" },
  "excelify.com": { name: "Excelify", slug: "excelify" },
  "universalsupply.com": { name: "Universal Supply", slug: "universal-supply" },
  "abc-clc.com": { name: "ABC Cape Lumber", slug: "abc-cape-lumber" },
  "pabuildingsupply.com": { name: "PA Building Supply", slug: "pa-building-supply" },
  "wibuildingsupply.com": { name: "WI Building Supply", slug: "wi-building-supply" },
  "pb-supply.com": { name: "PB Supply", slug: "pb-supply" },
  "ridoutlumber.com": { name: "Ridout Lumber", slug: "ridout-lumber" },
  "standardcompanies.com": { name: "Standard Companies", slug: "standard-companies" },
  "hinessupply.com": { name: "Hines Supply", slug: "hines-supply" },
  "hartlumber.com": { name: "Hart Lumber", slug: "hart-lumber" },
  "homesteadbuilding.com": { name: "Homestead Building Supply", slug: "homestead-building-supply" },
  "lymanlumber.com": { name: "Lyman Lumber", slug: "lyman-lumber" },
  "zeelandlumber.com": { name: "Zeeland Lumber & Supply", slug: "zeeland-lumber" },
  "baileylumber.com": { name: "Bailey Lumber & Supply", slug: "bailey-lumber" },
  "bvlumber.com": { name: "BV Lumber", slug: "bv-lumber" },
  "eastridgesupply.com": { name: "Eastridge Supply", slug: "eastridge-supply" },
  "gbsbuilding.com": { name: "GBS Building Supply", slug: "gbs-building-supply" },
  "gilcrestjewett.com": { name: "Gilcrest/Jewett Lumber", slug: "gilcrest-jewett" },
  "ki-lumber.com": { name: "KI Lumber", slug: "ki-lumber" },
  "midcape.com": { name: "Mid-Cape Home Centers", slug: "mid-cape-home-centers" },
  "desertcompanieslv.com": { name: "Desert Companies", slug: "desert-companies" },
  "rbsc.net": { name: "Robert Bowden", slug: "robert-bowden" },
  "jenningswnc.com": { name: "Jennings Builders Supply", slug: "jennings-builders-supply" },
  "scottslumber.com": { name: "Scott's Lumber", slug: "scotts-lumber" },
  "poulinlumber.com": { name: "Poulin Lumber", slug: "poulin-lumber" },
  "cabuilderssupply.com": { name: "California Builders Supply", slug: "california-builders-supply" },
  "deeringlumber.com": { name: "Deering Lumber", slug: "deering-lumber" },
  "forgelumber.com": { name: "Forge Lumber", slug: "forge-lumber" },
  "maner.com": { name: "Maner Building Supplies", slug: "maner-building-supplies" },
  "randk.com": { name: "R&K Building Supplies", slug: "r-and-k-building-supplies" },
  "hbs-lbm.com": { name: "HBS / LBM", slug: "hbs-lbm" },
  "lbrspec.com": { name: "Lumber Specialties", slug: "lumber-specialties" },
  "myrtlebeachbuildingsupply.com": { name: "Myrtle Beach Building Supply", slug: "myrtle-beach-building-supply" },
  "brittonhomecenter.com": { name: "Britton Home Center", slug: "britton-home-center" },
  "joneslumber.us": { name: "Jones Lumber", slug: "jones-lumber" },
  "northernbuildingsupply.com": { name: "Northern Building Supply", slug: "northern-building-supply" },
  "trussfab.com": { name: "TrussFab", slug: "trussfab" },
  "azbuildingsupply.com": { name: "AZ Building Supply", slug: "az-building-supply" },
  "homesteadbuildingsystemsinc.com": { name: "Homestead Building Systems", slug: "homestead-building-systems" },
  "apiebs.com": { name: "API EBS", slug: "api-ebs" },
  "arrowheadstairs.com": { name: "Arrowhead Stairs", slug: "arrowhead-stairs" },
  "bellevuebuilders.com": { name: "Bellevue Builders Supply", slug: "bellevue-builders-supply" },
  "betterbuilttruss.com": { name: "Better Built Truss", slug: "better-built-truss" },
  "breckenridgebuildingcenter.com": { name: "Breckenridge Building Center", slug: "breckenridge-building-center" },
  "darbydoors.com": { name: "Darby Doors", slug: "darby-doors" },
  "desertlbm.com": { name: "Desert LBM", slug: "desert-lbm" },
  "eaglecreeksiding.com": { name: "Eagle Creek Siding", slug: "eagle-creek-siding" },
  "edwardsbuildingcenter.com": { name: "Edwards Building Center", slug: "edwards-building-center" },
  "evergreenlumber.com": { name: "Evergreen Lumber", slug: "evergreen-lumber" },
  "juniorsbuildingmaterials.com": { name: "Junior's Building Materials", slug: "juniors-building-materials" },
  "meeksmidwest.com": { name: "Meek's Midwest", slug: "meeks-midwest" },
  "meekswest.com": { name: "Meek's West", slug: "meeks-west" },
  "oldhamlumber.com": { name: "Oldham Lumber", slug: "oldham-lumber" },
  "raks.com": { name: "RAKS Building Supply", slug: "raks-building-supply" },
  "southendexteriors.com": { name: "South End Exteriors", slug: "south-end-exteriors" },
  "texasbuildingsupply.com": { name: "Texas Building Supply", slug: "texas-building-supply" },
};

function brandFromHost(host: string): { slug: string; name: string } {
  const known = KNOWN_BRANDS[host.toLowerCase()];
  if (known) return known;
  const stem = host.replace(/\.(com|net|org|us|co|biz)$/i, "").replace(/\./g, " ");
  const words = stem
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const name = words
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
  const slug = host.replace(/\.(com|net|org|us|co|biz)$/i, "").replace(/\./g, "-");
  return { slug, name };
}

// Full state name → USPS code lookup (lenient — copy/paste data has both forms).
const STATE_TO_CODE: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA",
  michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT",
  nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district of columbia": "DC",
};

/**
 * Tolerant city-line parser. Handles full state names, 4-digit zips with a
 * dropped leading zero, and a few one-off oddities seen in the US LBM data.
 * Returns null if the line is unparseable.
 */
function parseCityLine(line: string): { city: string; state: string; zip: string } | null {
  const trimmed = line.replace(/\s+/g, " ").trim();
  // Match "City, STATE ZIP" with state as 2-letter or full name.
  const m = /^(.+?),\s*([A-Za-z .]+?)\s+(\d{4,5}(?:-\d{4})?)\s*$/.exec(trimmed);
  if (!m) return null;
  let [, city, stateRaw, zipRaw] = m;
  city = city.trim();
  stateRaw = stateRaw.trim();
  // Strip a duplicated state-name suffix like "Owings, MD, Maryland" or
  // "Douglasville, Georgia Georgia" (not a real word, but cleans up).
  city = city.replace(/,\s*[A-Z]{2}$/, "").trim();
  let state: string;
  if (/^[A-Z]{2}$/.test(stateRaw)) {
    state = stateRaw.toUpperCase();
  } else {
    const code = STATE_TO_CODE[stateRaw.toLowerCase()];
    if (!code) return null;
    state = code;
  }
  // Pad short zips
  let zip = zipRaw;
  if (/^\d{4}$/.test(zip)) zip = "0" + zip;
  if (!/^\d{5}(?:-\d{4})?$/.test(zip)) return null;
  return { city, state, zip };
}

function parseCard(html: string, sourceUrl: string): ScrapedLocation | null {
  const $ = load(html);
  // Address: H3 has two spans
  const spans = $("h3 > span")
    .map((_, el) => $(el).text().trim())
    .get();
  if (spans.length < 2) return null;
  const street = spans[0];
  const parsed = parseCityLine(spans[1]);
  if (!parsed) return null;
  const { city, state, zip } = parsed;

  const phoneRaw = $("a.company-phone").first().attr("href") ?? "";
  const phone = phoneRaw.replace(/^tel:/i, "").trim() || null;

  // Brand website: first external https link inside the modal
  let brandUrl: string | null = null;
  $('[id^="modal_"] a[href^="http"]').each((_, el) => {
    if (brandUrl) return;
    const href = $(el).attr("href") ?? "";
    const host = hostFromUrl(href);
    if (host && isExternalBrandHost(host)) brandUrl = href;
  });

  let operatingCompanySlug: string | undefined;
  let operatingCompanyName: string | undefined;
  let operatingCompanyWebsite: string | undefined;
  if (brandUrl) {
    const host = hostFromUrl(brandUrl)!;
    const brand = brandFromHost(host);
    operatingCompanySlug = brand.slug;
    operatingCompanyName = brand.name;
    operatingCompanyWebsite = brandUrl;
  }

  // Display name: prefer "{Brand} – {City}" when we have a brand, else fall back
  // to the first non-empty <h1> inside the modal (which is "City, ST").
  const fallbackHeading = $('[id^="modal_"] h1').first().text().trim() || `${city}, ${state}`;
  const displayName = operatingCompanyName
    ? `${operatingCompanyName} – ${city}`
    : fallbackHeading;

  // Service / facility type
  const services = $(".loc-block-term")
    .map((_, el) => $(el).text().trim().toLowerCase())
    .get()
    .filter(Boolean);

  // The Google Maps href is `.../place/STREET, City, ST ZIP, USA` — we already
  // have those parts. Skip embedded coords (US LBM doesn't expose them on this
  // page); leave lat/lng null and let a future geocoding pass fill them in.

  return {
    name: displayName,
    addressLine1: street,
    city,
    state,
    zip,
    phone,
    lat: null,
    lng: null,
    services,
    sourceUrl,
    operatingCompanySlug,
    operatingCompanyName,
    operatingCompanyWebsite,
  };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": USER_AGENT, accept: "text/html,*/*" },
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

async function run() {
  const opts = parseCliArgs();
  const limiter = new RateLimiter(opts.minIntervalMs ?? 1000);

  const rows: ScrapedLocation[] = [];
  let failures = 0;
  const maxPages = typeof opts.limit === "number" ? Math.ceil(opts.limit / 20) : TOTAL_PAGES;

  for (let p = 1; p <= maxPages; p++) {
    await limiter.wait();
    const url = PAGE_URL(p);
    try {
      const html = await fetchHtml(url);
      const $ = load(html);
      const cards = $("article.wpgb-card").toArray();
      let parsed = 0;
      for (const card of cards) {
        const out = parseCard($.html(card), url);
        if (!out) {
          failures++;
          continue;
        }
        rows.push(out);
        parsed++;
        if (typeof opts.limit === "number" && rows.length >= opts.limit) break;
      }
      console.log(`[uslbm] page ${p}/${maxPages}  cards=${cards.length}  parsed=${parsed}  total=${rows.length}`);
      if (typeof opts.limit === "number" && rows.length >= opts.limit) break;
    } catch (err) {
      failures++;
      console.warn(`[uslbm] page ${p} failed:`, err instanceof Error ? err.message : err);
    }
  }

  // Per-brand counts for the operator's sanity check
  const byBrand = new Map<string, number>();
  for (const r of rows) {
    const k = r.operatingCompanySlug ?? "(unmatched)";
    byBrand.set(k, (byBrand.get(k) ?? 0) + 1);
  }
  console.log("[uslbm] per-brand counts:");
  for (const [k, v] of [...byBrand.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(40)} ${v.toString().padStart(4)}`);
  }

  await writeScrape("us-lbm", rows, opts, {
    autoCreateChildrenOf: "us-lbm",
    autoCreateSourceUrl: "https://uslbm.com/about/locations/",
  });
  console.log(`[uslbm] done — parsed=${rows.length}, failed=${failures}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
