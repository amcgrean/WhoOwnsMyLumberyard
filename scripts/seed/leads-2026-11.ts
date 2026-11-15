import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { and, eq, ilike } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, locations } from "@/lib/db/schema";
import { upsertCompany, upsertEdge } from "./_helpers";

/**
 * Medium-confidence leads from docs/data-review-2026-11.md that a second web
 * check confirmed. FREE (DB only). Idempotent; pass --dry-run to print the plan.
 *
 *   pnpm tsx --env-file=.env.local scripts/seed/leads-2026-11.ts --dry-run
 *
 * Holt → Apex and ServiceOne → Apex are deliberately NOT here: the only
 * evidence is shared Apex tracking code and an Apex-branded careers portal,
 * with no announcement. See the review doc's "Lead review" section.
 */

const DRY = process.argv.includes("--dry-run");
const log = (msg: string) => console.log(`${DRY ? "[dry-run] " : ""}${msg}`);

/** The single Iowa location matching name/city, or null. */
async function iaLocation(namePattern: string, city: string) {
  const rows = await db
    .select({ id: locations.id, name: locations.displayName, companyId: locations.companyId })
    .from(locations)
    .where(and(eq(locations.state, "IA"), eq(locations.city, city), ilike(locations.displayName, namePattern)));
  if (rows.length !== 1) {
    log(`  skip ${namePattern} (${city}): ${rows.length} matches`);
    return null;
  }
  return rows[0];
}

async function companyBySlug(slug: string) {
  return db.query.companies.findFirst({ where: eq(companies.slug, slug) });
}

/** Give a location's operating company an ownership parent. */
async function addOwner(namePattern: string, city: string, parentSlug: string, opts: { startDate?: string; note: string; sources: string[] }) {
  const loc = await iaLocation(namePattern, city);
  if (!loc) return;
  const parent = await companyBySlug(parentSlug);
  log(`  ${loc.name} (${city}) → owned by ${parent?.name ?? parentSlug}`);
  if (DRY || !parent) return;
  await upsertEdge({ parentId: parent.id, childId: loc.companyId, relationship: "owns", startDate: opts.startDate, note: opts.note, sources: opts.sources });
}

/** Move a duplicate location row onto the canonical company. */
async function moveTo(namePattern: string, city: string, toSlug: string) {
  const loc = await iaLocation(namePattern, city);
  const to = await companyBySlug(toSlug);
  if (!loc || !to || loc.companyId === to.id) return;
  log(`  move ${loc.name} (${city}) → ${to.name}`);
  if (DRY) return;
  await db.update(locations).set({ companyId: to.id, updatedAt: new Date() }).where(eq(locations.id, loc.id));
}

// ── 1. Merit Management Group (Johnston PE): Dorrian and Heartland ─────────
// The Business Record's Nov 2025 article names both as Merit's earlier HVAC
// acquisitions; it gives no dates for them.
async function merit() {
  log("Merit Management Group: Dorrian (Waukee), Heartland (Grimes)");
  const BR = "https://www.businessrecord.com/merit-management-group-acquires-two-central-iowa-companies/";
  await addOwner("dorrian heating%", "Waukee", "merit-management-group", {
    note: "Acquired by Merit Management Group before November 2025 (named as an earlier Merit HVAC acquisition by the Business Record).",
    sources: [BR],
  });
  await addOwner("heartland heating%", "Grimes", "merit-management-group", {
    startDate: "2025-11-15",
    note: "Acquired by Merit Management Group in 2025 (Business Record; Preqin dates it November 15, 2025).",
    sources: [BR, "https://www.preqin.com/data/profile/asset/heartland-heating---cooling/778437"],
  });
}

// ── 2. Munn Lumber (Ames) → Mead Lumber (employee-owned, Columbus NE) ──────
async function mead() {
  log("Mead Lumber: Munn Lumber Company of Ames");
  if (!DRY) {
    await upsertCompany({
      slug: "mead-lumber",
      name: "Mead Lumber",
      type: "consolidator",
      trade: "lumber",
      headquartersCity: "Columbus",
      headquartersState: "NE",
      website: "https://meadlumber.com",
      description:
        "Employee-owned lumber and building-materials dealer headquartered in Columbus, Nebraska, with yards across the Plains and Midwest. Not private-equity owned. Bought H.L. Munn Lumber of Ames in 2018, its first Iowa yard.",
      status: "active",
    });
  }
  await addOwner("munn lumber%", "Ames", "mead-lumber", {
    startDate: "2018-01-01",
    note: "Mead Lumber agreed to acquire H.L. Munn Lumber of Ames in 2018; the Munn name and management were retained.",
    sources: ["https://www.businessrecord.com/?p=8498", "https://meadlumber.com/?p=3291", "https://hbsdealer.com/lumberyards/mead-lumber-grows-in-iowa"],
  });
}

// ── 3. CW Suter Services (ESOP) duplicate rows → the canonical company ─────
async function suter() {
  log("CW Suter Services duplicates");
  await moveTo("derocher services%cw suter%", "Sioux City", "cw-suter-services");
  await moveTo("cw suter services", "Spencer", "cw-suter-services");
}

// ── 4. Manufacturer sites filed as contractors → their public parents ──────
// Not contractors, but certainly not independents: owned by public companies.
async function manufacturers() {
  log("Trane / Lennox sites → public parents");
  if (!DRY) {
    await upsertCompany({
      slug: "trane-technologies",
      name: "Trane Technologies",
      type: "public_company",
      ticker: "TT",
      trade: "hvac",
      headquartersCity: "Swords",
      website: "https://www.tranetechnologies.com",
      description: "Publicly traded HVAC manufacturer (NYSE: TT); maker of Trane and American Standard equipment.",
      status: "active",
    });
    await upsertCompany({
      slug: "lennox-international",
      name: "Lennox International",
      type: "public_company",
      ticker: "LII",
      trade: "hvac",
      headquartersCity: "Richardson",
      headquartersState: "TX",
      website: "https://www.lennoxinternational.com",
      description: "Publicly traded HVAC manufacturer (NYSE: LII). Its Marshalltown, Iowa plant is a manufacturing site, not a contractor.",
      status: "active",
    });
  }
  const TRANE = { note: "Trane Commercial sales office of Trane Technologies (NYSE: TT); not an independent contractor.", sources: ["https://www.tranetechnologies.com"] };
  const LENNOX = { note: "Lennox International (NYSE: LII) facility; not an independent contractor.", sources: ["https://www.lennoxinternational.com"] };
  await addOwner("trane commercial%", "Cedar Rapids", "trane-technologies", TRANE);
  await addOwner("trane commercial%", "Davenport", "trane-technologies", TRANE);
  await addOwner("lennox", "Clinton", "lennox-international", LENNOX);
  await addOwner("lennox nadc", "Marshalltown", "lennox-international", LENNOX);
}

async function main() {
  await merit();
  await mead();
  await suter();
  await manufacturers();
  log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
