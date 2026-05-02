import { upsertCompany, upsertEdge, upsertAcquisition } from "./_helpers";

/**
 * SRS Distribution
 *
 * National distributor of roofing, landscaping, building, and pool supplies,
 * headquartered in McKinney, TX. The Home Depot announced an agreement to
 * acquire SRS in March 2024 and closed the transaction on June 18, 2024.
 *
 * NOTE: All ownership edges seeded here start with verified=false.
 */
export async function seedSrs() {
  // SOURCE: https://www.srsdistribution.com/about/
  const srs = await upsertCompany({
    name: "SRS Distribution",
    legalName: "SRS Distribution Inc.",
    type: "consolidator",
    headquartersCity: "McKinney",
    headquartersState: "TX",
    website: "https://www.srsdistribution.com",
    foundedYear: 2008,
    description:
      "Residential specialty trade distributor serving roofing, landscaping, pool, and other building-products end markets, with a national footprint built primarily through acquisition.",
    notes:
      "SRS preserves dozens of legacy local-brand banners across its branch network, including Heritage Landscape Supply Group, Roofline Supply & Delivery, Suncoast Roofers Supply, and others.",
    status: "active",
  });

  // SOURCE: https://corporate.homedepot.com/news/business/home-depot-completes-acquisition-srs-distribution
  const homeDepot = await upsertCompany({
    name: "The Home Depot",
    legalName: "The Home Depot, Inc.",
    type: "public_company",
    ticker: "HD",
    headquartersCity: "Atlanta",
    headquartersState: "GA",
    website: "https://corporate.homedepot.com",
    foundedYear: 1978,
    description:
      "The world's largest home-improvement retailer. In June 2024 closed the acquisition of SRS Distribution, expanding its reach into the residential professional-trade distribution channel.",
    status: "active",
  });

  await upsertAcquisition({
    slug: "home-depot-srs-2024",
    acquirerId: homeDepot.id,
    targetId: srs.id,
    announcedDate: "2024-03-28",
    closedDate: "2024-06-18",
    summary:
      "The Home Depot completed the acquisition of SRS Distribution. SRS continues to operate under its existing brand within Home Depot.",
    sources: [
      "https://corporate.homedepot.com/news/business/home-depot-completes-acquisition-srs-distribution",
    ],
  });

  await upsertEdge({
    parentId: homeDepot.id,
    childId: srs.id,
    relationship: "subsidiary_of",
    startDate: "2024-06-18",
    note: "SRS Distribution operates as a subsidiary of The Home Depot following the June 2024 acquisition close.",
    sources: [
      "https://corporate.homedepot.com/news/business/home-depot-completes-acquisition-srs-distribution",
    ],
  });

  return { srs, homeDepot };
}
