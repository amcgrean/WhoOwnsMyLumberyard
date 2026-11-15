import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { acquisitions, claimSources, companies, locations, ownershipEdges } from "@/lib/db/schema";
import { isNonTradeName } from "@/lib/non-trade";

/**
 * Remove bulk-imported rows that aren't lumberyards or trade contractors (auto
 * shops filed under HVAC/electrical, Hog Slat, post-frame builders, pure
 * handymen...). FREE (DB only). Idempotent; pass --dry-run to list them.
 *
 *   pnpm tsx --env-file=.env.local scripts/seed/cleanup-non-trade.ts --dry-run
 *
 * The same rule (lib/non-trade.ts) now runs inside the importers, so these
 * rows won't come back on a re-import. A company left with no locations is
 * removed too, unless it owns something or appears in an acquisition.
 */

const DRY = process.argv.includes("--dry-run");
const log = (msg: string) => console.log(`${DRY ? "[dry-run] " : ""}${msg}`);

// Non-trade rows whose names the rule can't catch.
const EXTRA_SLUGS = ["eps-graettinger-ia"]; // Energy Panel Structures: post-frame building kits

async function main() {
  const all = await db
    .select({ id: locations.id, name: locations.displayName, city: locations.city, state: locations.state, trade: locations.trade, companyId: locations.companyId, companySlug: companies.slug })
    .from(locations)
    .innerJoin(companies, eq(companies.id, locations.companyId));
  const doomed = all.filter((l) => isNonTradeName(l.name) || EXTRA_SLUGS.includes(l.companySlug));
  for (const l of doomed.sort((a, b) => (a.state + a.name).localeCompare(b.state + b.name))) {
    log(`  remove [${l.trade}] ${l.name} (${l.city}, ${l.state})`);
  }
  log(`${doomed.length} non-trade location(s)`);
  if (DRY || !doomed.length) return;

  const locIds = doomed.map((l) => l.id);
  for (let i = 0; i < locIds.length; i += 200) {
    const chunk = locIds.slice(i, i + 200);
    await db.delete(claimSources).where(and(eq(claimSources.subjectType, "location"), inArray(claimSources.subjectId, chunk)));
    await db.delete(locations).where(inArray(locations.id, chunk));
  }

  // Companies left empty: drop them (and their outgoing-to-parent edges) unless
  // they own something or sit in an acquisition record.
  let removedCompanies = 0;
  for (const companyId of new Set(doomed.map((l) => l.companyId))) {
    const stillHas = await db.query.locations.findFirst({ where: eq(locations.companyId, companyId), columns: { id: true } });
    if (stillHas) continue;
    const ownsSomething = await db.query.ownershipEdges.findFirst({ where: eq(ownershipEdges.parentId, companyId), columns: { id: true } });
    const inDeal = await db.query.acquisitions.findFirst({ where: or(eq(acquisitions.acquirerId, companyId), eq(acquisitions.targetId, companyId)), columns: { id: true } });
    if (ownsSomething || inDeal) continue;
    const edges = await db.select({ id: ownershipEdges.id }).from(ownershipEdges).where(eq(ownershipEdges.childId, companyId));
    if (edges.length) {
      await db.delete(claimSources).where(and(eq(claimSources.subjectType, "ownership_edge"), inArray(claimSources.subjectId, edges.map((e) => e.id))));
      await db.delete(ownershipEdges).where(eq(ownershipEdges.childId, companyId));
    }
    await db.delete(claimSources).where(and(eq(claimSources.subjectType, "company"), eq(claimSources.subjectId, companyId)));
    await db.delete(companies).where(eq(companies.id, companyId));
    removedCompanies++;
  }
  log(`Removed ${doomed.length} location(s) and ${removedCompanies} empty compan${removedCompanies === 1 ? "y" : "ies"}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
