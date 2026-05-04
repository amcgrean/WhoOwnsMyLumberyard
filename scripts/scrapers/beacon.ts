import { chromium } from "playwright";
import { parseCliArgs, writeScrape, type ScrapedLocation } from "./_base";

/**
 * Beacon Building Products scraper.
 *
 * After QXO acquired Beacon (April 2025), becn.com redirects to qxo.com.
 * The locator at qxo.com/find-a-store is a Next.js SPA that fetches branch
 * data via XHR; rather than reverse-engineer the (rotating) chunk structure,
 * we drive a real headless browser and intercept every JSON response.
 *
 * Strategy: navigate, scroll the listing to trigger lazy loads, and collect
 * any JSON payload that contains location-shaped objects (address + city +
 * state + zip). De-dupe by (name, address, city, state, zip).
 *
 * Run:
 *   pnpm scrape:beacon                         # full headless run
 *   pnpm scrape:beacon --dry-run --limit 5     # smoke test
 *
 * Notes:
 *   - Requires `pnpm exec playwright install chromium` once.
 *   - `ignoreHTTPSErrors: true` handles networks where the cert chain
 *     isn't fully trusted (e.g. some CI / sandbox environments). On a
 *     normal workstation it's a no-op.
 */

const LOCATOR_URL = "https://www.qxo.com/find-a-store";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

type AnyObj = Record<string, unknown>;

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function walk(node: unknown, visit: (obj: AnyObj) => void): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
    return;
  }
  if (typeof node === "object") {
    const obj = node as AnyObj;
    visit(obj);
    for (const value of Object.values(obj)) walk(value, visit);
  }
}

function toLocation(obj: AnyObj): ScrapedLocation | null {
  const name =
    asString(obj.name) ??
    asString(obj.locationName) ??
    asString(obj.title) ??
    asString(obj.branchName);
  const addressLine1 =
    asString(obj.addressLine1) ??
    asString(obj.address1) ??
    asString(obj.street) ??
    asString(obj.streetAddress) ??
    asString(obj.address);
  const city = asString(obj.city) ?? asString(obj.locality);
  const state = asString(obj.state) ?? asString(obj.region) ?? asString(obj.stateCode);
  const zip = asString(obj.zip) ?? asString(obj.postalCode) ?? asString(obj.postcode) ?? asString(obj.zipCode);

  if (!name || !addressLine1 || !city || !state || !zip) return null;
  // 5-digit zip min — guards against false positives from international rows
  if (!/^\d{5}/.test(zip)) return null;

  const phone = asString(obj.phone) ?? asString(obj.telephone) ?? asString(obj.phoneNumber);
  const lat = asNumber(obj.lat) ?? asNumber(obj.latitude);
  const lng = asNumber(obj.lng) ?? asNumber(obj.lon) ?? asNumber(obj.longitude);
  const sourceUrl = asString(obj.url) ?? asString(obj.permalink) ?? LOCATOR_URL;

  return {
    name,
    addressLine1,
    city,
    state: state.toUpperCase(),
    zip: zip.replace(/^(\d{5}).*$/, "$1"),
    phone,
    lat,
    lng,
    sourceUrl,
  };
}

function locationKey(row: ScrapedLocation): string {
  return [row.name, row.addressLine1, row.city, row.state, row.zip]
    .map((x) => x.toLowerCase())
    .join("|");
}

async function run() {
  const opts = parseCliArgs();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const rowsByKey = new Map<string, ScrapedLocation>();
  let jsonResponses = 0;

  page.on("response", async (res) => {
    try {
      const url = res.url();
      const ct = res.headers()["content-type"] ?? "";
      if (!ct.includes("json") && !url.includes("_next/data") && !url.endsWith(".json")) return;
      const body = await res.text();
      const data = JSON.parse(body) as unknown;
      jsonResponses++;
      walk(data, (obj) => {
        const row = toLocation(obj);
        if (!row) return;
        rowsByKey.set(locationKey(row), row);
      });
    } catch {
      // ignore non-JSON / partial payload errors
    }
  });

  console.log(`[beacon] opening ${LOCATOR_URL}`);
  try {
    await page.goto(LOCATOR_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  } catch (err) {
    console.warn("[beacon] navigation timeout — continuing with whatever loaded:", err);
  }

  // Give SPAs a chance to fire their initial XHRs.
  await page.waitForTimeout(5000);

  // Try to surface the locations list by scrolling and triggering common
  // search affordances. The exact selector depends on the QXO build at scrape
  // time — these are best-effort.
  for (const sel of [
    'input[placeholder*="zip" i]',
    'input[placeholder*="address" i]',
    'input[name*="zip" i]',
    'input[type="search"]',
  ]) {
    try {
      const handle = await page.$(sel);
      if (handle) {
        await handle.fill("10001");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(3500);
        break;
      }
    } catch {
      // try next selector
    }
  }

  // Scroll a few times in case results lazy-load
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(500);
  }

  await page.waitForTimeout(2000);
  console.log(`[beacon] inspected ${jsonResponses} JSON responses`);

  let rows = [...rowsByKey.values()];
  if (typeof opts.limit === "number") rows = rows.slice(0, opts.limit);

  await browser.close();

  await writeScrape("beacon", rows, opts);
  console.log(`[beacon] done — parsed=${rows.length}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
