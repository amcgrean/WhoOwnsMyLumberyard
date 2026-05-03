import { upsertCompany, upsertEdge, linkSource } from "./_helpers";

/**
 * Carter Lumber and its family of companies.
 *
 * Carter Lumber is a private, family-owned consolidator headquartered in
 * Kent, Ohio, founded in 1932 by W.E. Carter. Still under Carter-family
 * ownership. Operates regionally under the Carter Lumber banner plus four
 * preserved legacy banners acquired over time:
 *   - Holmes Lumber (acquired)
 *   - Kight Home Center (acquired)
 *   - Kempsville Building Materials (acquired)
 *   - Townsend Building Supply (acquired)
 *
 * NOTE: All ownership edges seeded here start with verified=false. Acquisition
 * dates are intentionally NOT inserted here — they are not yet sourced to the
 * operator's standard. Add them via a follow-up PR with citation URLs.
 */
export async function seedCarterLumber() {
  // SOURCE: https://www.carterlumber.com/company-info
  // SOURCE: https://www.carterlumber.com/company-info/family-of-companies
  const carter = await upsertCompany({
    name: "Carter Lumber",
    legalName: "The Carter Lumber Company",
    type: "consolidator",
    headquartersCity: "Kent",
    headquartersState: "OH",
    website: "https://www.carterlumber.com",
    foundedYear: 1932,
    description:
      "A privately held, family-owned regional building-materials dealer founded in 1932 in Kent, Ohio. Operates under the Carter Lumber banner across the eastern half of the United States and is the parent of four acquired regional brands kept on signage post-acquisition.",
    notes:
      "Family of companies includes Holmes Lumber, Kight Home Center, Kempsville Building Materials, and Townsend Building Supply. All operate under Carter Lumber ownership.",
    status: "active",
  });

  await linkSource(
    {
      url: "https://www.carterlumber.com/company-info/family-of-companies",
      title: "Carter Lumber Family of Companies",
      publication: "Carter Lumber",
    },
    "company",
    carter.id
  );

  // SOURCE: https://www.carterlumber.com/company-info/family-of-companies
  const holmes = await upsertCompany({
    name: "Holmes Lumber",
    type: "yard",
    headquartersState: "MI",
    website: "https://www.carterlumber.com",
    description:
      "Regional building-materials brand operating as a wholly owned subsidiary of Carter Lumber.",
    status: "active",
  });

  const kight = await upsertCompany({
    name: "Kight Home Center",
    type: "yard",
    headquartersState: "GA",
    website: "https://www.carterlumber.com",
    description:
      "Regional home-center brand operating as a wholly owned subsidiary of Carter Lumber.",
    status: "active",
  });

  const kempsville = await upsertCompany({
    name: "Kempsville Building Materials",
    type: "yard",
    headquartersState: "VA",
    website: "https://www.carterlumber.com",
    description:
      "Regional building-materials brand operating as a wholly owned subsidiary of Carter Lumber.",
    status: "active",
  });

  const townsend = await upsertCompany({
    name: "Townsend Building Supply",
    type: "yard",
    headquartersState: "AL",
    website: "https://www.carterlumber.com",
    description:
      "Regional building-supply brand operating as a wholly owned subsidiary of Carter Lumber.",
    status: "active",
  });

  for (const child of [holmes, kight, kempsville, townsend]) {
    await upsertEdge({
      parentId: carter.id,
      childId: child.id,
      relationship: "subsidiary_of",
      note: "Operates as part of the Carter Lumber family of companies; specific acquisition date not yet sourced.",
      sources: ["https://www.carterlumber.com/company-info/family-of-companies"],
    });
  }

  return { carter, holmes, kight, kempsville, townsend };
}
