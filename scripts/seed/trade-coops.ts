import { upsertCompany, linkSource } from "./_helpers";

/**
 * Member-owned buying groups & cooperatives for the residential trades.
 *
 * The "banded together but still independent" category — the trades analogue
 * to the LBM co-ops in `coops.ts`. Two flavors:
 *   - a member-owned *contractor* network (Nexstar), whose members are
 *     independent plumbing/HVAC/electrical service companies; and
 *   - member-owned *distributor* co-ops / buying groups (IMARK / Current
 *     Distribution Group, Blue Hawk, AD), whose members are independent
 *     wholesale supply houses.
 *
 * As in `coops.ts`, member relationships (member_of edges) are deliberately
 * NOT inserted here: full member rosters are not public, and — importantly —
 * co-op membership does not transfer ownership, so asserting it as an edge
 * would wrongly count independent members as "consolidated" on the map and
 * state pages. Individual, publicly-sourced memberships are noted in the
 * relevant operating brand's description instead (see `iowa-independents.ts`).
 *
 * NOT seeded here on purpose: Service Nation / Service Roundtable. Despite the
 * "membership" framing it is NOT member-owned — it is a for-profit membership
 * platform owned by EverCommerce (NASDAQ: EVCM). It does not belong in the
 * member-owned co-op category.
 */
export async function seedTradeCoops() {
  // SOURCE: https://www.nexstarnetwork.com/about/
  const nexstar = await upsertCompany({
    name: "Nexstar Network",
    legalName: "Nexstar Network, Inc.",
    type: "coop",
    headquartersCity: "Bloomington",
    headquartersState: "MN",
    website: "https://www.nexstarnetwork.com",
    description:
      "A member-owned business-development and best-practices network for independent residential plumbing, HVAC, and electrical service companies (800+ members). Members remain independently owned; in 2025 Nexstar parted ways with private-equity-backed members to protect that independence.",
  });
  await linkSource(
    { url: "https://www.nexstarnetwork.com/about/" },
    "company",
    nexstar.id
  );
  await linkSource(
    {
      url: "https://www.forbes.com/sites/brandonkochkodin/2025/09/16/a-group-for-small-building-trade-businesses-tells-private-equity-to-get-lost/",
      title: "A Group For Small Building-Trade Businesses Tells Private Equity To Get Lost",
      publication: "Forbes",
    },
    "company",
    nexstar.id
  );

  // SOURCE: https://currentdistributiongroup.com/
  const imark = await upsertCompany({
    name: "IMARK Group",
    legalName: "IMARK Group, Inc.",
    type: "coop",
    website: "https://currentdistributiongroup.com",
    description:
      "A multi-vertical, member-owned and member-governed distributor cooperative for independent electrical, plumbing, and HVAC/R wholesale supply houses. Now operates under the Current Distribution Group umbrella; its electrical division merged into AD in 2024.",
  });
  await linkSource(
    {
      url: "https://ncbaclusa.coop/blog/imark-group-announces-blue-hawk-north-americas-largest-hvacr-wholesale-distributor-as-founding-member/",
      title: "IMARK Group announces Blue Hawk as founding member",
      publication: "NCBA CLUSA",
    },
    "company",
    imark.id
  );

  // SOURCE: https://www.bluehawk.coop/
  const blueHawk = await upsertCompany({
    name: "Blue Hawk Cooperative",
    legalName: "BLUE HAWK Cooperative",
    type: "coop",
    headquartersCity: "Gilbert",
    headquartersState: "AZ",
    website: "https://www.bluehawk.coop",
    description:
      "A 100% member-owned HVAC/R wholesale-distribution cooperative (200+ member-owners, 1,600+ locations). Dividends are returned to the independent distributor members; also a founding HVAC/R member of IMARK Group.",
  });
  await linkSource({ url: "https://www.bluehawk.coop/" }, "company", blueHawk.id);

  // SOURCE: https://www.adhq.com/about
  const ad = await upsertCompany({
    name: "AD (Affiliated Distributors)",
    legalName: "AD",
    type: "coop",
    headquartersCity: "Wayne",
    headquartersState: "PA",
    website: "https://www.adhq.com",
    description:
      "A member-owned marketing and buying group for independent distributors of construction and industrial supplies (electrical, plumbing, HVAC, PVF, and more) — ~1,000 independently-owned members across ~9,000 branches. Tagline: \"Independent and Proud of It.\"",
  });
  await linkSource({ url: "https://www.adhq.com/about" }, "company", ad.id);

  return { nexstar, imark, blueHawk, ad };
}
