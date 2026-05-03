import { upsertCompany, upsertEdge, linkSource } from "./_helpers";

/**
 * 84 Lumber.
 *
 * Privately held national lumber and building-materials chain founded in 1956
 * by Joe Hardy in Eighty Four, Pennsylvania. Owned and operated by the Hardy
 * family; Maggie Hardy serves as owner. ~235 retail stores across the eastern
 * and southern United States.
 *
 * NOTE: All ownership edges seeded here start with verified=false.
 */
export async function seed84Lumber() {
  // SOURCE: https://www.84lumber.com/about/our-story/
  const co = await upsertCompany({
    name: "84 Lumber",
    legalName: "84 Lumber Company",
    type: "consolidator",
    headquartersCity: "Eighty Four",
    headquartersState: "PA",
    website: "https://www.84lumber.com",
    foundedYear: 1956,
    description:
      "A privately held national lumber and building-materials supplier founded in 1956 by Joe Hardy in Eighty Four, Pennsylvania. Operates a single banner across roughly 235 retail stores in the eastern, southern, and southwestern United States. Owned by the Hardy family.",
    notes:
      "Operates under a single 84 Lumber banner; no preserved acquired brands. Family-owned through Maggie Hardy.",
    status: "active",
  });

  await linkSource(
    {
      url: "https://www.84lumber.com/about/our-story/",
      title: "84 Lumber — Our Story",
      publication: "84 Lumber",
    },
    "company",
    co.id
  );

  // Family-office parent. Modeled as a separate company so the ownership chain
  // shows the family at the top of the graph.
  // SOURCE: https://www.84lumber.com/about/our-story/
  const family = await upsertCompany({
    name: "Hardy Family",
    type: "family_office",
    headquartersCity: "Eighty Four",
    headquartersState: "PA",
    description:
      "Holding entity associated with the Hardy family, founders and continuing owners of 84 Lumber. Maggie Hardy is owner.",
    status: "active",
  });

  await upsertEdge({
    parentId: family.id,
    childId: co.id,
    relationship: "controls",
    note: "84 Lumber remains under Hardy-family ownership. Maggie Hardy is owner.",
    sources: ["https://www.84lumber.com/about/our-story/"],
  });

  return { co, family };
}
