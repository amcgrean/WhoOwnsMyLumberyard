import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { upsertCompany, upsertEdge, linkSource } from "./_helpers";

const HD_CLOSE =
  "https://corporate.homedepot.com/news/company/home-depot-and-its-subsidiary-srs-distribution-complete-acquisition-gms";

/**
 * GMS Inc.
 *
 * GMS (formerly NYSE: GMS) is a leading North American specialty building products
 * distributor of wallboard, suspended ceilings systems, steel framing, and
 * complementary construction products. Headquartered in Tucker, GA, formed
 * out of Gypsum Management & Supply. Operates dozens of regional banners
 * preserved on signage from acquired companies — those are auto-created on
 * import as subsidiaries of GMS Inc.
 *
 * Home Depot completed its acquisition of GMS through its subsidiary SRS
 * Distribution on 2025-09-04; GMS is now a direct subsidiary of SRS and an
 * indirect wholly owned subsidiary of The Home Depot. Verified 2026-11.
 * Run after seedSrs() so the SRS company exists.
 *
 * NOTE: All ownership edges seeded here start with verified=false.
 */
export async function seedGms() {
  // SOURCE: https://www.gms.com/about/our-company/
  const co = await upsertCompany({
    name: "GMS Inc.",
    legalName: "GMS Inc.",
    type: "consolidator",
    ticker: null,
    headquartersCity: "Tucker",
    headquartersState: "GA",
    website: "https://gms.com",
    foundedYear: 1971,
    description:
      "A leading North American specialty distributor of wallboard, suspended ceilings systems, steel framing, and complementary construction products. Acquired by The Home Depot through SRS Distribution in September 2025 (previously NYSE: GMS). Operates more than 70 regional banners across the United States and Canada, preserved on signage post-acquisition.",
    notes:
      "Operating banners include Cowtown Materials, Capitol Building Supply, Capitol Materials, Watson Building Supplies, Shoemaker Drywall Supplies, Slegg Building Materials, and many others. All operate under GMS Inc. ownership.",
    status: "active",
  });

  await linkSource(
    {
      url: "https://www.gms.com/about/our-company/",
      title: "GMS Inc. — Our Company",
      publication: "GMS Inc.",
    },
    "company",
    co.id
  );

  const srs = await db.query.companies.findFirst({ where: eq(companies.slug, "srs-distribution") });
  if (srs) {
    await upsertEdge({
      parentId: srs.id,
      childId: co.id,
      relationship: "subsidiary_of",
      startDate: "2025-09-04",
      stakePct: "100",
      sources: [HD_CLOSE],
      quote: "The Home Depot and its subsidiary SRS Distribution complete acquisition of GMS",
    });
  } else {
    console.warn("  ! SRS Distribution not seeded yet — run seedSrs() before seedGms()");
  }

  return { co };
}
