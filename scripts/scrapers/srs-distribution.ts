import { load } from "cheerio";
import {
  parseCliArgs,
  RateLimiter,
  writeScrape,
  type ScrapedLocation,
} from "./_base";

/**
 * SRS Distribution scraper.
 *
 * SRS publishes every branch as a static URL under
 *   https://www.srsdistribution.com/en/markets/our-brands/{brand-slug}/{branch-slug}/
 * and lists them all in /sitemap.xml.
 *
 * Each detail page embeds JSON-LD with streetAddress, addressLocality,
 * addressRegion, postalCode, telephone, latitude, longitude. The brand-slug
 * segment of the URL identifies which sub-brand the location operates under
 * (most are "srs-building-products"; smaller sub-brands include LS Building
 * Products, Florence Building Materials, Amagansett Building Materials, etc.).
 *
 * We auto-create per-brand companies as children of SRS Distribution via the
 * importer's autoCreateChildrenOf flow, so the ownership chain reads
 *   yard → {brand} → SRS Distribution → The Home Depot
 */

const ROOT = "https://www.srsdistribution.com";
const SITEMAP = `${ROOT}/sitemap.xml`;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

// Hand-curated brand-slug → display-name map. Keeps brand companies clean from
// the jump rather than relying on hostname-derived names.
const BRAND_NAMES: Record<string, string> = {
  "srs-building-products": "SRS Building Products",
  "ls-building-products": "LS Building Products",
  "national-building-supply": "National Building Supply",
  "rock-materials": "Rock Materials",
  "florence-bldg-materials": "Florence Building Materials",
  "specialty-wood-products": "Specialty Wood Products",
  "amagansett-bldg-materials": "Amagansett Building Materials",
  "sider-lumber--supply": "Sider Lumber & Supply",
  "national-building--roofing-supplies": "National Building & Roofing Supplies",
  "metro-roofing-supplies": "Metro Roofing Supplies",
};

function brandFromUrl(url: string): { slug: string; name: string } | null {
  const m = /\/our-brands\/([a-z0-9-]+)\//.exec(url);
  if (!m) return null;
  const rawSlug = m[1];
  const slug = rawSlug.replace(/--/g, "-and-").replace(/-+/g, "-");
  const name = BRAND_NAMES[rawSlug] ?? rawSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { slug, name };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

function discoverDetailUrls(sitemapXml: string): string[] {
  // Sitemap is one giant line — grep all <loc>...</loc> with the branch shape.
  const re = /<loc>(https:\/\/www\.srsdistribution\.com\/en\/markets\/our-brands\/[a-z0-9-]+\/[^<]+?)<\/loc>/g;
  const urls = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(sitemapXml)) !== null) urls.add(m[1]);
  return [...urls];
}

const ZIP_RE = /^(\d{5})/;

function parseDetailPage(html: string, url: string): ScrapedLocation | null {
  const $ = load(html);
  // Walk every JSON-LD script and pick out the first node with a PostalAddress.
  let address: Record<string, string> | null = null;
  let geo: { latitude: number; longitude: number } | null = null;
  let phone: string | null = null;
  let businessName: string | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).contents().text();
    try {
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) walk(item);
    } catch {
      // ignore malformed
    }
  });

  function walk(item: unknown): void {
    if (!item || typeof item !== "object") return;
    const o = item as Record<string, unknown>;
    const t = o["@type"];
    if (t === "PostalAddress" && !address) {
      address = {
        streetAddress: String(o.streetAddress ?? ""),
        addressLocality: String(o.addressLocality ?? ""),
        addressRegion: String(o.addressRegion ?? ""),
        postalCode: String(o.postalCode ?? ""),
      };
    }
    if (t === "GeoCoordinates" && !geo) {
      const lat = Number(o.latitude);
      const lng = Number(o.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) geo = { latitude: lat, longitude: lng };
    }
    if (typeof o.telephone === "string" && !phone) phone = String(o.telephone);
    if (typeof o.name === "string" && (t === "Organization" || t === "LocalBusiness") && !businessName) {
      businessName = String(o.name);
    }
    // Recurse into common nested shapes
    for (const v of Object.values(o)) {
      if (v && typeof v === "object") walk(v);
    }
  }

  if (!address) return null;
  const a = address as Record<string, string>;
  if (!a.streetAddress || !a.addressLocality || !a.addressRegion) return null;

  const zipMatch = ZIP_RE.exec(a.postalCode ?? "");
  if (!zipMatch) return null;
  const zip = zipMatch[1];

  const brand = brandFromUrl(url);
  // H1 carries the canonical sign name like "FLORENCE BUILDING MATERIALS - HUNTINGTON"
  const h1 = $("h1").first().text().trim();
  const cleanH1 = h1
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const displayName = cleanH1 || businessName || (brand ? `${brand.name} – ${a.addressLocality}` : a.addressLocality);

  return {
    name: displayName,
    addressLine1: a.streetAddress.trim(),
    city: a.addressLocality.trim(),
    state: a.addressRegion.trim().toUpperCase(),
    zip,
    phone: phone ? String(phone).trim() : null,
    lat: geo ? (geo as { latitude: number; longitude: number }).latitude : null,
    lng: geo ? (geo as { latitude: number; longitude: number }).longitude : null,
    sourceUrl: url,
    operatingCompanySlug: brand?.slug,
    operatingCompanyName: brand?.name,
    operatingCompanyWebsite: undefined,
  };
}

async function run() {
  const opts = parseCliArgs();
  const limiter = new RateLimiter(opts.minIntervalMs ?? 750);

  console.log(`[srs] fetching sitemap ${SITEMAP}`);
  const sitemap = await fetchHtml(SITEMAP);
  let urls = discoverDetailUrls(sitemap);
  console.log(`[srs] found ${urls.length} branch URLs`);
  if (typeof opts.limit === "number") urls = urls.slice(0, opts.limit);

  const rows: ScrapedLocation[] = [];
  let failures = 0;
  for (const [i, url] of urls.entries()) {
    await limiter.wait();
    try {
      const html = await fetchHtml(url);
      const row = parseDetailPage(html, url);
      if (row) rows.push(row);
      else failures++;
      if ((i + 1) % 25 === 0 || i + 1 === urls.length) {
        console.log(`[srs] ${i + 1}/${urls.length}  parsed=${rows.length}  failed=${failures}`);
      }
    } catch (err) {
      failures++;
      console.warn(`[srs] ${url} failed:`, err instanceof Error ? err.message : err);
    }
  }

  // Per-brand summary
  const byBrand = new Map<string, number>();
  for (const r of rows) {
    const k = r.operatingCompanySlug ?? "(unknown)";
    byBrand.set(k, (byBrand.get(k) ?? 0) + 1);
  }
  console.log("[srs] per-brand counts:");
  for (const [k, v] of [...byBrand.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(40)} ${v.toString().padStart(4)}`);
  }

  await writeScrape("srs-distribution", rows, opts, {
    autoCreateChildrenOf: "srs-distribution",
    autoCreateSourceUrl: "https://www.srsdistribution.com/en/markets/our-brands/",
  });
  console.log(`[srs] done — parsed=${rows.length}, failed=${failures}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
