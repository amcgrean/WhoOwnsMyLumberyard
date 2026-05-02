import { upsertCompany } from "./_helpers";

/**
 * Buying-group co-ops referenced throughout the LBM industry. Each is seeded
 * as a `coop` company. Member relationships (member_of) are deliberately not
 * inserted here because full member rosters are not public; the operator will
 * fill these in over time as data is collected.
 */
export async function seedCoops() {
  const lmc = await upsertCompany({
    name: "LMC",
    legalName: "Lumbermens Merchandising Corporation",
    type: "coop",
    headquartersCity: "Wayne",
    headquartersState: "PA",
    website: "https://www.lmc.net",
    foundedYear: 1935,
    description:
      "A member-owned forest-products buying and marketing cooperative serving independent lumber and building-material dealers across the United States.",
  });

  const doItBest = await upsertCompany({
    name: "Do it Best",
    legalName: "Do it Best Corp.",
    type: "coop",
    headquartersCity: "Fort Wayne",
    headquartersState: "IN",
    website: "https://www.doitbestcorp.com",
    foundedYear: 1945,
    description:
      "A member-owned hardware, lumber, and building-materials cooperative.",
  });

  const aceProx = await upsertCompany({
    name: "Ace Hardware",
    legalName: "Ace Hardware Corporation",
    type: "coop",
    headquartersCity: "Oak Brook",
    headquartersState: "IL",
    website: "https://www.acehardware.com",
    foundedYear: 1924,
    description:
      "A retailer-owned hardware cooperative; serves a network of independently owned hardware and home-center stores, some of which sell lumber and building materials.",
  });

  const trueValue = await upsertCompany({
    name: "True Value",
    legalName: "True Value Company",
    type: "coop",
    headquartersCity: "Chicago",
    headquartersState: "IL",
    website: "https://www.truevalue.com",
    foundedYear: 1948,
    description:
      "Hardware and home-improvement wholesaler historically organized as a retailer-owned cooperative.",
  });

  const enap = await upsertCompany({
    name: "ENAP",
    legalName: "ENAP, Inc.",
    type: "coop",
    headquartersCity: "Northbrook",
    headquartersState: "IL",
    website: "https://www.enapinc.com",
    description:
      "A buying-group cooperative for independent lumber and building-materials dealers.",
  });

  const lbma = await upsertCompany({
    name: "LBM Advantage",
    legalName: "LBM Advantage, Inc.",
    type: "coop",
    headquartersCity: "New Windsor",
    headquartersState: "NY",
    website: "https://www.lbmadvantage.com",
    description:
      "A member-owned buying group for independent lumber and building-materials dealers across the U.S.",
  });

  return { lmc, doItBest, aceProx, trueValue, enap, lbma };
}
