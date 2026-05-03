import { load } from "cheerio";
import {
  parseCliArgs,
  RateLimiter,
  writeScrape,
  type ScrapedLocation,
} from "./_base";

/**
 * Builders FirstSource yard scraper.
 *
 * Strategy: BFS publishes a static directory at /location/all-locations
 * containing every branch URL. Each detail page exposes structured fields
 * we can parse cleanly without a browser:
 *   - <h1>           → display name
 *   - .address > a   → street, city, state, zip (google-maps href)
 *   - .phone tel:    → phone
 *   - data-lat / data-lng on the embedded map element
 *
 * Run:
 *   pnpm scrape:bfs                       # full run
 *   pnpm scrape:bfs --limit 5 --dry-run   # smoke test
 */

const ROOT = "https://www.bldr.com";
const DIRECTORY = `${ROOT}/location/all-locations`;
const USER_AGENT =
  "Mozilla/5.0 (compatible; WhoOwnsMyLumberyardBot/1.0; +https://whoownsmylumberyard.com)";

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": USER_AGENT, accept: "text/html,*/*" },
  });
  if (!res.ok) {
    throw new Error(`${url} → HTTP ${res.status}`);
  }
  return res.text();
}

function discoverDirectoryUrls(html: string): string[] {
  const $ = load(html);
  const hrefs = new Set<string>();
  $('a[href*="/location/"]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    // Filter to leaf detail pages: /location/<slug>/<id>. Exclude the directory
    // index and the all-locations page. IDs may contain mixed case and slashes
    // (e.g. /location/grand-junction-co-yard-27-1/2-rd, /location/aberdeen-nc-lumber-yard/SABNYD).
    if (!/^\/location\/[^/]+\/[^"\s]+$/.test(href)) return;
    if (href.startsWith("/location/all-locations")) return;
    hrefs.add(href);
  });
  return [...hrefs].map((h) => ROOT + h);
}

const ADDRESS_RE = /maps\/place\/([^,]+),([^,]+),([A-Z]{2}),(\d{5}(?:-\d{4})?)/;

function parseLocationPage(html: string, sourceUrl: string): ScrapedLocation | null {
  const $ = load(html);
  const name = ($("div.location-header h1").first().text() || $("h1").first().text())
    .trim()
    .replace(/\s+/g, " ");
  if (!name) return null;

  const placeHref = $(".address a.placeLink").first().attr("href") ?? "";
  const m = ADDRESS_RE.exec(placeHref);
  if (!m) return null;

  const [, street, city, state, zip] = m;

  const phoneHref = $('.phone a[href^="tel:"]').first().attr("href") ?? "";
  const phone = phoneHref.replace(/^tel:/i, "").trim() || null;

  const latStr =
    $("[data-lat]").first().attr("data-lat") ??
    $("[data-location]").first().attr("data-location")?.split(",")[0];
  const lngStr =
    $("[data-lng]").first().attr("data-lng") ??
    $("[data-location]").first().attr("data-location")?.split(",")[1];
  const lat = latStr ? Number(latStr) : null;
  const lng = lngStr ? Number(lngStr) : null;

  return {
    name,
    addressLine1: street.trim(),
    city: city.trim(),
    state: state.trim().toUpperCase(),
    zip: zip.trim(),
    phone,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    sourceUrl,
  };
}

async function run() {
  const opts = parseCliArgs();
  const limiter = new RateLimiter(opts.minIntervalMs ?? 750);

  console.log(`[bfs] fetching directory ${DIRECTORY}`);
  const directoryHtml = await fetchHtml(DIRECTORY);
  let urls = discoverDirectoryUrls(directoryHtml);
  console.log(`[bfs] found ${urls.length} location URLs`);
  if (typeof opts.limit === "number") urls = urls.slice(0, opts.limit);

  const rows: ScrapedLocation[] = [];
  let failures = 0;
  for (const [i, url] of urls.entries()) {
    await limiter.wait();
    try {
      const html = await fetchHtml(url);
      const row = parseLocationPage(html, url);
      if (row) rows.push(row);
      else failures++;
      if ((i + 1) % 25 === 0 || i + 1 === urls.length) {
        console.log(`[bfs] ${i + 1}/${urls.length}  parsed=${rows.length}  failed=${failures}`);
      }
    } catch (err) {
      failures++;
      console.warn(`[bfs] ${url} failed:`, err instanceof Error ? err.message : err);
    }
  }

  await writeScrape("builders-firstsource", rows, opts);
  console.log(`[bfs] done — parsed=${rows.length}, failed=${failures}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
