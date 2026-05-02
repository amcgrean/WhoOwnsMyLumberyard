import { upsertCompany, upsertEdge } from "./_helpers";

/**
 * ABC Supply
 *
 * Privately held wholesale distributor of roofing, siding, windows, and other
 * exterior building products. Founded by Ken and Diane Hendricks in 1982 in
 * Beloit, WI; remains under Hendricks-family control. ABC Supply is also the
 * parent of L&W Supply, a major national distributor of drywall and related
 * interior building products.
 *
 * NOTE: All ownership edges seeded here start with verified=false.
 */
export async function seedAbcSupply() {
  // SOURCE: https://www.abcsupply.com/about-us/
  const abc = await upsertCompany({
    name: "ABC Supply",
    legalName: "ABC Supply Co., Inc.",
    type: "consolidator",
    headquartersCity: "Beloit",
    headquartersState: "WI",
    website: "https://www.abcsupply.com",
    foundedYear: 1982,
    description:
      "The largest U.S. wholesale distributor of roofing, siding, windows, and other exterior and interior building products. Founded by Ken and Diane Hendricks in 1982; remains privately held under Hendricks-family ownership.",
    notes:
      "ABC Supply is also the parent of L&W Supply (drywall and interior building products), acquired in 2016. Diane Hendricks serves as chair.",
    status: "active",
  });

  // SOURCE: https://www.lwsupply.com/about
  const lw = await upsertCompany({
    name: "L&W Supply",
    legalName: "L&W Supply Corporation",
    type: "consolidator",
    headquartersCity: "Chicago",
    headquartersState: "IL",
    website: "https://www.lwsupply.com",
    description:
      "National distributor of drywall, suspended ceilings, steel framing, and related interior building products. A wholly owned subsidiary of ABC Supply since 2016.",
    status: "active",
  });

  // SOURCE: https://www.abcsupply.com/news-room/abc-supply-acquires-lw-supply/
  await upsertEdge({
    parentId: abc.id,
    childId: lw.id,
    relationship: "subsidiary_of",
    startDate: "2016-10-31",
    note: "ABC Supply completed the acquisition of L&W Supply from USG Corporation in October 2016. L&W operates as a wholly owned subsidiary.",
    sources: [
      "https://www.abcsupply.com/news-room/abc-supply-acquires-lw-supply/",
    ],
  });

  // Hendricks family ownership recorded as the ultimate root, modeled as a
  // family_office company. We do not invent an entity name here — the operator
  // can rename to a verified holding-entity name once a source is identified.
  const hendricks = await upsertCompany({
    name: "Hendricks Holding Company",
    type: "family_office",
    headquartersCity: "Beloit",
    headquartersState: "WI",
    description:
      "Holding entity associated with the Hendricks family, founders and continuing owners of ABC Supply.",
    status: "active",
  });

  // SOURCE: https://www.forbes.com/profile/diane-hendricks/
  await upsertEdge({
    parentId: hendricks.id,
    childId: abc.id,
    relationship: "controls",
    note: "ABC Supply remains under Hendricks-family control. Diane Hendricks is co-founder and chair.",
    sources: ["https://www.forbes.com/profile/diane-hendricks/"],
  });

  return { abc, lw, hendricks };
}
