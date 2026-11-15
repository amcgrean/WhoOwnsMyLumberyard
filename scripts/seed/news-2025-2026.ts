import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { readFileSync } from "node:fs";
import { and, eq, isNull, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, locations, ownershipEdges, type CompanyType, type Trade } from "@/lib/db/schema";
import { slugify } from "@/lib/slug";
import { linkSource, upsertAcquisition, upsertEdge } from "./_helpers";

/**
 * Load the 2025–2026 acquisitions backfill (data/news-2025-2026.json) into the
 * acquisitions table that powers /news. FREE (DB only). Idempotent; pass
 * --dry-run to print the plan.
 *
 *   pnpm tsx --env-file=.env.local scripts/seed/news-2025-2026.ts --dry-run
 *
 * Conservative by design:
 * - Existing companies are matched by slug or exact name and never modified.
 * - Missing companies are created with only the facts in the file.
 * - An ownership edge is added only for a closed, controlling deal whose target
 *   has no current owner on record; minority stakes and pending deals only get
 *   the acquisition record.
 */

const DRY = process.argv.includes("--dry-run");
const log = (msg: string) => console.log(`${DRY ? "[dry-run] " : ""}${msg}`);

type Party = { name: string; slug?: string; type?: CompanyType; ticker?: string | null; hqCity?: string | null; hqState?: string | null; website?: string | null; trade?: Trade | null };
type Deal = {
  acquirer: Party;
  acquirerOwner?: Party | null;
  target: Party;
  announcedDate: string | null;
  closedDate: string | null;
  dealValueUsd: number | null;
  summary: string;
  minority?: boolean;
  sources: Array<{ url: string; title?: string; publication?: string; publishedDate?: string | null }>;
};

const NOT_OWNERSHIP = ["member_of", "franchise_of"] as const;

/**
 * Exact slug only: \`slug\` in the data file pins a party to an existing record
 * (or names a new canonical one). No fuzzy name matching, which would attach
 * deals to a single branch row of a multi-location company.
 */
async function findCompany(p: Party) {
  return db.query.companies.findFirst({ where: eq(companies.slug, partySlug(p)) });
}

function partySlug(p: Party) {
  return p.slug ?? slugify(p.name);
}

/** Existing company, or a new one with just the facts given. */
async function ensureCompany(p: Party, fallbackType: CompanyType) {
  const found = await findCompany(p);
  if (found) return { company: found, created: false };
  const values = {
    slug: partySlug(p),
    name: p.name,
    type: p.type ?? fallbackType,
    ticker: p.ticker ?? null,
    trade: p.trade ?? null,
    headquartersCity: p.hqCity ?? null,
    headquartersState: p.hqState ?? null,
    website: p.website ?? null,
    status: "active" as const,
  };
  if (DRY) return { company: { id: `dry-${values.slug}`, ...values }, created: true };
  const [created] = await db.insert(companies).values(values).returning();
  return { company: created, created: true };
}

async function hasOwner(companyId: string) {
  const e = await db.query.ownershipEdges.findFirst({
    where: and(eq(ownershipEdges.childId, companyId), isNull(ownershipEdges.endDate), notInArray(ownershipEdges.relationship, [...NOT_OWNERSHIP])),
  });
  return Boolean(e);
}

async function main() {
  const deals: Deal[] = JSON.parse(readFileSync("data/news-2025-2026.json", "utf8"));
  let edges = 0;
  for (const d of deals) {
    const acq = await ensureCompany(d.acquirer, "consolidator");
    const tgt = await ensureCompany(d.target, "yard");
    // A company first created as a deal's target may turn up later as a buyer
    // (Flint Group, Kodiak): give it the buyer's type if it has no locations.
    if (!acq.created && !DRY && acq.company.type === "yard" && d.acquirer.type && d.acquirer.type !== "yard") {
      const hasLoc = await db.query.locations.findFirst({ where: eq(locations.companyId, acq.company.id), columns: { id: true } });
      if (!hasLoc) await db.update(companies).set({ type: d.acquirer.type, updatedAt: new Date() }).where(eq(companies.id, acq.company.id));
    }
    if (d.acquirerOwner && (acq.created || (!DRY && !(await hasOwner(acq.company.id))))) {
      const owner = await ensureCompany(d.acquirerOwner, "pe_firm");
      log(`  + ${d.acquirerOwner.name} owns ${d.acquirer.name}`);
      if (!DRY) await upsertEdge({ parentId: owner.company.id, childId: acq.company.id, relationship: "controls", note: `${d.acquirerOwner.name} is the controlling owner of ${d.acquirer.name}.` });
    }
    const year = (d.closedDate ?? d.announcedDate ?? "").slice(0, 4);
    const slug = `${acq.company.slug}-acquires-${tgt.company.slug}-${year}`;
    log(`${d.closedDate ?? d.announcedDate} ${d.acquirer.name} → ${d.target.name}${d.closedDate ? "" : " (pending)"}${acq.created ? " [new buyer]" : ""}${tgt.created ? " [new target]" : ""}`);
    if (DRY) continue;
    const { id } = await upsertAcquisition({
      slug,
      acquirerId: acq.company.id,
      targetId: tgt.company.id,
      announcedDate: d.announcedDate,
      closedDate: d.closedDate,
      dealValueUsd: d.dealValueUsd != null ? BigInt(Math.round(d.dealValueUsd)) : null,
      summary: d.summary,
    });
    for (const s of d.sources) {
      await linkSource({ url: s.url, title: s.title, publication: s.publication, publishedDate: s.publishedDate ?? undefined }, "acquisition", id);
    }
    if (d.closedDate && !d.minority && !(await hasOwner(tgt.company.id))) {
      await upsertEdge({
        parentId: acq.company.id,
        childId: tgt.company.id,
        relationship: "owns",
        startDate: d.closedDate,
        note: d.summary,
        sources: d.sources.map((s) => s.url),
      });
      edges++;
    }
  }
  log(`${deals.length} deal(s); ${edges} new ownership edge(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
