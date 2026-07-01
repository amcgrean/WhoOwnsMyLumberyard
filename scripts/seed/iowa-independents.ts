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
      "Family-owned (Mark & Miranda Paup, since 1999) plumbing, heating, cooling, and electrical company serving the Des Moines metro from Grimes, and a member of the member-owned Nexstar Network. Independently owned — no private-equity or consolidator parent on the public record.",
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
      "https://www.nexstarnetwork.com/blog/newsroom/golden-rules-golden-rule-embrace-emerging-technology-for-big-wins/",
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

  // ──────────────────────────────────────────────────────────────────────
  // Additional metros — locally-owned & employee-owned independents.
  // Each is seeded as an operating brand (`yard`) with no parent ownership
  // edge, so it classifies as Independent. "Independent" / "employee-owned"
  // reflects the best available public evidence (company sites, local news,
  // ESOP directories); every row carries its source. lat/lng left null — run
  // `pnpm geocode:missing` to place them on the map.
  // ──────────────────────────────────────────────────────────────────────
  type Trade = "plumbing" | "electrical" | "hvac";
  async function addIndependent(c: {
    name: string;
    legalName?: string;
    trade: Trade;
    city: string;
    zip: string;
    address: string;
    website: string;
    foundedYear?: number;
    description: string;
    services: string[];
    sources: string[];
  }) {
    const company = await upsertCompany({
      name: c.name,
      legalName: c.legalName,
      type: "yard",
      trade: c.trade,
      headquartersCity: c.city,
      headquartersState: "IA",
      website: c.website,
      foundedYear: c.foundedYear,
      description: c.description,
    });
    await upsertLocation({
      companyId: company.id,
      displayName: c.name,
      addressLine1: c.address,
      city: c.city,
      state: "IA",
      zip: c.zip,
      trade: c.trade,
      services: c.services,
      sourceUrl: c.sources[0],
      sources: c.sources,
    });
    return company;
  }

  const more = [
    // ── Sioux City ──────────────────────────────────────────────────────
    {
      name: "CW Suter Services",
      trade: "hvac" as const,
      city: "Sioux City",
      zip: "51105",
      address: "1800 11th St",
      website: "https://cwsuter.com",
      foundedYear: 1926,
      description:
        "Sioux City HVAC and plumbing company founded in 1926 and now 100% employee-owned (ESOP) — locally controlled rather than private-equity-owned.",
      services: ["hvac_install", "hvac_service", "plumbing_repair"],
      sources: [
        "https://siouxcityjournal.com/brandavestudios/article_bc824196-268d-5c26-bb43-cce4c4613603.html",
        "https://cwsuter.com/about/",
      ],
    },
    {
      name: "Nystrom Electric Co.",
      trade: "electrical" as const,
      city: "Sioux City",
      zip: "51103",
      address: "1504 W 3rd St",
      website: "http://www.nystromelectric.net",
      foundedYear: 1920,
      description:
        "Fourth-generation family-owned Sioux City electrical contractor, founded in 1920.",
      services: ["electrical_repair", "panel_wiring"],
      sources: ["http://www.nystromelectric.net/"],
    },
    {
      name: "Kalins Indoor Comfort",
      trade: "hvac" as const,
      city: "Sioux City",
      zip: "51101",
      address: "1715 4th St",
      website: "https://www.kalinsindoor.com",
      foundedYear: 1921,
      description:
        "Sioux City heating and cooling company, family-owned and passed down three generations since 1921.",
      services: ["hvac_install", "hvac_service"],
      sources: ["https://www.kalinsindoor.com/iowa/sioux-city-hvac/"],
    },
    // ── Quad Cities (Iowa side) ─────────────────────────────────────────
    {
      name: "The Schebler Company",
      trade: "hvac" as const,
      city: "Bettendorf",
      zip: "52722",
      address: "5665 Fenno Rd",
      website: "https://www.scheblerhvac.com",
      foundedYear: 1895,
      description:
        "Quad Cities HVAC and sheet-metal company founded in 1895; became 100% employee-owned (ESOP) in January 2022 — locally controlled rather than private-equity-owned.",
      services: ["hvac_install", "hvac_service"],
      sources: ["https://www.scheblerhvac.com/"],
    },
    {
      name: "Bettendorf Heating & Air Conditioning",
      trade: "hvac" as const,
      city: "Bettendorf",
      zip: "52722",
      address: "3474 State St",
      website: "https://www.bettendorfheating.com",
      foundedYear: 1965,
      description:
        "Family-owned Quad Cities heating and cooling company founded in 1965 by Loyal Lamansky and still run by the family.",
      services: ["hvac_install", "hvac_service"],
      sources: ["https://www.bettendorfheating.com/about-us"],
    },
    {
      name: "Tappendorf Plumbing & Heating",
      trade: "plumbing" as const,
      city: "Davenport",
      zip: "52802",
      address: "6605 W River Dr",
      website: "https://www.tappendorfplumbing.net",
      foundedYear: 1973,
      description:
        "Family-owned Davenport plumbing and heating company, in business since 1973.",
      services: ["plumbing_repair", "hvac_service"],
      sources: ["https://www.tappendorfplumbing.net/"],
    },
    {
      name: "C. Ewert Plumbing & Heating",
      trade: "plumbing" as const,
      city: "Davenport",
      zip: "52802",
      address: "1316 W 4th St",
      website: "https://www.ewertplumbing.com",
      foundedYear: 1954,
      description:
        "Family-owned Davenport plumbing and heating company serving the Quad Cities since 1954.",
      services: ["plumbing_repair", "hvac_service"],
      sources: ["https://www.ewertplumbing.com/"],
    },
    {
      name: "Quinn Electric",
      trade: "electrical" as const,
      city: "Eldridge",
      zip: "52748",
      address: "26185 190th Ave",
      website: "https://www.quinnelectricqca.com",
      foundedYear: 1983,
      description:
        "Local family-owned Quad Cities electrical contractor, serving the area since 1983.",
      services: ["electrical_repair", "panel_wiring", "generator"],
      sources: ["https://www.quinnelectricqca.com/"],
    },
    // ── Dubuque ─────────────────────────────────────────────────────────
    {
      name: "A&G Electric of Dubuque",
      trade: "electrical" as const,
      city: "Dubuque",
      zip: "52001",
      address: "10501 IA-3",
      website: "https://agelectricdubuque.com",
      foundedYear: 1983,
      description:
        "Locally-owned, family-operated Dubuque electrical contractor established in 1983 — described as one of the Tri-State area's largest locally-owned electrical contractors.",
      services: ["electrical_repair", "panel_wiring", "generator"],
      sources: ["https://agelectricdubuque.com/"],
    },
    {
      name: "Willenborg Plumbing & Heating",
      legalName: "Willenborg Plumbing & Heating, Inc.",
      trade: "plumbing" as const,
      city: "Dubuque",
      zip: "52003",
      address: "1010 Cedar Cross Road",
      website: "https://willenborgplumbing.com",
      description:
        "Family-owned and operated Dubuque-area plumbing and heating company.",
      services: ["plumbing_repair", "hvac_service"],
      sources: ["https://willenborgplumbing.com/"],
    },
    // ── Ames ────────────────────────────────────────────────────────────
    {
      name: "C&K Heating, Cooling, Plumbing & Gutters",
      legalName: "C And K, Inc.",
      trade: "hvac" as const,
      city: "Ames",
      zip: "50010",
      address: "2312 Edison St",
      website: "https://callcandk.com",
      foundedYear: 1968,
      description:
        "Family-owned and locally-operated Ames HVAC and plumbing company serving central Iowa since 1968.",
      services: ["hvac_install", "hvac_service", "plumbing_repair"],
      sources: ["https://callcandk.com/company/"],
    },
    {
      name: "Converse Conditioned Air",
      trade: "hvac" as const,
      city: "Ames",
      zip: "50010",
      address: "3116 S Duff Ave Ste 100",
      website: "https://www.ccahvac.com",
      description: "Family-owned and operated Ames heating and cooling company.",
      services: ["hvac_install", "hvac_service"],
      sources: ["https://www.ccahvac.com/"],
    },
    // ── Waterloo / Cedar Falls ──────────────────────────────────────────
    {
      name: "Bergen Plumbing, Heating & Cooling",
      legalName: "Bergen Plumbing, Heating & Cooling, Inc.",
      trade: "plumbing" as const,
      city: "Waterloo",
      zip: "50701",
      address: "35 Fletcher Avenue",
      website: "https://noworrycomfort.com",
      foundedYear: 2019,
      description:
        "Waterloo plumbing, heating, and cooling company that became 100% employee-owned (ESOP) at the end of 2019 — employee-controlled rather than private-equity-owned.",
      services: ["plumbing_repair", "hvac_install", "hvac_service"],
      sources: [
        "https://wcfcourier.com/business/local/bergen-plumbing-heating-cooling-completes-sale-to-employees/article_1d5473f3-6e11-5124-971f-bccda6689300.html",
        "https://www.certifiedeo.com/company/bergen-plumbing-heating-cooling",
      ],
    },
    {
      name: "Young Plumbing & Heating",
      legalName: "Young Plumbing & Heating Co.",
      trade: "plumbing" as const,
      city: "Waterloo",
      zip: "50701",
      address: "750 S Hackett Rd",
      website: "https://youngphc.com",
      foundedYear: 1882,
      description:
        "Fifth-generation family-owned Waterloo plumbing and heating company with roots dating to 1882; named 2018 Family-Owned Business of the Year.",
      services: ["plumbing_repair", "hvac_service", "drain_sewer"],
      sources: ["https://youngphc.com/"],
    },
    // ── Ottumwa ─────────────────────────────────────────────────────────
    {
      name: "Mitchell & Sons Heating & Cooling",
      trade: "hvac" as const,
      city: "Ottumwa",
      zip: "52501",
      address: "109 S Madison Ave",
      website: "https://mitchellandsonshvacia.com",
      foundedYear: 1946,
      description:
        "Family-owned Ottumwa heating and cooling company serving the area since 1946.",
      services: ["hvac_install", "hvac_service"],
      sources: ["https://mitchellandsonshvacia.com/"],
    },
    // ── Mason City ──────────────────────────────────────────────────────
    {
      name: "Mundt Enterprises (Double M Plumbing & Heating)",
      trade: "plumbing" as const,
      city: "Mason City",
      zip: "50401",
      address: "16455 Lark Ave, Suite C",
      website: "https://www.mundtenterprises.com",
      description:
        "Locally-owned Mason City plumbing and heating company, owned and operated by Michael Mundt and his daughter Vanessia Mundt.",
      services: ["plumbing_repair", "hvac_service"],
      sources: ["https://www.mundtenterprises.com/about-us/"],
    },
    {
      name: "Blazek Electric",
      legalName: "Blazek Electric, Inc.",
      trade: "electrical" as const,
      city: "Mason City",
      zip: "50401",
      address: "115 8th Street SE",
      website: "https://www.blazekelectric.com",
      foundedYear: 1946,
      description:
        "Family-owned Mason City electrical contractor serving the area for over 70 years (established 1946).",
      services: ["electrical_repair", "panel_wiring"],
      sources: ["https://www.blazekelectric.com/"],
    },
  ];

  for (const c of more) {
    await addIndependent(c);
  }

  return { goldenRule, dalton, baker, added: more.length };
}
