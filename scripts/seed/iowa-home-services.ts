import { upsertCompany, upsertEdge, upsertAcquisition, upsertLocation } from "./_helpers";

/**
 * Iowa residential-trades expansion — PE-backed home-services roll-ups.
 *
 * Maps the private-equity platforms that have rolled up Iowa HVAC / plumbing /
 * electrical companies while keeping the local brand on the truck. Every
 * ownership edge is source-cited and seeded with verified=false (the default);
 * flip to verified=true only after re-reading each source.
 *
 * Verification note: business registration / officer details for the Iowa
 * operating brands can be cross-checked against the Iowa Secretary of State
 * business-entity search (https://sos.iowa.gov/search/business/search.aspx).
 */
export async function seedIowaHomeServices() {
  // ──────────────────────────────────────────────────────────────────────
  // Private-equity sponsors
  // ──────────────────────────────────────────────────────────────────────

  // SOURCE: https://www.omers.com/
  const omers = await upsertCompany({
    name: "OMERS Private Equity",
    legalName: "OMERS Administration Corporation",
    type: "pe_firm",
    headquartersCity: "Toronto",
    website: "https://www.omers.com",
    description:
      "Private-equity arm of the Ontario Municipal Employees Retirement System, one of Canada's largest pension plans. Acquired TurnPoint Services in 2020.",
  });

  // SOURCE: https://www.trivest.com/
  const trivest = await upsertCompany({
    name: "Trivest Partners",
    legalName: "Trivest Partners, L.P.",
    type: "pe_firm",
    headquartersCity: "Coral Gables",
    headquartersState: "FL",
    website: "https://www.trivest.com",
    description:
      "Private-equity firm focused on founder- and family-owned businesses; founding backer of TurnPoint Services until the 2020 sale to OMERS.",
  });

  // SOURCE: https://www.partnersgroup.com/
  const partnersGroup = await upsertCompany({
    name: "Partners Group",
    legalName: "Partners Group Holding AG",
    type: "pe_firm",
    headquartersCity: "Baar",
    website: "https://www.partnersgroup.com",
    description:
      "Global private-markets investment firm headquartered in Switzerland (U.S. hub in Denver). Acquired Reedy Industries — now PremiStar — from Audax Private Equity in 2021 at a roughly $1 billion valuation.",
  });

  // SOURCE: https://www.audaxprivateequity.com/
  const audax = await upsertCompany({
    name: "Audax Private Equity",
    legalName: "Audax Management Company, LLC",
    type: "pe_firm",
    headquartersCity: "Boston",
    headquartersState: "MA",
    website: "https://www.audaxprivateequity.com",
    description:
      "Private-equity firm; prior owner of Reedy Industries (now PremiStar) before the 2021 sale to Partners Group, in which it retained a minority stake.",
  });

  // SOURCE: https://www.gipartners.com/
  const giPartners = await upsertCompany({
    name: "GI Partners",
    legalName: "GI Partners",
    type: "pe_firm",
    headquartersCity: "San Francisco",
    headquartersState: "CA",
    website: "https://www.gipartners.com",
    description:
      "Private investment firm; acquired a majority stake in American Residential Services (ARS / Rescue Rooter) in 2020.",
  });

  // SOURCE: https://www.charlesbank.com/
  const charlesbank = await upsertCompany({
    name: "Charlesbank Capital Partners",
    legalName: "Charlesbank Capital Partners, LLC",
    type: "pe_firm",
    headquartersCity: "Boston",
    headquartersState: "MA",
    website: "https://www.charlesbank.com",
    description:
      "Middle-market private-equity firm; investor in American Residential Services since 2014, retaining a stake alongside GI Partners.",
  });

  // SOURCE: https://www.shoreview.com/
  const shoreview = await upsertCompany({
    name: "ShoreView Industries",
    legalName: "ShoreView Industries, LLC",
    type: "pe_firm",
    headquartersCity: "Minneapolis",
    headquartersState: "MN",
    website: "https://www.shoreview.com",
    description:
      "Private-equity firm; earlier backer of Burton A/C, Heating, Plumbing & Electrical, the Omaha-metro home-services company serving Council Bluffs, Iowa.",
  });

  // SOURCE: https://www.lightbay.com/
  const lightbay = await upsertCompany({
    name: "LightBay Capital",
    legalName: "LightBay Capital, LLC",
    type: "pe_firm",
    headquartersCity: "Los Angeles",
    headquartersState: "CA",
    website: "https://www.lightbay.com",
    description:
      "Private-equity firm; partnered with Burton (HVAC / plumbing / electrical) in December 2021.",
  });

  // ──────────────────────────────────────────────────────────────────────
  // Platform consolidators
  // ──────────────────────────────────────────────────────────────────────

  // SOURCE: https://www.turnpointservices.com/turnpoint-brands/
  const turnpoint = await upsertCompany({
    name: "TurnPoint Services",
    legalName: "TurnPoint Services, LLC",
    type: "consolidator",
    headquartersCity: "Louisville",
    headquartersState: "KY",
    website: "https://www.turnpointservices.com",
    description:
      "Private-equity-backed home-services platform (HVAC, plumbing, electrical) operating a portfolio of local brands across the U.S. Owned by OMERS Private Equity since 2020. Its Iowa brands (Des Moines metro) keep their original local names.",
    notes:
      "Iowa brands include Schaal Plumbing, Heating & Cooling (Johnston), Bell Brothers Heating & Air Conditioning (Des Moines), and Green's Appliance, Heating & Cooling (Des Moines).",
  });

  // SOURCE: https://premistar.com/our-companies/
  const premistar = await upsertCompany({
    name: "PremiStar",
    legalName: "Reedy Industries, Inc.",
    type: "consolidator",
    headquartersCity: "Deerfield",
    headquartersState: "IL",
    website: "https://premistar.com",
    foundedYear: 1930,
    description:
      "Commercial and industrial HVAC, plumbing, and building-automation platform, formerly branded Reedy Industries. Owned by Partners Group since 2021; rebranded to PremiStar in 2024. Acquired Mechanical Service, Inc. of Iowa City in 2022.",
  });

  // SOURCE: https://www.ars.com/
  const ars = await upsertCompany({
    name: "American Residential Services",
    legalName: "American Residential Services, LLC",
    type: "consolidator",
    headquartersCity: "Memphis",
    headquartersState: "TN",
    website: "https://www.ars.com",
    description:
      "Residential HVAC and plumbing network operating as ARS / Rescue Rooter across ~23 states. Majority-owned by GI Partners (2020) with Charlesbank Capital Partners retaining a stake. Serves Council Bluffs, Iowa through its Omaha-metro Aksarben ARS operation.",
  });

  // ──────────────────────────────────────────────────────────────────────
  // Iowa operating brands (the name on the truck)
  // ──────────────────────────────────────────────────────────────────────

  const schaal = await upsertCompany({
    name: "Schaal Plumbing, Heating & Cooling",
    type: "yard",
    trade: "hvac",
    headquartersCity: "Johnston",
    headquartersState: "IA",
    website: "https://callschaalyaall.com",
    description:
      "Des Moines-area plumbing and HVAC company. A TurnPoint Services brand (private-equity-owned via OMERS); the local Schaal name is retained on the trucks.",
  });

  const bellBrothers = await upsertCompany({
    name: "Bell Brothers Heating & Air Conditioning",
    legalName: "Bell Brothers Heating and Air Conditioning, Inc.",
    type: "yard",
    trade: "hvac",
    headquartersCity: "Des Moines",
    headquartersState: "IA",
    website: "https://bellbrothers.com",
    description:
      "Des Moines HVAC company and a TurnPoint Services brand (private-equity-owned via OMERS). Not affiliated with the similarly named Bell Brothers of Sacramento, California.",
  });

  const greens = await upsertCompany({
    name: "Green's Appliance, Heating & Cooling",
    legalName: "Green's Appliance, Heating & Cooling, Inc.",
    type: "yard",
    trade: "hvac",
    headquartersCity: "Des Moines",
    headquartersState: "IA",
    website: "https://greensahc.com",
    description:
      "Des Moines-area appliance-repair and HVAC company; a TurnPoint Services brand (private-equity-owned via OMERS).",
  });

  const msi = await upsertCompany({
    name: "Mechanical Service, Inc.",
    legalName: "Mechanical Service, Inc.",
    type: "yard",
    trade: "hvac",
    headquartersCity: "Iowa City",
    headquartersState: "IA",
    website: "https://premistar.com/ia/",
    description:
      "Iowa City commercial and industrial HVAC, plumbing, and piping contractor. Acquired by PremiStar (Reedy Industries / Partners Group) in August 2022 and rebranded to PremiStar in 2024.",
  });

  const ecs = await upsertCompany({
    name: "Environmental Control Solutions",
    legalName: "Environmental Control Solutions, Inc.",
    type: "yard",
    trade: "hvac",
    headquartersCity: "Cedar Rapids",
    headquartersState: "IA",
    website: "https://ecsi-alc.com",
    description:
      "Cedar Rapids commercial HVAC and building-automation contractor operating within the PremiStar (Partners Group) platform.",
  });

  const aksarben = await upsertCompany({
    name: "Aksarben ARS",
    type: "yard",
    trade: "hvac",
    headquartersCity: "La Vista",
    headquartersState: "NE",
    website: "https://www.aksarbenars.com",
    description:
      "Omaha-metro HVAC and plumbing operation of American Residential Services (ARS / Rescue Rooter); serves Council Bluffs, Iowa. Private-equity-owned via GI Partners and Charlesbank.",
  });

  const burton = await upsertCompany({
    name: "Burton A/C, Heating, Plumbing & Electrical",
    type: "yard",
    trade: "hvac",
    headquartersCity: "Omaha",
    headquartersState: "NE",
    website: "https://www.justcallburton.com",
    description:
      "Omaha-metro HVAC, plumbing, and electrical company serving Council Bluffs, Iowa. Private-equity-backed: partnered with ShoreView Industries (2020) and LightBay Capital (2021).",
  });

  // ──────────────────────────────────────────────────────────────────────
  // Acquisitions
  // ──────────────────────────────────────────────────────────────────────

  // SOURCE: https://www.omers.com/news/omers-private-equity-further-expands-us-portfolio-through-acquisition-of-turnpoint-services
  await upsertAcquisition({
    slug: "omers-acquires-turnpoint-2020",
    acquirerId: omers.id,
    targetId: turnpoint.id,
    announcedDate: "2020-11-17",
    summary:
      "OMERS Private Equity acquired TurnPoint Services from Trivest Partners, expanding into U.S. residential home services.",
    sources: [
      "https://www.omers.com/news/omers-private-equity-further-expands-us-portfolio-through-acquisition-of-turnpoint-services",
      "https://www.globenewswire.com/news-release/2020/11/17/2128161/0/en/OMERS-Private-Equity-Further-Expands-US-Portfolio-Thorough-Acquisition-of-TurnPoint-Services.html",
    ],
  });

  // SOURCE: https://www.businesswire.com/news/home/20210727005409/en/Audax-Private-Equity-to-Sell-Reedy-Industries-to-Partners-Group
  await upsertAcquisition({
    slug: "partners-group-acquires-reedy-2021",
    acquirerId: partnersGroup.id,
    targetId: premistar.id,
    announcedDate: "2021-07-27",
    summary:
      "Partners Group agreed to acquire Reedy Industries (now PremiStar) from Audax Private Equity at a roughly $1 billion valuation; Audax retained a minority stake.",
    dealValueUsd: 1_000_000_000n,
    sources: [
      "https://www.businesswire.com/news/home/20210727005409/en/Audax-Private-Equity-to-Sell-Reedy-Industries-to-Partners-Group",
      "https://premistar.com/blog/2022/05/24/partners-group-has-signed-a-definitive-agreement-to-acquire-reedy-industries-a-leading-provider-of-commercial-hvac-services/",
    ],
  });

  // SOURCE: https://www.globenewswire.com/news-release/2022/08/12/2497757/0/en/PremiStar-Acquires-Mechanical-Service-Inc-in-Iowa-City.html
  await upsertAcquisition({
    slug: "premistar-acquires-msi-2022",
    acquirerId: premistar.id,
    targetId: msi.id,
    announcedDate: "2022-08-12",
    closedDate: "2022-08-12",
    summary:
      "PremiStar (Reedy Industries) acquired Mechanical Service, Inc. of Iowa City; the business was rebranded to PremiStar in 2024.",
    sources: [
      "https://www.globenewswire.com/news-release/2022/08/12/2497757/0/en/PremiStar-Acquires-Mechanical-Service-Inc-in-Iowa-City.html",
      "https://premistar.com/blog/2024/05/07/mechanical-service-of-iowa-rebrands-as-premistar/",
    ],
  });

  // ──────────────────────────────────────────────────────────────────────
  // Ownership edges — PE sponsor → platform
  // ──────────────────────────────────────────────────────────────────────

  await upsertEdge({
    parentId: omers.id,
    childId: turnpoint.id,
    relationship: "controls",
    startDate: "2020-11-17",
    note: "OMERS Private Equity acquired TurnPoint Services from Trivest Partners in November 2020.",
    sources: [
      "https://www.omers.com/news/omers-private-equity-further-expands-us-portfolio-through-acquisition-of-turnpoint-services",
    ],
  });

  await upsertEdge({
    parentId: trivest.id,
    childId: turnpoint.id,
    relationship: "controls",
    endDate: "2020-11-17",
    note: "Trivest Partners was the founding private-equity backer of TurnPoint Services, exiting in the 2020 sale to OMERS.",
    sources: [
      "https://www.omers.com/news/omers-private-equity-further-expands-us-portfolio-through-acquisition-of-turnpoint-services",
    ],
  });

  await upsertEdge({
    parentId: partnersGroup.id,
    childId: premistar.id,
    relationship: "controls",
    startDate: "2021-07-27",
    note: "Partners Group acquired Reedy Industries (now PremiStar) from Audax Private Equity in 2021.",
    sources: [
      "https://www.businesswire.com/news/home/20210727005409/en/Audax-Private-Equity-to-Sell-Reedy-Industries-to-Partners-Group",
    ],
  });

  await upsertEdge({
    parentId: audax.id,
    childId: premistar.id,
    relationship: "controls",
    endDate: "2021-07-27",
    note: "Audax Private Equity was the prior owner of Reedy Industries (now PremiStar), retaining a minority stake after the 2021 sale to Partners Group.",
    sources: [
      "https://www.businesswire.com/news/home/20210727005409/en/Audax-Private-Equity-to-Sell-Reedy-Industries-to-Partners-Group",
    ],
  });

  // SOURCE: https://www.prnewswire.com/news-releases/gi-partners-joins-charlesbank-capital-partners-to-accelerate-growth-at-american-residential-services-301131174.html
  await upsertEdge({
    parentId: giPartners.id,
    childId: ars.id,
    relationship: "controls",
    startDate: "2020-09-01",
    note: "GI Partners acquired a majority stake in American Residential Services in September 2020, joining existing investor Charlesbank.",
    sources: [
      "https://www.prnewswire.com/news-releases/gi-partners-joins-charlesbank-capital-partners-to-accelerate-growth-at-american-residential-services-301131174.html",
    ],
  });

  await upsertEdge({
    parentId: charlesbank.id,
    childId: ars.id,
    relationship: "controls",
    startDate: "2014-01-01",
    note: "Charlesbank Capital Partners has been an investor in American Residential Services since 2014, retaining a stake alongside GI Partners.",
    sources: [
      "https://www.charlesbank.com/investments/american-residential-services/",
    ],
  });

  // SOURCE: https://www.lightbay.com/lightbay-capital-announces-partnership-with-burton-a-leading-midwestern-provider-of-hvac-plumbing-and-electrical-services/
  await upsertEdge({
    parentId: lightbay.id,
    childId: burton.id,
    relationship: "controls",
    startDate: "2021-12-14",
    note: "LightBay Capital announced a partnership with Burton (HVAC / plumbing / electrical) in December 2021.",
    sources: [
      "https://www.lightbay.com/lightbay-capital-announces-partnership-with-burton-a-leading-midwestern-provider-of-hvac-plumbing-and-electrical-services/",
    ],
  });

  await upsertEdge({
    parentId: shoreview.id,
    childId: burton.id,
    relationship: "controls",
    startDate: "2020-03-01",
    endDate: "2021-12-14",
    note: "ShoreView Industries was an earlier private-equity backer of Burton (2020) before the LightBay partnership.",
    sources: [
      "https://www.lightbay.com/lightbay-capital-announces-partnership-with-burton-a-leading-midwestern-provider-of-hvac-plumbing-and-electrical-services/",
    ],
  });

  // ──────────────────────────────────────────────────────────────────────
  // Ownership edges — platform → local Iowa brand
  // ──────────────────────────────────────────────────────────────────────

  const turnpointBrands = "https://www.turnpointservices.com/turnpoint-brands/";

  await upsertEdge({
    parentId: turnpoint.id,
    childId: schaal.id,
    relationship: "owns",
    note: "Schaal Plumbing, Heating & Cooling is a TurnPoint Services brand.",
    sources: [
      "https://www.turnpointservices.com/turnpoint-brands/schaal-heating-cooling-plumbing/",
      turnpointBrands,
    ],
  });

  await upsertEdge({
    parentId: turnpoint.id,
    childId: bellBrothers.id,
    relationship: "owns",
    note: "Bell Brothers Heating & Air Conditioning (Des Moines) is a TurnPoint Services brand.",
    sources: [turnpointBrands],
  });

  await upsertEdge({
    parentId: turnpoint.id,
    childId: greens.id,
    relationship: "owns",
    note: "Green's Appliance, Heating & Cooling is a TurnPoint Services brand.",
    sources: [turnpointBrands],
  });

  await upsertEdge({
    parentId: premistar.id,
    childId: msi.id,
    relationship: "owns",
    startDate: "2022-08-12",
    note: "Mechanical Service, Inc. was acquired by PremiStar in 2022 and now operates under the PremiStar brand.",
    sources: [
      "https://www.globenewswire.com/news-release/2022/08/12/2497757/0/en/PremiStar-Acquires-Mechanical-Service-Inc-in-Iowa-City.html",
    ],
  });

  await upsertEdge({
    parentId: premistar.id,
    childId: ecs.id,
    relationship: "owns",
    note: "Environmental Control Solutions (Cedar Rapids) operates within the PremiStar platform.",
    sources: ["https://premistar.com/our-companies/"],
  });

  await upsertEdge({
    parentId: ars.id,
    childId: aksarben.id,
    relationship: "owns",
    note: "Aksarben ARS is the Omaha-metro operation of American Residential Services, serving Council Bluffs, Iowa.",
    sources: ["https://www.aksarbenars.com/locations/council-bluffs"],
  });

  // ──────────────────────────────────────────────────────────────────────
  // Iowa locations (lat/lng left null — run `pnpm geocode:missing` to fill)
  // ──────────────────────────────────────────────────────────────────────

  await upsertLocation({
    companyId: schaal.id,
    displayName: "Schaal Plumbing, Heating & Cooling",
    addressLine1: "5670 NW Beaver Dr",
    city: "Johnston",
    state: "IA",
    zip: "50131",
    trade: "hvac",
    services: ["hvac_install", "hvac_service", "plumbing_repair"],
    sourceUrl: "https://callschaalyaall.com/",
    sources: ["https://callschaalyaall.com/"],
  });

  await upsertLocation({
    companyId: bellBrothers.id,
    displayName: "Bell Brothers Heating & Air Conditioning",
    addressLine1: "2822 6th Ave",
    city: "Des Moines",
    state: "IA",
    zip: "50313",
    trade: "hvac",
    services: ["hvac_install", "hvac_service"],
    sourceUrl: "https://bellbrothers.com/",
    sources: ["https://bellbrothers.com/"],
  });

  await upsertLocation({
    companyId: greens.id,
    displayName: "Green's Appliance, Heating & Cooling",
    addressLine1: "4425 NE Hubbell Ave",
    city: "Des Moines",
    state: "IA",
    zip: "50317",
    trade: "hvac",
    services: ["hvac_install", "hvac_service"],
    sourceUrl: "https://greensahc.com/",
    sources: ["https://greensahc.com/"],
  });

  await upsertLocation({
    companyId: msi.id,
    displayName: "Mechanical Service, Inc. (PremiStar)",
    addressLine1: "1218 Highland Ct",
    city: "Iowa City",
    state: "IA",
    zip: "52240",
    trade: "hvac",
    services: ["hvac_install", "hvac_service"],
    sourceUrl: "https://mechanicalserviceinc.com/",
    sources: ["https://mechanicalserviceinc.com/"],
  });

  await upsertLocation({
    companyId: ecs.id,
    displayName: "Environmental Control Solutions",
    addressLine1: "4935 Bowling St SW Ste G",
    city: "Cedar Rapids",
    state: "IA",
    zip: "52404",
    trade: "hvac",
    services: ["hvac_install", "hvac_service"],
    sourceUrl: "https://ecsi-alc.com/",
    sources: ["https://ecsi-alc.com/"],
  });

  return {
    turnpoint,
    premistar,
    ars,
    brands: { schaal, bellBrothers, greens, msi, ecs, aksarben, burton },
  };
}
