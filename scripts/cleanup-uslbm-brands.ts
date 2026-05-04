import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";

/**
 * One-off cleanup for US LBM brand companies whose name and slug were
 * auto-derived from a website hostname. Maps the auto-generated slug to a
 * cleaner human-friendly name + slug.
 *
 * Idempotent: re-running on already-clean rows is a no-op (the WHERE matches
 * the old slug only). Safe to re-run.
 */

const RENAMES: Array<{ oldSlug: string; newSlug: string; newName: string }> = [
  { oldSlug: "apiebs", newSlug: "api-ebs", newName: "API EBS" },
  { oldSlug: "arrowheadstairs", newSlug: "arrowhead-stairs", newName: "Arrowhead Stairs" },
  { oldSlug: "bellevuebuilders", newSlug: "bellevue-builders-supply", newName: "Bellevue Builders Supply" },
  { oldSlug: "betterbuilttruss", newSlug: "better-built-truss", newName: "Better Built Truss" },
  {
    oldSlug: "breckenridgebuildingcenter",
    newSlug: "breckenridge-building-center",
    newName: "Breckenridge Building Center",
  },
  { oldSlug: "darbydoors", newSlug: "darby-doors", newName: "Darby Doors" },
  { oldSlug: "desertlbm", newSlug: "desert-lbm", newName: "Desert LBM" },
  { oldSlug: "eaglecreeksiding", newSlug: "eagle-creek-siding", newName: "Eagle Creek Siding" },
  {
    oldSlug: "edwardsbuildingcenter",
    newSlug: "edwards-building-center",
    newName: "Edwards Building Center",
  },
  { oldSlug: "evergreenlumber", newSlug: "evergreen-lumber", newName: "Evergreen Lumber" },
  {
    oldSlug: "juniorsbuildingmaterials",
    newSlug: "juniors-building-materials",
    newName: "Junior's Building Materials",
  },
  { oldSlug: "meeksmidwest", newSlug: "meeks-midwest", newName: "Meek's Midwest" },
  { oldSlug: "meekswest", newSlug: "meeks-west", newName: "Meek's West" },
  { oldSlug: "oldhamlumber", newSlug: "oldham-lumber", newName: "Oldham Lumber" },
  { oldSlug: "raks", newSlug: "raks-building-supply", newName: "RAKS Building Supply" },
  { oldSlug: "southendexteriors", newSlug: "south-end-exteriors", newName: "South End Exteriors" },
  { oldSlug: "texasbuildingsupply", newSlug: "texas-building-supply", newName: "Texas Building Supply" },
];

async function main() {
  let updated = 0;
  let skipped = 0;
  for (const r of RENAMES) {
    const existing = await db.query.companies.findFirst({ where: eq(companies.slug, r.oldSlug) });
    if (!existing) {
      // Already migrated, or never existed.
      const already = await db.query.companies.findFirst({ where: eq(companies.slug, r.newSlug) });
      if (already) console.log(`  - ${r.oldSlug} → already at ${r.newSlug}`);
      else console.log(`  - ${r.oldSlug} → not found`);
      skipped++;
      continue;
    }
    await db
      .update(companies)
      .set({ slug: r.newSlug, name: r.newName, updatedAt: new Date() })
      .where(eq(companies.id, existing.id));
    console.log(`  ✓ ${r.oldSlug.padEnd(30)} → ${r.newSlug.padEnd(30)}  ${r.newName}`);
    updated++;
  }
  console.log(`\nRenamed ${updated} companies. Skipped ${skipped} already-clean rows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
