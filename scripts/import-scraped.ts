import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import fs from "node:fs/promises";
import path from "node:path";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, locations } from "@/lib/db/schema";
import { locationSlug, slugify } from "@/lib/slug";
import type { ScrapedLocation } from "./scrapers/_base";

/**
 * Reads a scraped JSON file and upserts each location.
 * Dedupe key, in order:
 *   1. google_place_id (if scraper found one)
 *   2. (operating_company_id, addressLine1, city, state) fuzzy
 *
 * Locations whose operating company is unknown are attached to the
 * "Unverified Independent" placeholder company so they appear in the database
 * and can be reassigned by the operator.
 */
async function ensureUnverifiedIndependent() {
  const slug = "unverified-independent";
  const existing = await db.query.companies.findFirst({ where: eq(companies.slug, slug) });
  if (existing) return existing;
  const [created] = await db
    .insert(companies)
    .values({
      slug,
      name: "Unverified Independent",
      type: "yard",
      description:
        "Placeholder operating-company record for scraped or imported yards whose ownership has not yet been confirmed. The site operator reassigns these to the correct company once verified.",
      status: "active",
    })
    .returning();
  return created;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: pnpm import:scraped <path-to-json>");
    process.exit(1);
  }
  const filepath = path.resolve(process.cwd(), file);
  const raw = await fs.readFile(filepath, "utf8");
  const parsed: { consolidator: string; rows: ScrapedLocation[] } = JSON.parse(raw);

  // File-level fallback operating company. Per-row `operatingCompanySlug`
  // overrides this when present.
  const fallbackSlug = slugify(parsed.consolidator);
  const fallbackCompany =
    (await db.query.companies.findFirst({ where: eq(companies.slug, fallbackSlug) })) ??
    (await ensureUnverifiedIndependent());

  // Cache resolved companies by slug to avoid re-querying for repeat brands.
  const companyCache = new Map<string, typeof fallbackCompany>();
  companyCache.set(fallbackSlug, fallbackCompany);

  async function resolveCompany(slug: string | undefined) {
    const target = slug ?? fallbackSlug;
    const cached = companyCache.get(target);
    if (cached) return cached;
    const found = await db.query.companies.findFirst({ where: eq(companies.slug, target) });
    const resolved = found ?? fallbackCompany;
    companyCache.set(target, resolved);
    return resolved;
  }

  let inserted = 0;
  let updated = 0;
  for (const r of parsed.rows) {
    const company = await resolveCompany(r.operatingCompanySlug);
    const slug = locationSlug({ name: r.name, city: r.city, state: r.state });
    const existing = await db.query.locations.findFirst({
      where: and(eq(locations.companyId, company.id), eq(locations.slug, slug)),
    });
    const values = {
      slug,
      companyId: company.id,
      displayName: r.name,
      addressLine1: r.addressLine1,
      addressLine2: r.addressLine2 ?? null,
      city: r.city,
      state: r.state.toUpperCase(),
      zip: r.zip,
      phone: r.phone ?? null,
      lat: r.lat != null ? r.lat.toFixed(6) : null,
      lng: r.lng != null ? r.lng.toFixed(6) : null,
      services: r.services ?? [],
      sourceUrl: r.sourceUrl,
      status: "open" as const,
    };
    if (existing) {
      await db.update(locations).set({ ...values, updatedAt: new Date() }).where(eq(locations.id, existing.id));
      updated++;
    } else {
      await db.insert(locations).values(values);
      inserted++;
    }
  }
  console.log(`Imported ${parsed.rows.length} rows: ${inserted} inserted, ${updated} updated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
