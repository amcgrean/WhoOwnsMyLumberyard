import { upsertCompany, linkSource } from "./_helpers";

/**
 * Beacon Building Products
 *
 * Public distributor of roofing materials and complementary building products,
 * historically NASDAQ: BECN. (In April 2025, QXO completed a tender offer for
 * Beacon — that change-of-control is intentionally NOT seeded here; the
 * operator should add the QXO ownership edge after independently verifying the
 * filing record.)
 *
 * NOTE: All edges/claims seeded here start with verified=false.
 */
export async function seedBeacon() {
  // SOURCE: https://www.becn.com/our-company
  const beacon = await upsertCompany({
    name: "Beacon Building Products",
    legalName: "Beacon Roofing Supply, Inc.",
    type: "public_company",
    ticker: "BECN",
    headquartersCity: "Herndon",
    headquartersState: "VA",
    website: "https://www.becn.com",
    foundedYear: 1928,
    description:
      "One of the largest U.S. distributors of residential and non-residential roofing materials, complementary building products, and related accessories.",
    notes:
      "Operates under several legacy banners across the country, including Allied Building Products and Roofing Supply Group, both folded into Beacon following 2017 and 2016 acquisitions respectively.",
    status: "active",
  });

  await linkSource(
    {
      url: "https://www.becn.com/our-company",
      title: "Beacon — Our Company",
      publication: "Beacon Building Products",
    },
    "company",
    beacon.id
  );

  return { beacon };
}
