import { upsertCompany, upsertEdge, upsertAcquisition, linkSource } from "./_helpers";

/**
 * Builders FirstSource (NYSE: BLDR)
 *
 * Public consolidator. The company in its current form was created by the
 * January 2021 merger of legacy Builders FirstSource and BMC Stock Holdings.
 *
 * NOTE: All ownership edges seeded here start with verified=false. The site
 * operator is expected to verify each edge against the linked source before
 * flipping the flag.
 */
export async function seedBuildersFirstSource() {
  // SOURCE: https://www.bldr.com/about-us/
  // SOURCE: https://investors.bldr.com/
  const bfs = await upsertCompany({
    name: "Builders FirstSource",
    legalName: "Builders FirstSource, Inc.",
    type: "public_company",
    ticker: "BLDR",
    headquartersCity: "Irving",
    headquartersState: "TX",
    website: "https://www.bldr.com",
    foundedYear: 1998,
    description:
      "The largest U.S. supplier of structural building products, value-added components, and services to the new residential construction and repair-and-remodel markets. Public on NYSE since 2005; current scale results from the January 2021 merger with BMC Stock Holdings.",
    notes:
      "Operates regionally under the BFS brand and a portfolio of legacy banners acquired over time, including BMC, ProBuild, and dozens of local brands.",
    status: "active",
  });

  // SOURCE: https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001316835
  await linkSource(
    { url: "https://investors.bldr.com/", title: "Builders FirstSource Investor Relations", publication: "Builders FirstSource" },
    "company",
    bfs.id
  );

  // The historical BMC entity, now folded into BFS, kept around because the
  // BMC banner still appears in some markets.
  // SOURCE: https://investors.bldr.com/news/news-details/2021/Builders-FirstSource-and-BMC-Complete-Transformative-Merger-of-Equals/default.aspx
  const bmc = await upsertCompany({
    name: "BMC",
    legalName: "BMC Stock Holdings, Inc.",
    type: "consolidator",
    headquartersCity: "Raleigh",
    headquartersState: "NC",
    description:
      "A national pro-dealer that merged with Builders FirstSource in a stock-for-stock transaction that closed January 1, 2021. The BMC banner persists in select markets.",
    status: "acquired",
  });

  const bfsBmcMerger = await upsertAcquisition({
    slug: "bfs-bmc-merger-2021",
    acquirerId: bfs.id,
    targetId: bmc.id,
    announcedDate: "2020-08-26",
    closedDate: "2021-01-01",
    summary:
      "Builders FirstSource and BMC Stock Holdings closed a stock-for-stock merger creating the largest U.S. supplier of structural building products and value-added components to the residential construction market.",
    sources: [
      "https://investors.bldr.com/news/news-details/2021/Builders-FirstSource-and-BMC-Complete-Transformative-Merger-of-Equals/default.aspx",
    ],
  });
  void bfsBmcMerger;

  // BFS owns the post-merger BMC entity
  await upsertEdge({
    parentId: bfs.id,
    childId: bmc.id,
    relationship: "subsidiary_of",
    startDate: "2021-01-01",
    note: "BMC operates as a wholly owned subsidiary post-merger.",
    sources: [
      "https://investors.bldr.com/news/news-details/2021/Builders-FirstSource-and-BMC-Complete-Transformative-Merger-of-Equals/default.aspx",
    ],
  });

  return { bfs, bmc };
}
