import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { seedBuildersFirstSource } from "./builders-firstsource";
import { seedUsLbm } from "./us-lbm";
import { seedAbcSupply } from "./abc-supply";
import { seedBeacon } from "./beacon";
import { seedSrs } from "./srs-distribution";
import { seedCarterLumber } from "./carter";
import { seedCoops } from "./coops";

/**
 * Idempotent seed entrypoint. Safe to re-run; every helper performs upserts
 * keyed on slug or natural key.
 */
async function main() {
  console.log("Seeding consolidators…");
  await seedBuildersFirstSource();
  console.log("  ✓ Builders FirstSource + BMC");
  await seedUsLbm();
  console.log("  ✓ US LBM (Bain + Platinum + Kelso history)");
  await seedAbcSupply();
  console.log("  ✓ ABC Supply + L&W + Hendricks");
  await seedBeacon();
  console.log("  ✓ Beacon Building Products");
  await seedSrs();
  console.log("  ✓ SRS Distribution (Home Depot)");
  await seedCarterLumber();
  console.log("  ✓ Carter Lumber + Holmes/Kight/Kempsville/Townsend");
  await seedCoops();
  console.log("  ✓ Co-ops (LMC, Do it Best, Ace, True Value, ENAP, LBM Advantage)");
  console.log("\nDone. All ownership edges seeded with verified=false; review and verify in Drizzle Studio.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
