import { chromium } from "playwright";
import { parseCliArgs, writeScrape, type ScrapedLocation } from "./_base";

const LOCATOR_URL = "https://www.qxo.com/find-a-store";
const USER_AGENT =
  "Mozilla/5.0 (compatible; WhoOwnsMyLumberyardBot/1.0; +https://whoownsmylumberyard.com)";

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
  const name = asString(obj.name) ?? asString(obj.locationName) ?? asString(obj.title);
  const addressLine1 =
    asString(obj.addressLine1) ?? asString(obj.address1) ?? asString(obj.street) ?? asString(obj.address);
  const city = asString(obj.city);
  const state = asString(obj.state) ?? asString(obj.region);
  const zip = asString(obj.zip) ?? asString(obj.postalCode) ?? asString(obj.postcode);

  if (!name || !addressLine1 || !city || !state || !zip) return null;

  const phone = asString(obj.phone) ?? asString(obj.telephone);
  const lat = asNumber(obj.lat) ?? asNumber(obj.latitude);
  const lng = asNumber(obj.lng) ?? asNumber(obj.lon) ?? asNumber(obj.longitude);
  const sourceUrl = asString(obj.url) ?? asString(obj.permalink) ?? LOCATOR_URL;

  return {
    name,
    addressLine1,
    city,
    state: state.toUpperCase(),
    zip,
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
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  const rowsByKey = new Map<string, ScrapedLocation>();

  page.on("response", async (res) => {
    try {
      const url = res.url();
      const ct = res.headers()["content-type"] ?? "";
      if (!ct.includes("json") && !url.includes("_next/data")) return;
      const body = await res.text();
      const data = JSON.parse(body) as unknown;
      walk(data, (obj) => {
        const row = toLocation(obj);
        if (!row) return;
        rowsByKey.set(locationKey(row), row);
      });
    } catch {
      // Ignore non-JSON and partial payload failures; we gather from many responses.
    }
  });

  console.log(`[beacon] opening ${LOCATOR_URL}`);
  await page.goto(LOCATOR_URL, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(5000);

  const rows = [...rowsByKey.values()];
  if (typeof opts.limit === "number") {
    rows.splice(opts.limit);
  }

  await browser.close();

  await writeScrape("beacon", rows, opts);
  console.log(`[beacon] done — parsed=${rows.length}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
