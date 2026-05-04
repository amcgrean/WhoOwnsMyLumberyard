import { upsertCompany, linkSource } from "./_helpers";

/**
 * GMS Inc.
 *
 * GMS (NYSE: GMS) is a leading North American specialty building products
 * distributor of wallboard, suspended ceilings systems, steel framing, and
 * complementary construction products. Headquartered in Tucker, GA, formed
 * out of Gypsum Management & Supply. Operates dozens of regional banners
 * preserved on signage from acquired companies — those are auto-created on
 * import as subsidiaries of GMS Inc.
 *
 * NOTE: All ownership edges seeded here start with verified=false.
 */
export async function seedGms() {
  // SOURCE: https://www.gms.com/about/our-company/
  const co = await upsertCompany({
    name: "GMS Inc.",
    legalName: "GMS Inc.",
    type: "public_company",
    ticker: "GMS",
    headquartersCity: "Tucker",
    headquartersState: "GA",
    website: "https://gms.com",
    foundedYear: 1971,
    description:
      "A leading North American specialty distributor of wallboard, suspended ceilings systems, steel framing, and complementary construction products. Public on NYSE since 2016. Operates more than 70 regional banners across the United States and Canada, preserved on signage post-acquisition.",
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

  return { co };
}
