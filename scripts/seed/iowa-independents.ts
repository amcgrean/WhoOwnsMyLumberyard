import { upsertCompany, upsertLocation } from "./_helpers";

/**
 * Iowa residential-trades expansion — notable locally-owned independents.
 *
 * Positive examples for the "locally owned, not private equity" angle: Iowa
 * HVAC / plumbing / electrical companies with no private-equity or
 * out-of-state consolidator ownership on the public record. Each is seeded as
 * an operating brand (`yard`) with a `trade`; the absence of any parent
 * ownership edge is what classifies them as Independent.
 *
 * "Independent" here reflects the best available public evidence, not
 * certainty — private-company deals are often unannounced. Ownership can be
 * cross-checked against the Iowa Secretary of State business-entity search
 * (https://sos.iowa.gov/search/business/search.aspx). Source-backed
 * corrections are welcome via /submit.
 */
export async function seedIowaIndependents() {
  const goldenRule = await upsertCompany({
    name: "Golden Rule Plumbing, Heating, Cooling & Electrical",
    type: "yard",
    trade: "plumbing",
    headquartersCity: "Grimes",
    headquartersState: "IA",
    website: "https://www.goldenrulephc.com",
    description:
      "Family-owned plumbing, heating, cooling, and electrical company serving the Des Moines metro from Grimes. Independently owned — no private-equity or consolidator parent on the public record.",
  });

  const dalton = await upsertCompany({
    name: "Dalton Plumbing, Heating, Cooling, Electric & Fireplaces",
    legalName: "Dalton Plumbing, Heating, Cooling, Electric and Fireplaces, Inc.",
    type: "yard",
    trade: "plumbing",
    headquartersCity: "Cedar Falls",
    headquartersState: "IA",
    website: "https://www.daltonphc.com",
    description:
      "Independently owned Cedar Valley plumbing, HVAC, and electrical company serving the Waterloo / Cedar Falls area. No private-equity or consolidator parent on the public record.",
  });

  const baker = await upsertCompany({
    name: "Baker Group",
    legalName: "The Baker Group, LLP",
    type: "yard",
    trade: "hvac",
    headquartersCity: "Ankeny",
    headquartersState: "IA",
    website: "https://www.thebakergroup.com",
    foundedYear: 1963,
    description:
      "Iowa's largest independent full-service specialty contractor (mechanical, electrical, sheet metal, plumbing, and building automation). 100% employee-owned (ESOP) since 2019 — locally controlled rather than private-equity-owned.",
  });

  // Locations (lat/lng left null — run `pnpm geocode:missing` to fill).
  await upsertLocation({
    companyId: goldenRule.id,
    displayName: "Golden Rule Plumbing, Heating, Cooling & Electrical",
    addressLine1: "904 NE Main St",
    city: "Grimes",
    state: "IA",
    zip: "50111",
    trade: "plumbing",
    services: ["plumbing_repair", "drain_sewer", "water_heater", "hvac_service", "electrical_repair"],
    sourceUrl: "https://business.grimesiowa.com/list/member/golden-rule-plumbing-heating-cooling-electrical-101",
    sources: [
      "https://business.grimesiowa.com/list/member/golden-rule-plumbing-heating-cooling-electrical-101",
    ],
  });

  await upsertLocation({
    companyId: dalton.id,
    displayName: "Dalton Plumbing, Heating, Cooling, Electric & Fireplaces",
    addressLine1: "5536 Nordic Dr",
    city: "Cedar Falls",
    state: "IA",
    zip: "50613",
    trade: "plumbing",
    services: ["plumbing_repair", "hvac_service", "electrical_repair"],
    sourceUrl: "https://www.daltonphc.com/",
    sources: ["https://www.daltonphc.com/"],
  });

  await upsertLocation({
    companyId: baker.id,
    displayName: "Baker Group",
    addressLine1: "1600 SE Corporate Woods Dr",
    city: "Ankeny",
    state: "IA",
    zip: "50021",
    trade: "hvac",
    services: ["hvac_install", "hvac_service", "electrical_repair"],
    sourceUrl: "https://www.dsmpartnership.com/the-partnership/news-and-stories/news/baker-group-becomes-employee-owned-to-benefit-clients-and-employees",
    sources: [
      "https://www.dsmpartnership.com/the-partnership/news-and-stories/news/baker-group-becomes-employee-owned-to-benefit-clients-and-employees",
    ],
  });

  return { goldenRule, dalton, baker };
}
