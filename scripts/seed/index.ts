import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { seedBuildersFirstSource } from "./builders-firstsource";
import { seedUsLbm } from "./us-lbm";
import { seedAbcSupply } from "./abc-supply";
import { seedBeacon } from "./beacon";
import { seedSrs } from "./srs-distribution";
import { seedCarterLumber } from "./carter";
import { seed84Lumber } from "./eighty-four-lumber";
import { seedGms } from "./gms";
import { seedBoiseCascade } from "./boise-cascade";
import { seedCoops } from "./coops";
import { seedNationalHomeServices } from "./national-home-services";
import { seedIowaHomeServices } from "./iowa-home-services";
import { seedIowaIndependents } from "./iowa-independents";
import { seedIowaIndependentsMore } from "./iowa-independents-more";
import { seedTradeCoops } from "./trade-coops";

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
  await seed84Lumber();
  console.log("  ✓ 84 Lumber + Hardy Family");
  await seedGms();
  console.log("  ✓ GMS Inc.");
  await seedBoiseCascade();
  console.log("  ✓ Boise Cascade");
  await seedCoops();
  console.log("  ✓ Co-ops (LMC, Do it Best, Ace, True Value, ENAP, LBM Advantage)");

  console.log("\nSeeding home-services trades…");
  await seedNationalHomeServices();
  console.log("  ✓ National PE-backed HVAC/plumbing/electrical roll-ups");
  await seedIowaHomeServices();
  console.log("  ✓ Iowa PE-owned home-services brands (TurnPoint, PremiStar, ARS)");
  await seedIowaIndependents();
  console.log("  ✓ Iowa independents (Des Moines, Sioux City, Quad Cities, Dubuque, Ames, Waterloo, Ottumwa, Mason City)");
  await seedIowaIndependentsMore();
  console.log("  ✓ Iowa independents, statewide batch 2 (Muscatine, Clinton, Keokuk, Carroll, Le Mars, Spencer, Boone, Grinnell, Pella + more)");
  await seedTradeCoops();
  console.log("  ✓ Member-owned trade buying groups (Nexstar, IMARK, Blue Hawk, AD)");

  console.log("\nDone. All ownership edges seeded with verified=false; review and verify in Drizzle Studio.");
  console.log("New trade locations have no coordinates yet — run `pnpm geocode:missing` to place them on the map.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
