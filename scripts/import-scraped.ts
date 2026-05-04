import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import fs from "node:fs/promises";
import path from "node:path";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, locations, ownershipEdges, sources, claimSources } from "@/lib/db/schema";
import { locationSlug, slugify } from "@/lib/slug";
import type { ScrapeOutput } from "./scrapers/_base";

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

async function ensureSource(url: string) {
  const existing = await db.query.sources.findFirst({ where: eq(sources.url, url) });
  if (existing) return existing;
  const [created] = await db.insert(sources).values({ url }).returning();
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
  const parsed: ScrapeOutput = JSON.parse(raw);

  // File-level fallback operating company. Per-row `operatingCompanySlug`
  // overrides this when present.
  const fallbackSlug = slugify(parsed.consolidator);
  const fallbackCompany =
    (await db.query.companies.findFirst({ where: eq(companies.slug, fallbackSlug) })) ??
    (await ensureUnverifiedIndependent());

  // Resolve the parent for auto-created brands (e.g. US LBM for its 60+ banners).
  const autoCreateParent = parsed.autoCreateChildrenOf
    ? await db.query.companies.findFirst({
        where: eq(companies.slug, slugify(parsed.autoCreateChildrenOf)),
      })
    : null;

  // Cache resolved companies by slug to avoid re-querying for repeat brands.
  const companyCache = new Map<string, typeof fallbackCompany>();
  companyCache.set(fallbackSlug, fallbackCompany);

  const relationship = parsed.autoCreateRelationship ?? "subsidiary_of";
  const isMember = relationship === "member_of";

  /**
   * Idempotently ensure an ownership edge exists between the auto-create
   * parent and the given child company. Multiple scrapes can target the same
   * yard (e.g. an LMC member that's also a Do it Best member); each scrape
   * adds its own membership edge with its own source.
   */
  async function ensureParentEdge(childCompanyId: string) {
    if (!autoCreateParent) return;
    const existingEdge = await db.query.ownershipEdges.findFirst({
      where: and(
        eq(ownershipEdges.parentId, autoCreateParent.id),
        eq(ownershipEdges.childId, childCompanyId),
        eq(ownershipEdges.relationship, relationship)
      ),
    });
    let edgeId: string;
    if (existingEdge) {
      edgeId = existingEdge.id;
    } else {
      const [edge] = await db
        .insert(ownershipEdges)
        .values({
          parentId: autoCreateParent.id,
          childId: childCompanyId,
          relationship,
          note: `Auto-created from ${parsed.consolidator} ${
            isMember ? "member directory" : "store-locator"
          } scrape.`,
        })
        .returning({ id: ownershipEdges.id });
      edgeId = edge.id;
    }
    if (parsed.autoCreateSourceUrl) {
      const src = await ensureSource(parsed.autoCreateSourceUrl);
      await db
        .insert(claimSources)
        .values({ sourceId: src.id, subjectType: "ownership_edge", subjectId: edgeId })
        .onConflictDoNothing();
    }
  }

  async function resolveCompany(row: {
    operatingCompanySlug?: string;
    operatingCompanyName?: string;
    operatingCompanyWebsite?: string;
  }) {
    const target = row.operatingCompanySlug;
    if (!target) return fallbackCompany;
    const cached = companyCache.get(target);
    if (cached) {
      // Even on cache hit we may need to add a membership edge — different
      // scrapes from different parents can land on the same yard company.
      await ensureParentEdge(cached.id);
      return cached;
    }
    const found = await db.query.companies.findFirst({ where: eq(companies.slug, target) });
    if (found) {
      companyCache.set(target, found);
      await ensureParentEdge(found.id);
      return found;
    }
    // Auto-create only when we have both a name and a parent — otherwise fall
    // back to the file-level company so we don't pollute companies with
    // partially-formed rows.
    if (!row.operatingCompanyName || !autoCreateParent) {
      companyCache.set(target, fallbackCompany);
      return fallbackCompany;
    }
    const description = isMember
      ? `Independently owned member of ${autoCreateParent.name}. Auto-created from scraped member-directory data; details await operator review.`
      : `Operates as part of ${autoCreateParent.name}'s portfolio of brands. Auto-created from scraped store-locator data; details await operator review.`;

    const [created] = await db
      .insert(companies)
      .values({
        slug: target,
        name: row.operatingCompanyName,
        type: "yard",
        website: row.operatingCompanyWebsite ?? null,
        description,
        status: "active",
      })
      .returning();
    if (parsed.autoCreateSourceUrl) {
      const src = await ensureSource(parsed.autoCreateSourceUrl);
      await db
        .insert(claimSources)
        .values({ sourceId: src.id, subjectType: "company", subjectId: created.id })
        .onConflictDoNothing();
    }
    await ensureParentEdge(created.id);
    companyCache.set(target, created);
    return created;
  }

  let inserted = 0;
  let updated = 0;
  const distinctBrands = new Set<string>();
  for (const r of parsed.rows) {
    const company = await resolveCompany(r);
    distinctBrands.add(company.slug);
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
  console.log(
    `Imported ${parsed.rows.length} rows: ${inserted} inserted, ${updated} updated. ` +
      `${distinctBrands.size} distinct operating companies seen.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
