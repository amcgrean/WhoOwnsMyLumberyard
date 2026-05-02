import { upsertCompany, upsertEdge, upsertAcquisition } from "./_helpers";

/**
 * US LBM
 *
 * Private consolidator headquartered in Atlanta, GA, formed in 2009.
 * In late 2020, Bain Capital Private Equity announced an agreement to acquire
 * US LBM from Kelso & Company. Bain closed the acquisition in December 2020.
 * In December 2021, Bain Capital and Platinum Equity announced an agreement
 * for Platinum Equity to take a co-control stake; that closed in early 2022.
 *
 * NOTE: All ownership edges seeded here start with verified=false.
 */
export async function seedUsLbm() {
  // SOURCE: https://www.uslbm.com/about-us/
  const usLbm = await upsertCompany({
    name: "US LBM",
    legalName: "US LBM Holdings, LLC",
    type: "consolidator",
    headquartersCity: "Atlanta",
    headquartersState: "GA",
    website: "https://www.uslbm.com",
    foundedYear: 2009,
    description:
      "A national distributor of specialty building materials operating across the United States. Has grown primarily through acquisition since founding in 2009 and operates through dozens of legacy local-brand divisions.",
    notes:
      "Operates legacy banners including Wallboard Supply, Universal Supply, Edward Hines Lumber, Feldman Lumber, Coleman Floor, Loyalty Building Solutions, Trussway, Total Quality Lumber, and many others. Many local brands are preserved on signage post-acquisition.",
    status: "active",
  });

  // SOURCE: https://www.baincapital.com/
  const bain = await upsertCompany({
    name: "Bain Capital",
    legalName: "Bain Capital Private Equity, LP",
    type: "pe_firm",
    headquartersCity: "Boston",
    headquartersState: "MA",
    website: "https://www.baincapital.com",
    description:
      "Global private investment firm; sponsor of one of the largest U.S. private-equity portfolios. Acquired US LBM from Kelso & Company in 2020.",
  });

  // SOURCE: https://www.platinumequity.com/news/platinum-equity-and-bain-capital-private-equity-announce-strategic-partnership-to-co-own-us-lbm
  const platinum = await upsertCompany({
    name: "Platinum Equity",
    legalName: "Platinum Equity, LLC",
    type: "pe_firm",
    headquartersCity: "Beverly Hills",
    headquartersState: "CA",
    website: "https://www.platinumequity.com",
    description:
      "Global private investment firm founded by Tom Gores. Co-control investor in US LBM alongside Bain Capital since 2022.",
  });

  // SOURCE: https://www.kelso.com/
  const kelso = await upsertCompany({
    name: "Kelso & Company",
    legalName: "Kelso & Company, L.P.",
    type: "pe_firm",
    headquartersCity: "New York",
    headquartersState: "NY",
    website: "https://www.kelso.com",
    description:
      "Private equity firm; previous majority owner of US LBM until the December 2020 sale to Bain Capital.",
    status: "active",
  });

  // Acquisitions
  // SOURCE: https://www.uslbm.com/news/bain-capital-private-equity-completes-acquisition-of-us-lbm/
  await upsertAcquisition({
    slug: "bain-acquires-us-lbm-2020",
    acquirerId: bain.id,
    targetId: usLbm.id,
    announcedDate: "2020-08-13",
    closedDate: "2020-12-22",
    summary:
      "Bain Capital Private Equity completed the acquisition of US LBM from Kelso & Company.",
    sources: [
      "https://www.uslbm.com/news/bain-capital-private-equity-completes-acquisition-of-us-lbm/",
    ],
  });

  // SOURCE: https://www.platinumequity.com/news/platinum-equity-and-bain-capital-private-equity-announce-strategic-partnership-to-co-own-us-lbm
  await upsertAcquisition({
    slug: "platinum-coinvest-us-lbm-2022",
    acquirerId: platinum.id,
    targetId: usLbm.id,
    announcedDate: "2021-12-20",
    closedDate: "2022-02-15",
    summary:
      "Platinum Equity and Bain Capital Private Equity entered a co-control partnership to jointly own US LBM.",
    sources: [
      "https://www.platinumequity.com/news/platinum-equity-and-bain-capital-private-equity-announce-strategic-partnership-to-co-own-us-lbm",
    ],
  });

  // Current edges (Bain + Platinum co-own)
  await upsertEdge({
    parentId: bain.id,
    childId: usLbm.id,
    relationship: "controls",
    startDate: "2020-12-22",
    note: "Bain Capital Private Equity acquired US LBM from Kelso in December 2020; entered a co-control partnership with Platinum Equity in early 2022.",
    sources: [
      "https://www.uslbm.com/news/bain-capital-private-equity-completes-acquisition-of-us-lbm/",
      "https://www.platinumequity.com/news/platinum-equity-and-bain-capital-private-equity-announce-strategic-partnership-to-co-own-us-lbm",
    ],
  });

  await upsertEdge({
    parentId: platinum.id,
    childId: usLbm.id,
    relationship: "controls",
    startDate: "2022-02-15",
    note: "Platinum Equity holds a co-control stake in US LBM alongside Bain Capital.",
    sources: [
      "https://www.platinumequity.com/news/platinum-equity-and-bain-capital-private-equity-announce-strategic-partnership-to-co-own-us-lbm",
    ],
  });

  // Historical edge (Kelso → US LBM, ended at the Bain close)
  await upsertEdge({
    parentId: kelso.id,
    childId: usLbm.id,
    relationship: "controls",
    endDate: "2020-12-22",
    note: "Kelso & Company was the prior majority owner of US LBM, exiting in the December 2020 sale to Bain Capital.",
    sources: [
      "https://www.uslbm.com/news/bain-capital-private-equity-completes-acquisition-of-us-lbm/",
    ],
  });

  return { usLbm, bain, platinum, kelso };
}
