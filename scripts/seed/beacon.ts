import { upsertCompany, upsertEdge, linkSource } from "./_helpers";

const QXO_CLOSE =
  "https://www.businesswire.com/news/home/20250429541973/en/QXO-Completes-Acquisition-of-Beacon-Roofing-Supply";

/**
 * Beacon Building Products (now QXO Building Products)
 *
 * Distributor of roofing materials and complementary building products. Was
 * public (NASDAQ: BECN) until QXO, Inc. (NYSE: QXO) completed its acquisition
 * on 2025-04-29; Beacon is now a wholly owned QXO subsidiary renamed QXO
 * Building Products and BECN is delisted. Verified 2026-11 against QXO's
 * closing release and the SEC exhibit.
 *
 * NOTE: All edges/claims seeded here start with verified=false.
 */
export async function seedBeacon() {
  const qxo = await upsertCompany({
    slug: "qxo",
    name: "QXO, Inc.",
    type: "public_company",
    ticker: "QXO",
    headquartersCity: "Greenwich",
    headquartersState: "CT",
    website: "https://www.qxo.com",
    description:
      "Publicly traded building-products distributor (NYSE: QXO). Acquired Beacon Roofing Supply in April 2025 and renamed it QXO Building Products.",
    status: "active",
  });

  const beacon = await upsertCompany({
    name: "Beacon Building Products",
    legalName: "Beacon Roofing Supply, Inc. (now QXO Building Products, Inc.)",
    type: "consolidator",
    ticker: null,
    headquartersCity: "Herndon",
    headquartersState: "VA",
    website: "https://www.becn.com",
    foundedYear: 1928,
    description:
      "One of the largest U.S. distributors of residential and non-residential roofing materials and complementary building products. A wholly owned subsidiary of QXO, Inc. (NYSE: QXO) since April 2025, renamed QXO Building Products.",
    notes:
      "Operates under several legacy banners across the country, including Allied Building Products and Roofing Supply Group, both folded into Beacon following 2017 and 2016 acquisitions respectively.",
    status: "active",
  });

  await upsertEdge({
    parentId: qxo.id,
    childId: beacon.id,
    relationship: "owns",
    startDate: "2025-04-29",
    stakePct: "100",
    sources: [QXO_CLOSE],
    quote: "QXO Completes Acquisition of Beacon Roofing Supply",
  });
  await linkSource(
    { url: QXO_CLOSE, title: "QXO Completes Acquisition of Beacon Roofing Supply", publication: "Business Wire", publishedDate: "2025-04-29" },
    "company",
    beacon.id
  );

  return { beacon, qxo };
}
