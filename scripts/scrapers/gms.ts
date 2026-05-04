import { load } from "cheerio";
import { parseCliArgs, writeScrape, type ScrapedLocation } from "./_base";
import { slugify } from "@/lib/slug";

/**
 * GMS Inc. yard scraper.
 *
 * GMS uses Next.js with Contentful-backed page props embedded in
 * __NEXT_DATA__. The find-a-yard page returns a 4.5MB HTML payload whose
 * pageProps.companies contains 73 sub-brand entries; each company.fields
 * carries a `locations` array with full address, region, postalCode, phone,
 * and {lat, lon} coordinates.
 *
 * Each row's brand identity comes directly from the parent company.fields.name
 * — no hostname-derived heuristics needed. Auto-create per-brand companies as
 * children of GMS Inc. via the importer's autoCreateChildrenOf flow.
 */

const ROOT = "https://gms.com";
const PAGE = `${ROOT}/find-a-yard`;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

type Coord = { lat: number; lon: number };

type LocationEntry = {
  fields?: {
    name?: string;
    street1?: string;
    street2?: string;
    city?: string;
    region?: { fields?: { name?: string } };
    postalCode?: string;
    phone?: string;
    coordinates?: Coord;
    productsServices?: string[];
    profileLink?: string;
  };
};

type CompanyEntry = {
  sys?: { id?: string };
  fields?: {
    name?: string;
    slug?: string;
    website?: string;
    locations?: LocationEntry[];
  };
};

function tidyZip(z: string | undefined): string | null {
  if (!z) return null;
  const m = /^(\d{5})/.exec(String(z).trim());
  return m ? m[1] : null;
}

function tidyState(name: string | undefined | null): string | null {
  if (!name) return null;
  const t = name.trim();
  if (/^[A-Z]{2}$/.test(t)) return t.toUpperCase();
  // Some entries store full state names; we only accept 2-letter codes here.
  // Anything else (province, blank) is dropped silently.
  return null;
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

async function run() {
  const opts = parseCliArgs();

  console.log(`[gms] GET ${PAGE}`);
  const html = await fetchHtml(PAGE);
  const $ = load(html);
  const blob = $('script#__NEXT_DATA__').contents().text();
  if (!blob) throw new Error("No __NEXT_DATA__ script tag found on /find-a-yard");

  const nd = JSON.parse(blob) as {
    props: { pageProps: { companies: CompanyEntry[] } };
  };
  const companies = nd.props?.pageProps?.companies ?? [];
  console.log(`[gms] received ${companies.length} companies`);

  const rows: ScrapedLocation[] = [];
  let skipped = 0;
  for (const co of companies) {
    const brandNameRaw = co.fields?.name?.trim();
    if (!brandNameRaw) {
      skipped += co.fields?.locations?.length ?? 0;
      continue;
    }
    const brandName = brandNameRaw.replace(/\s+/g, " ").trim();
    const brandSlug = slugify(co.fields?.slug ?? brandName);
    const brandWebsite = co.fields?.website?.trim() || undefined;

    for (const loc of co.fields?.locations ?? []) {
      const f = loc.fields ?? {};
      const street = (f.street1 ?? "").trim();
      const city = (f.city ?? "").trim();
      const state = tidyState(f.region?.fields?.name);
      const zip = tidyZip(f.postalCode);
      if (!street || !city || !state || !zip) {
        skipped++;
        continue;
      }
      const c = f.coordinates ?? null;
      const lat = c && Number.isFinite(c.lat) ? c.lat : null;
      const lng = c && Number.isFinite(c.lon) ? c.lon : null;

      const services = (f.productsServices ?? [])
        .filter((s) => typeof s === "string" && s.trim())
        .map((s) => s.trim().toLowerCase());

      // Display name from the location itself usually already includes the
      // brand and city (e.g. "Frontier Drywall Supply - Denver"). Fall back to
      // "{brand} – {city}" if the location.name is empty.
      const nameRaw = (f.name ?? "").trim().replace(/\s+/g, " ");
      const name = nameRaw || `${brandName} – ${city}`;

      rows.push({
        name,
        addressLine1: street,
        addressLine2: f.street2?.trim() || null,
        city,
        state,
        zip,
        phone: f.phone?.trim() || null,
        lat,
        lng,
        services,
        sourceUrl: f.profileLink || PAGE,
        operatingCompanySlug: brandSlug,
        operatingCompanyName: brandName,
        operatingCompanyWebsite: brandWebsite,
      });
    }
  }

  if (typeof opts.limit === "number") rows.splice(opts.limit);

  // Per-brand summary
  const byBrand = new Map<string, number>();
  for (const r of rows) {
    const k = r.operatingCompanySlug ?? "(unknown)";
    byBrand.set(k, (byBrand.get(k) ?? 0) + 1);
  }
  console.log("[gms] per-brand counts (top 20):");
  for (const [k, v] of [...byBrand.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${k.padEnd(40)} ${v.toString().padStart(4)}`);
  }
  console.log(`[gms] distinct brands: ${byBrand.size}, skipped: ${skipped}`);

  await writeScrape("gms", rows, opts, {
    autoCreateChildrenOf: "gms-inc",
    autoCreateSourceUrl: "https://gms.com/find-a-yard",
  });
  console.log(`[gms] done — parsed=${rows.length}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
