import { upsertCompany, linkSource } from "./_helpers";

/**
 * Boise Cascade Company.
 *
 * Boise Cascade (NYSE: BCC) is a publicly traded manufacturer of engineered
 * wood products and plywood, and a wholesale distributor of building
 * materials through its Building Materials Distribution (BMD) segment, which
 * operates roughly 40 distribution centers across the United States.
 *
 * NOTE: All ownership edges seeded here start with verified=false.
 */
export async function seedBoiseCascade() {
  // SOURCE: https://www.bc.com/about-us/
  const co = await upsertCompany({
    name: "Boise Cascade",
    legalName: "Boise Cascade Company",
    type: "public_company",
    ticker: "BCC",
    headquartersCity: "Boise",
    headquartersState: "ID",
    website: "https://www.bc.com",
    foundedYear: 2004,
    description:
      "A publicly traded manufacturer of engineered wood products and plywood, and a wholesale distributor of building materials through its Building Materials Distribution (BMD) segment of approximately 40 U.S. distribution centers.",
    notes:
      "Operates two reporting segments: Wood Products (engineered wood products and plywood plants) and Building Materials Distribution (BMD wholesale to dealers). The BMD branches and EWP plants are tracked here as Boise Cascade-branded locations.",
    status: "active",
  });

  await linkSource(
    {
      url: "https://www.bc.com/about-us/",
      title: "Boise Cascade — About Us",
      publication: "Boise Cascade",
    },
    "company",
    co.id
  );

  return { co };
}
