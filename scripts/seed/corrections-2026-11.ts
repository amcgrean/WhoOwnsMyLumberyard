import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { and, eq, ilike, inArray, isNull, notInArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { claimSources, companies, locations, ownershipEdges, sources } from "@/lib/db/schema";
import { slugify } from "@/lib/slug";
import { upsertCompany, upsertEdge, linkSource } from "./_helpers";
import { UNVERIFIED_COMPANY_SLUG } from "@/lib/ownership-kind";

/**
 * Data corrections from the 2026-11 web-validation review. FREE (DB only).
 * Idempotent; safe to re-run. Pass --dry-run to print the plan without writing.
 *
 *   pnpm tsx --env-file=.env.local scripts/seed/corrections-2026-11.ts --dry-run
 *
 * Covers rows that live only in the production database (bulk imports). The
 * curated fixes (Beacon → QXO, GMS → SRS/Home Depot, US LBM/Platinum dates,
 * Horizon date) are in the seed files themselves so `pnpm seed` won't revert
 * them — run `pnpm seed` too. Only high-confidence findings are applied here;
 * medium-confidence leads are listed in the PR for human review.
 */

const DRY = process.argv.includes("--dry-run");
const log = (msg: string) => console.log(`${DRY ? "[dry-run] " : ""}${msg}`);

// ── 1. Dead / fabricated source URLs to unlink ────────────────────────────
const DEAD_SOURCES = [
  // Never existed — the real release is linked from the US LBM seed now.
  "https://www.platinumequity.com/news/platinum-equity-and-bain-capital-private-equity-announce-strategic-partnership-to-co-own-us-lbm",
  "https://www.uslbm.com/news/bain-capital-private-equity-completes-acquisition-of-us-lbm/",
  "https://www.becn.com/our-company",
];

async function unlinkDeadSources() {
  const rows = await db.select({ id: sources.id, url: sources.url }).from(sources).where(inArray(sources.url, DEAD_SOURCES));
  for (const r of rows) {
    log(`unlink dead source ${r.url}`);
    if (!DRY) {
      await db.delete(claimSources).where(eq(claimSources.sourceId, r.id));
      await db.delete(sources).where(eq(sources.id, r.id));
    }
  }
}

async function companyBySlug(slug: string) {
  return db.query.companies.findFirst({ where: eq(companies.slug, slug) });
}

// Co-op membership and franchise affiliation are not ownership.
async function hasOwnershipParent(companyId: string): Promise<boolean> {
  const e = await db.query.ownershipEdges.findFirst({
    where: and(
      eq(ownershipEdges.childId, companyId),
      isNull(ownershipEdges.endDate),
      notInArray(ownershipEdges.relationship, ["member_of", "franchise_of"]),
    ),
  });
  return Boolean(e);
}

async function moveLocation(locId: string, label: string, toCompanyId: string, sourceUrl?: string) {
  const cur = await db.query.locations.findFirst({ where: eq(locations.id, locId), columns: { companyId: true } });
  if (cur?.companyId === toCompanyId) return; // already correct — keeps re-runs quiet
  log(`  move ${label}`);
  if (DRY) return;
  await db.update(locations).set({ companyId: toCompanyId, updatedAt: new Date() }).where(eq(locations.id, locId));
  if (sourceUrl) await linkSource({ url: sourceUrl }, "location", locId);
}

// ── 2. Tri-City Electric → Tri-City Group → Quanta Services (public) ──────
async function triCity() {
  const QUANTA = "https://www.quantaservices.com/companies/tri-city-group";
  const KS = "https://www.kslaw.com/news-and-insights/quanta-services-acquires-tri-city-group";
  const locs = await db
    .select({ id: locations.id, name: locations.displayName, city: locations.city })
    .from(locations)
    .where(and(eq(locations.state, "IA"), or(ilike(locations.displayName, "tri-city electric%"), ilike(locations.displayName, "tri city electric%"))));
  log(`Tri-City Electric: ${locs.length} Iowa location(s)`);
  if (!locs.length || DRY) {
    for (const l of locs) log(`  move ${l.name} (${l.city}) → Tri-City Group (Quanta Services)`);
    return;
  }
  const quanta = await upsertCompany({
    slug: "quanta-services",
    name: "Quanta Services",
    type: "public_company",
    ticker: "PWR",
    headquartersCity: "Houston",
    headquartersState: "TX",
    website: "https://www.quantaservices.com",
    description: "Publicly traded specialty contractor (NYSE: PWR). Acquired Tri-City Group (Tri-City Electric) in Q4 2025.",
    status: "active",
  });
  const group = await upsertCompany({
    slug: "tri-city-group",
    name: "Tri-City Group (Tri-City Electric)",
    type: "consolidator",
    trade: "electrical",
    headquartersCity: "Davenport",
    headquartersState: "IA",
    description: "Electrical contractor (Tri-City Electric Co.) acquired by Quanta Services in Q4 2025; operates under the Tri-City name.",
    status: "active",
  });
  await upsertEdge({ parentId: quanta.id, childId: group.id, relationship: "owns", sources: [QUANTA, KS], note: "Quanta Services acquired Tri-City Group in Q4 2025 (disclosed February 2026)." });
  for (const l of locs) await moveLocation(l.id, `${l.name} (${l.city}) → Tri-City Group`, group.id, QUANTA);
}

// ── 3. Metro Heating & Cooling (Des Moines) → Merit Management Group (PE) ─
async function metroHeating() {
  const BR = "https://www.businessrecord.com/merit-management-group-acquires-two-central-iowa-companies/";
  const locs = await db
    .select({ id: locations.id, name: locations.displayName, city: locations.city, companyId: locations.companyId })
    .from(locations)
    .where(and(eq(locations.state, "IA"), ilike(locations.displayName, "metro heating%"), inArray(locations.city, ["Des Moines", "West Des Moines", "Urbandale", "Ankeny"])));
  log(`Metro Heating & Cooling: ${locs.length} location(s)`);
  if (!locs.length) return;
  for (const l of locs) log(`  ${l.name} (${l.city}) → owned by Merit Management Group`);
  if (DRY) return;
  const merit = await upsertCompany({
    slug: "merit-management-group",
    name: "Merit Management Group",
    type: "pe_firm",
    headquartersCity: "Johnston",
    headquartersState: "IA",
    description: "Johnston, Iowa private-equity firm acquiring central-Iowa trades businesses (per the Business Record, 2025).",
    status: "active",
  });
  const metro = await upsertCompany({
    slug: "metro-heating-and-cooling-des-moines",
    name: "Metro Heating & Cooling",
    type: "yard",
    trade: "hvac",
    headquartersCity: "Des Moines",
    headquartersState: "IA",
    description: "Des Moines HVAC company acquired by Merit Management Group, a Johnston private-equity firm, in November 2025.",
    status: "active",
  });
  await upsertEdge({ parentId: merit.id, childId: metro.id, relationship: "owns", sources: [BR], note: "Acquired by Merit Management Group in November 2025." });
  for (const l of locs) await moveLocation(l.id, `${l.name} (${l.city}) → Metro Heating & Cooling`, metro.id, BR);
}

// ── 4. Unlinked duplicates of curated PE-owned brands (Iowa) ──────────────
const BRAND_DUPES: Array<{ pattern: string; city?: string[]; companySlug: string }> = [
  { pattern: "%schaal%", companySlug: "schaal-plumbing-heating-and-cooling" },
  { pattern: "bell brothers%", companySlug: "bell-brothers-heating-and-air-conditioning" },
  { pattern: "green's appliance%", companySlug: "green-s-appliance-heating-and-cooling" },
  { pattern: "mechanical service%", city: ["Iowa City"], companySlug: "mechanical-service-inc" },
];

async function relinkBrandDupes() {
  for (const d of BRAND_DUPES) {
    const target = await companyBySlug(d.companySlug);
    if (!target) {
      log(`skip ${d.companySlug}: curated company not found (run pnpm seed first)`);
      continue;
    }
    const conds = [eq(locations.state, "IA"), ilike(locations.displayName, d.pattern)];
    if (d.city) conds.push(inArray(locations.city, d.city));
    const locs = await db
      .select({ id: locations.id, name: locations.displayName, city: locations.city, companyId: locations.companyId })
      .from(locations)
      .where(and(...conds));
    for (const l of locs) {
      if (l.companyId === target.id) continue;
      // Only re-parent rows that aren't already attached to an owned company.
      if (await hasOwnershipParent(l.companyId)) continue;
      await moveLocation(l.id, `${l.name} (${l.city}) → ${target.name}`, target.id);
    }
  }
}

// ── 5. Lampert Lumber, Webster City duplicate → the US LBM-owned row ──────
async function lampertDupe() {
  const locs = await db
    .select({ id: locations.id, name: locations.displayName, companyId: locations.companyId })
    .from(locations)
    .where(and(eq(locations.state, "IA"), eq(locations.city, "Webster City"), ilike(locations.displayName, "lampert%")));
  if (!locs.length) return;
  // Webster City is a US LBM (Lampert Lumber) yard; a Do it Best membership
  // listing for the same store is not a separate owner.
  const lampert = await db.query.companies.findFirst({ where: eq(companies.slug, "lampert-lumber"), columns: { id: true } });
  if (!lampert || !(await hasOwnershipParent(lampert.id))) return;
  const owned = lampert.id;
  for (const l of locs) if (l.companyId !== owned) await moveLocation(l.id, `${l.name} (Webster City) → US LBM-owned Lampert company`, owned);
}

// ── 6. Name-identified franchisees still in the unverified bucket ─────────
type Brand = { slug: string; name: string; trade: "plumbing" | "electrical" | "hvac"; parent?: string; match: string[] };
const BRANDS: Brand[] = [
  { slug: "roto-rooter", name: "Roto-Rooter", trade: "plumbing", parent: "chemed", match: ["roto-rooter%", "roto rooter%"] },
  { slug: "one-hour-heating-air-conditioning", name: "One Hour Heating & Air Conditioning", trade: "hvac", parent: "authority-brands", match: ["one hour heating%", "one hour air%"] },
  { slug: "benjamin-franklin-plumbing", name: "Benjamin Franklin Plumbing", trade: "plumbing", parent: "authority-brands", match: ["benjamin franklin plumbing%"] },
  { slug: "mister-sparky", name: "Mister Sparky", trade: "electrical", parent: "authority-brands", match: ["mister sparky%"] },
  { slug: "mr-rooter", name: "Mr. Rooter Plumbing", trade: "plumbing", parent: "neighborly", match: ["mr. rooter%", "mr rooter%"] },
  { slug: "mr-electric", name: "Mr. Electric", trade: "electrical", parent: "neighborly", match: ["mr. electric%", "mr electric%", "mr.electric%"] },
  { slug: "aire-serv", name: "Aire Serv", trade: "hvac", parent: "neighborly", match: ["aire serv%", "aire-serv%"] },
  { slug: "1-tom-plumber", name: "1-Tom-Plumber", trade: "plumbing", match: ["1-tom-plumber%", "1 tom plumber%"] },
];

async function ensureParents() {
  // Authority Brands → Apax and Neighborly → KKR also come from the franchise
  // seeds; upserting here keeps this script self-contained.
  const apax = await upsertCompany({ slug: "apax-partners", name: "Apax Partners", type: "pe_firm", headquartersCity: "London", description: "Global private-equity firm; owner of Authority Brands." });
  const authority = await upsertCompany({ slug: "authority-brands", name: "Authority Brands", type: "consolidator", headquartersCity: "Columbia", headquartersState: "MD", description: "Home-services franchisor (One Hour Heating & Air Conditioning, Benjamin Franklin Plumbing, Mister Sparky, and others). Owned by Apax Partners." });
  await upsertEdge({ parentId: apax.id, childId: authority.id, relationship: "owns", sources: ["https://www.authoritybrands.com"] });
  const kkr = await upsertCompany({ slug: "kkr", name: "KKR", type: "pe_firm", headquartersCity: "New York", headquartersState: "NY", description: "Global private-equity firm; majority owner of Neighborly since 2021." });
  const neighborly = await upsertCompany({ slug: "neighborly", name: "Neighborly", type: "consolidator", headquartersCity: "Waco", headquartersState: "TX", description: "Home-services franchisor (Mr. Rooter, Mr. Electric, Aire Serv, and others). Majority-owned by KKR since 2021." });
  await upsertEdge({ parentId: kkr.id, childId: neighborly.id, relationship: "owns", sources: ["https://www.neighborlybrands.com"] });
  await upsertCompany({ slug: "chemed", name: "Chemed Corporation", type: "public_company", ticker: "CHE", headquartersCity: "Cincinnati", headquartersState: "OH", website: "https://www.chemed.com", description: "Publicly traded parent of Roto-Rooter (NYSE: CHE). Roto-Rooter operates company-owned branches and independently owned franchises." });
}

async function linkFranchisees() {
  const bucket = await companyBySlug(UNVERIFIED_COMPANY_SLUG);
  if (!bucket) return log("no unverified bucket — nothing to link");
  if (!DRY) await ensureParents();
  for (const b of BRANDS) {
    const locs = await db
      .select({ id: locations.id, name: locations.displayName, city: locations.city, state: locations.state, website: locations.website, sourceUrl: locations.sourceUrl })
      .from(locations)
      .where(and(eq(locations.companyId, bucket.id), or(...b.match.map((m) => ilike(locations.displayName, m)))));
    if (!locs.length) continue;
    log(`${b.name}: ${locs.length} franchise location(s)`);
    if (DRY) {
      for (const l of locs) log(`  ${l.name} (${l.city}, ${l.state}) → franchise of ${b.name}`);
      continue;
    }
    const brand = await upsertCompany({
      slug: b.slug,
      name: b.name,
      type: "consolidator",
      trade: b.trade,
      description: `National ${b.trade} franchise brand. Local franchisees are independently owned and operated under the brand.`,
    });
    if (b.parent) {
      const parent = await companyBySlug(b.parent);
      if (parent) await upsertEdge({ parentId: parent.id, childId: brand.id, relationship: "owns" });
    }
    for (const l of locs) {
      const co = await upsertCompany({
        slug: slugify(`${l.name} ${l.city}`),
        name: l.name,
        type: "yard",
        trade: b.trade,
        headquartersCity: l.city,
        headquartersState: l.state,
        website: l.website,
        description: `Operates under the ${b.name} brand as a franchise location. Identified by its business name; the brand's own site lists franchise locations.`,
      });
      const src = l.website ?? l.sourceUrl ?? undefined;
      await upsertEdge({ parentId: brand.id, childId: co.id, relationship: "franchise_of", sources: src ? [src] : [] });
      await moveLocation(l.id, `${l.name} (${l.city}, ${l.state}) → franchise of ${b.name}`, co.id);
    }
  }
}

async function main() {
  await unlinkDeadSources();
  await triCity();
  await metroHeating();
  await relinkBrandDupes();
  await lampertDupe();
  await linkFranchisees();
  log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
