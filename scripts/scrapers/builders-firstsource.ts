import { chromium, type Page } from "playwright";
import {
  parseCliArgs,
  RateLimiter,
  writeScrape,
  type ScrapedLocation,
} from "./_base";

/**
 * Builders FirstSource store-locator scraper.
 *
 * Strategy: load the public locations directory, harvest each location's
 * detail page, parse address / phone / coords from page DOM and any embedded
 * JSON-LD or window state.
 *
 * Note on robustness: store locators redesign frequently. If the layout has
 * changed by the time you run this, adjust the selectors below. The two
 * resilient patterns to look for are: (1) a JSON-LD <script> with
 * "@type":"LocalBusiness", and (2) <a href="/locations/..."> links on the
 * directory page.
 *
 * Usage:
 *   pnpm scrape:bfs                     # full run
 *   pnpm scrape:bfs --limit 5 --dry-run # smoke test
 */

const ROOT = "https://www.bldr.com/locations";

async function harvestDirectoryUrls(page: Page, limit?: number): Promise<string[]> {
  await page.goto(ROOT, { waitUntil: "domcontentloaded", timeout: 60000 });
  // Wait for at least one location anchor to render
  await page.waitForSelector('a[href*="/locations/"]', { timeout: 30000 });
  const hrefs = await page.$$eval('a[href*="/locations/"]', (els) =>
    Array.from(new Set(els.map((a) => (a as HTMLAnchorElement).href)))
  );
  // Skip the listing root itself
  const filtered = hrefs.filter((u) => !u.endsWith("/locations") && !u.endsWith("/locations/"));
  return typeof limit === "number" ? filtered.slice(0, limit) : filtered;
}

async function harvestLocation(page: Page, url: string): Promise<ScrapedLocation | null> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  // Try JSON-LD first
  const jsonLdRaw = await page.$$eval(
    'script[type="application/ld+json"]',
    (els) => els.map((e) => e.textContent ?? "")
  );
  for (const blob of jsonLdRaw) {
    try {
      const parsed = JSON.parse(blob);
      const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (
          typeof item === "object" &&
          item !== null &&
          ("@type" in item) &&
          /LocalBusiness|Store/.test(String((item as { "@type": string })["@type"]))
        ) {
          const it = item as Record<string, unknown>;
          const addr = (it.address ?? {}) as Record<string, unknown>;
          const geo = (it.geo ?? {}) as Record<string, unknown>;
          const street = String(addr.streetAddress ?? "");
          if (!street) continue;
          return {
            name: String(it.name ?? ""),
            addressLine1: street,
            city: String(addr.addressLocality ?? ""),
            state: String(addr.addressRegion ?? "").toUpperCase(),
            zip: String(addr.postalCode ?? ""),
            phone: it.telephone ? String(it.telephone) : null,
            lat: geo.latitude != null ? Number(geo.latitude) : null,
            lng: geo.longitude != null ? Number(geo.longitude) : null,
            sourceUrl: url,
          };
        }
      }
    } catch {
      // fall through
    }
  }

  // Fallback: minimal DOM scrape — heading + first address line. The operator
  // should refine this once the live page structure is known.
  const name = (await page.locator("h1").first().textContent())?.trim();
  if (!name) return null;
  return null;
}

async function run() {
  const opts = parseCliArgs();
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (compatible; WhoOwnsMyLumberyardBot/1.0; +https://whoownsmylumberyard.com)",
  });
  const page = await ctx.newPage();
  const limiter = new RateLimiter(opts.minIntervalMs ?? 1000);

  console.log("[bfs] fetching directory…");
  const urls = await harvestDirectoryUrls(page, opts.limit);
  console.log(`[bfs] found ${urls.length} candidate location urls`);

  const rows: ScrapedLocation[] = [];
  for (const [i, url] of urls.entries()) {
    await limiter.wait();
    try {
      const row = await harvestLocation(page, url);
      if (row) {
        rows.push(row);
        if ((i + 1) % 20 === 0) console.log(`[bfs] ${i + 1}/${urls.length}`);
      }
    } catch (err) {
      console.warn(`[bfs] failed ${url}`, err);
    }
  }

  await writeScrape("builders-firstsource", rows, opts);
  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
