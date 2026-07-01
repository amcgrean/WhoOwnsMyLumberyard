import { upsertCompany, upsertEdge } from "./_helpers";

/**
 * National home-services roll-ups (HVAC / plumbing / electrical).
 *
 * The major private-equity platforms consolidating residential (and some
 * commercial) trade companies across the U.S. This gives the ownership graph
 * national reach so that, as trade locations are added state by state, their
 * ultimate owners already exist and resolve correctly.
 *
 * TurnPoint Services, PremiStar (Reedy Industries), and American Residential
 * Services are defined in `iowa-home-services.ts` (they have Iowa brands);
 * `upsertCompany` is slug-keyed and idempotent, so any overlap is safe.
 *
 * Every edge is source-cited and seeded verified=false. Platforms flagged
 * "commercial" primarily serve commercial/industrial rather than residential
 * customers. Minority co-investors are described in notes rather than asserted
 * as separate control edges.
 */
export async function seedNationalHomeServices() {
  // Helper: create a PE sponsor, a platform, and a control edge in one shot.
  type CompanyInput = Omit<Parameters<typeof upsertCompany>[0], "type">;
  async function platform(opts: {
    pe: CompanyInput;
    platform: CompanyInput;
    edgeNote: string;
    startDate?: string;
    sources: string[];
  }) {
    const sponsor = await upsertCompany({ type: "pe_firm", ...opts.pe });
    const plat = await upsertCompany({ type: "consolidator", ...opts.platform });
    await upsertEdge({
      parentId: sponsor.id,
      childId: plat.id,
      relationship: "controls",
      startDate: opts.startDate,
      note: opts.edgeNote,
      sources: opts.sources,
    });
    return { sponsor, plat };
  }

  // Apex Service Partners — Alpine Investors
  await platform({
    pe: {
      name: "Alpine Investors",
      headquartersCity: "San Francisco",
      headquartersState: "CA",
      website: "https://alpineinvestors.com",
      description:
        "People-driven private-equity firm; founder and controlling owner of Apex Service Partners, the largest U.S. residential HVAC/plumbing/electrical roll-up.",
    },
    platform: {
      name: "Apex Service Partners",
      headquartersCity: "Tampa",
      headquartersState: "FL",
      website: "https://apexservicepartners.com",
      description:
        "Largest U.S. residential HVAC, plumbing, and electrical consolidator — 100+ local brands across ~46 states. Controlled by Alpine Investors since its 2019 founding; Partners Group joined via a continuation fund (2023) and Apollo Funds announced a strategic minority stake (2026).",
    },
    startDate: "2019-01-01",
    edgeNote:
      "Alpine Investors founded and controls Apex Service Partners (2019).",
    sources: [
      "https://alpineinvestors.com/update/alpine-launches-apex-service-partners/",
      "https://www.apollo.com/insights-news/pressreleases/2026/05/apex-service-partners-and-alpine-investors-announce-strategic-mi",
    ],
  });

  // Wrench Group — Leonard Green & Partners
  await platform({
    pe: {
      name: "Leonard Green & Partners",
      headquartersCity: "Los Angeles",
      headquartersState: "CA",
      website: "https://www.leonardgreen.com",
      description:
        "Private-equity firm; majority owner of Wrench Group. TSG Consumer Partners and Oak Hill Capital hold minority stakes (2022).",
    },
    platform: {
      name: "Wrench Group",
      headquartersCity: "Marietta",
      headquartersState: "GA",
      website: "https://www.wrenchgroup.com",
      description:
        "Residential HVAC, plumbing, and electrical platform (~25 brands including Coolray, Parker & Sons, Abacus, and Lindstrom) across ~15 states. Majority-owned by Leonard Green & Partners since 2019.",
    },
    startDate: "2019-01-01",
    edgeNote:
      "Leonard Green & Partners holds majority control of Wrench Group (2019); TSG Consumer Partners and Oak Hill Capital took minority stakes in 2022.",
    sources: [
      "https://www.businesswire.com/news/home/20221108006362/en/TSG-Consumer-Partners-and-Oak-Hill-Partner-with-Leonard-Green-and-Management-to-Enhance-The-Wrench-Groups-Next-Phase-of-Growth",
    ],
  });

  // Sila Services — Goldman Sachs Alternatives
  await platform({
    pe: {
      name: "Goldman Sachs Alternatives",
      headquartersCity: "New York",
      headquartersState: "NY",
      website: "https://www.goldmansachs.com/alternatives/",
      description:
        "Private-equity business of Goldman Sachs Asset Management; majority owner of Sila Services since 2024.",
    },
    platform: {
      name: "Sila Services",
      headquartersCity: "King of Prussia",
      headquartersState: "PA",
      website: "https://silaservices.com",
      description:
        "Residential HVAC, plumbing, and electrical platform (30+ brands) across the Northeast, Mid-Atlantic, and Midwest. Majority-owned by Goldman Sachs Alternatives (2024), which bought out Morgan Stanley Capital Partners.",
    },
    startDate: "2024-11-01",
    edgeNote:
      "Goldman Sachs Alternatives acquired majority control of Sila Services in November 2024 from Morgan Stanley Capital Partners.",
    sources: [
      "https://www.businesswire.com/news/home/20241110227672/en/Sila-Services-Announces-Equity-Investment-From-Goldman-Sachs-Alternatives-Private-Equity-Business",
    ],
  });

  // Champions Group Holdings — Blackstone (formerly Service Champions)
  await platform({
    pe: {
      name: "Blackstone",
      legalName: "Blackstone Inc.",
      headquartersCity: "New York",
      headquartersState: "NY",
      website: "https://www.blackstone.com",
      description:
        "Global alternative-asset manager; agreed in 2026 to acquire Champions Group Holdings (Service Champions) at roughly $2.5 billion.",
    },
    platform: {
      name: "Champions Group Holdings",
      legalName: "Champions Group Holdings, LLC",
      headquartersCity: "Brea",
      headquartersState: "CA",
      website: "https://www.championsgrp.com",
      description:
        "Residential HVAC platform (brands include Service Champions, ASI, Moore, Hobaica, Howard Air, and a California-based Bell Brothers of Sacramento — not the Iowa company of the same name). Led by CEO Leland Smith. Blackstone agreed to acquire it in 2026 from Odyssey Investment Partners, which retains a minority stake.",
    },
    startDate: "2026-02-01",
    edgeNote:
      "Blackstone agreed to acquire Champions Group Holdings in February 2026 (~$2.5B) from Odyssey Investment Partners, which retains a minority stake.",
    sources: [
      "https://peprofessional.com/2026/02/blackstone-strikes-deal-for-home-services-provider-champions-group/",
      "https://www.odysseyinvestment.com/news/odyssey-investment-partners-acquires-service-champions/",
    ],
  });

  // Authority Brands — Apax Partners (franchisor)
  await platform({
    pe: {
      name: "Apax Partners",
      headquartersCity: "London",
      website: "https://www.apax.com",
      description:
        "Global private-equity firm; majority owner of Authority Brands since 2018. BCI took a significant minority stake in 2022.",
    },
    platform: {
      name: "Authority Brands",
      headquartersCity: "Columbia",
      headquartersState: "MD",
      website: "https://www.authoritybrands.com",
      description:
        "Home-services franchisor whose Clockwork brands — One Hour Heating & Air Conditioning, Benjamin Franklin Plumbing, and Mister Sparky — operate as locally-owned franchises (including in Iowa). Majority-owned by Apax Partners since 2018. Note: franchisees are independently owned and operated even though the franchisor is PE-backed.",
    },
    startDate: "2018-01-01",
    edgeNote:
      "Apax Partners has majority-owned franchisor Authority Brands since 2018; BCI took a minority stake in 2022.",
    sources: [
      "https://www.apax.com/partnerships/authority-brands/",
      "https://www.apax.com/news-views/authority-brands-welcomes-the-clockwork-brands-into-its-family/",
    ],
  });

  // Any Hour Group — Knox Lane
  await platform({
    pe: {
      name: "Knox Lane",
      headquartersCity: "San Francisco",
      headquartersState: "CA",
      website: "https://www.knoxlane.com",
      description:
        "Growth-oriented private-equity firm; partnered with The Any Hour Group in 2021.",
    },
    platform: {
      name: "Any Hour Group",
      headquartersCity: "Orem",
      headquartersState: "UT",
      website: "https://www.anyhourgroup.com",
      description:
        "Residential HVAC, plumbing, and electrical platform across the Mountain West and West. Backed by Knox Lane since 2021.",
    },
    startDate: "2021-07-01",
    edgeNote: "Knox Lane partnered with The Any Hour Group in July 2021.",
    sources: [
      "https://www.knoxlane.com/news/the-any-hour-group-partners-with-three-leading-home-services-businesses",
    ],
  });

  // Redwood Services — Altas Partners
  await platform({
    pe: {
      name: "Altas Partners",
      headquartersCity: "Toronto",
      website: "https://www.altas.com",
      description:
        "Long-term-oriented private-equity firm; majority investor in Redwood Services since 2025.",
    },
    platform: {
      name: "Redwood Services",
      headquartersCity: "Memphis",
      headquartersState: "TN",
      website: "https://www.redwoodservices.com",
      description:
        "Residential HVAC, plumbing, and electrical platform (brands include Rite Way, John C. Flood, Dean's, and Cardinal). Altas Partners took a majority stake in 2025 (~$1.1B); founding backer Union Main Group retains a minority stake.",
    },
    startDate: "2025-05-01",
    edgeNote:
      "Altas Partners made a majority investment in Redwood Services in May 2025 (~$1.1B valuation).",
    sources: [
      "https://www.businesswire.com/news/home/20250508241827/en/Redwood-Services-Announces-Strategic-Investment-from-Altas-Partners",
    ],
  });

  // Legacy Service Partners — Gridiron Capital
  await platform({
    pe: {
      name: "Gridiron Capital",
      headquartersCity: "New Canaan",
      headquartersState: "CT",
      website: "https://gridironcapital.com",
      description:
        "Private-equity firm; partnered with Legacy Service Partners in 2023.",
    },
    platform: {
      name: "Legacy Service Partners",
      headquartersCity: "Tampa",
      headquartersState: "FL",
      website: "https://www.legacyservicepartners.com",
      description:
        "Residential HVAC, plumbing, and electrical platform (33+ brands across ~19 states). Backed by Gridiron Capital since January 2023.",
    },
    startDate: "2023-01-01",
    edgeNote: "Gridiron Capital partnered with Legacy Service Partners in January 2023.",
    sources: [
      "https://www.prnewswire.com/news-releases/gridiron-capital-partners-with-legacy-service-partners-301724885.html",
    ],
  });

  // Southern Home Services (NAEHS) — Gryphon Investors
  await platform({
    pe: {
      name: "Gryphon Investors",
      headquartersCity: "San Francisco",
      headquartersState: "CA",
      website: "https://www.gryphon-inv.com",
      description:
        "Middle-market private-equity firm; majority investor in Southern HVAC / NAEHS since 2021.",
    },
    platform: {
      name: "Southern Home Services",
      legalName: "North American Equipment & Home Services (NAEHS)",
      headquartersCity: "Orlando",
      headquartersState: "FL",
      website: "https://www.southernhvac.com",
      description:
        "Residential HVAC platform (15+ brands) across the Southeast and Texas, held under holding company NAEHS. Majority-owned by Gryphon Investors since 2021 (acquired from MSouth Equity Partners).",
    },
    startDate: "2021-10-01",
    edgeNote:
      "Gryphon Investors made a majority investment in Southern HVAC (NAEHS) in 2021, acquiring it from MSouth Equity Partners.",
    sources: [
      "https://www.gryphon-inv.com/news/gryphon-investors-completes-majority-investment-in-southern-hvac-and-announces-new-home-services-holding-company/",
    ],
  });

  // Blue Cardinal Home Services Group — Percheron Capital
  await platform({
    pe: {
      name: "Percheron Capital",
      headquartersCity: "San Francisco",
      headquartersState: "CA",
      website: "https://percheron.com",
      description:
        "Private-equity firm; controlling owner of Blue Cardinal Home Services Group, launched in 2023.",
    },
    platform: {
      name: "Blue Cardinal Home Services Group",
      headquartersCity: "Dallas",
      headquartersState: "TX",
      website: "https://bluecardinalhs.com",
      description:
        "Multi-regional residential HVAC, plumbing, and electrical network launched in 2023 and controlled by Percheron Capital.",
    },
    startDate: "2023-01-01",
    edgeNote: "Percheron Capital launched and controls Blue Cardinal Home Services Group (2023).",
    sources: [
      "https://percheron.com/companies/blue-cardinal-home-services-group/",
      "https://www.prnewswire.com/news-releases/blue-cardinal-home-services-group-launches-multi-regional-network-of-residential-hvac-plumbing-and-electrical-services-businesses-301879180.html",
    ],
  });

  // Northwinds Services Group — TruArc Partners
  await platform({
    pe: {
      name: "TruArc Partners",
      headquartersCity: "New York",
      headquartersState: "NY",
      website: "https://truarcpartners.com",
      description:
        "Middle-market private-equity firm; formed the Northwinds Services Group HVAC/plumbing platform in 2021.",
    },
    platform: {
      name: "Northwinds Services Group",
      headquartersCity: "Rochester",
      headquartersState: "NY",
      website: "https://northwindsservices.com",
      description:
        "Northeast, Mid-Atlantic, and Midwest HVAC and plumbing platform anchored by Isaac Heating & Air Conditioning. Formed by TruArc Partners in 2021.",
    },
    startDate: "2021-01-01",
    edgeNote: "TruArc Partners formed the Northwinds Services Group platform in 2021.",
    sources: ["https://truarcpartners.com/news/truarc-northwinds-services"],
  });

  // Leap Partners — Concentric Equity Partners
  await platform({
    pe: {
      name: "Concentric Equity Partners",
      headquartersCity: "Chicago",
      headquartersState: "IL",
      website: "https://www.concentricequity.com",
      description:
        "Private-equity arm of Financial Investments Corporation; formed Leap Partners in 2022.",
    },
    platform: {
      name: "Leap Partners",
      headquartersCity: "Nashville",
      headquartersState: "TN",
      website: "https://www.leappartners.com",
      description:
        "Southeast residential and small-commercial HVAC, plumbing, and electrical platform formed by Concentric Equity Partners in 2022.",
    },
    startDate: "2022-03-01",
    edgeNote: "Concentric Equity Partners formed Leap Partners in March 2022.",
    sources: [
      "https://www.prnewswire.com/news-releases/concentric-equity-partners-announces-formation-of-leap-partners-and-the-recapitalization-of-conditioned-air-solutions-301510304.html",
    ],
  });

  // Horizon Services — New Mountain Capital
  await platform({
    pe: {
      name: "New Mountain Capital",
      headquartersCity: "New York",
      headquartersState: "NY",
      website: "https://www.newmountaincapital.com",
      description:
        "Private-equity firm; acquired Horizon Services in 2024 from Sun Capital Partners.",
    },
    platform: {
      name: "Horizon Services",
      headquartersCity: "Wilmington",
      headquartersState: "DE",
      website: "https://www.horizonservices.com",
      description:
        "Residential HVAC and plumbing platform (~29 locations across the Mid-Atlantic and Southeast). Owned by New Mountain Capital since 2024 (previously Sun Capital Partners).",
    },
    startDate: "2024-01-01",
    edgeNote: "New Mountain Capital acquired Horizon Services in 2024 from Sun Capital Partners.",
    sources: ["https://www.newmountaincapital.com/portfolio/horizon-services/"],
  });

  // ── Commercial / institutional mechanical roll-ups (flagged) ──────────

  // Service Logic — Bain Capital (commercial)
  await platform({
    pe: {
      name: "Bain Capital",
      legalName: "Bain Capital Private Equity, LP",
      headquartersCity: "Boston",
      headquartersState: "MA",
      website: "https://www.baincapital.com",
      description:
        "Global private investment firm; acquired a majority stake in Service Logic in 2025 (with Mubadala) from Leonard Green & Partners.",
    },
    platform: {
      name: "Service Logic",
      headquartersCity: "Charlotte",
      headquartersState: "NC",
      website: "https://www.servicelogic.com",
      description:
        "Commercial and institutional HVAC and building-automation platform (140+ locations, 5,000+ technicians). Majority-owned by Bain Capital and Mubadala since 2025.",
    },
    startDate: "2025-12-01",
    edgeNote:
      "Bain Capital (with Mubadala) completed the acquisition of Service Logic in December 2025 from Leonard Green & Partners.",
    sources: ["https://www.baincapital.com/news/bain-capital-completes-acquisition-service-logic"],
  });

  // Crete United — Ridgemont Equity Partners (commercial)
  await platform({
    pe: {
      name: "Ridgemont Equity Partners",
      headquartersCity: "Charlotte",
      headquartersState: "NC",
      website: "https://www.ridgemontep.com",
      description:
        "Middle-market private-equity firm; growth investor in Crete United (formerly Crete Mechanical Group) since 2022.",
    },
    platform: {
      name: "Crete United",
      legalName: "Crete Mechanical Group",
      headquartersCity: "Charlotte",
      headquartersState: "NC",
      website: "https://creteunited.com",
      description:
        "Commercial mechanical and energy-efficiency building-services platform (rebranded from Crete Mechanical Group in 2024). Backed by Ridgemont Equity Partners since 2022.",
    },
    startDate: "2022-06-01",
    edgeNote:
      "Ridgemont Equity Partners provided growth capital to Crete Mechanical Group (now Crete United) in June 2022.",
    sources: [
      "https://www.ridgemontep.com/press-releases/ridgemont-equity-partners-provides-growth-capital-to-crete-mechanical-group/",
    ],
  });

  // Astra Service Partners — Alpine Investors (commercial; sister to Apex)
  await platform({
    pe: {
      name: "Alpine Investors",
      headquartersCity: "San Francisco",
      headquartersState: "CA",
      website: "https://alpineinvestors.com",
    },
    platform: {
      name: "Astra Service Partners",
      headquartersCity: "San Francisco",
      headquartersState: "CA",
      website: "https://astraservicepartners.com",
      description:
        "Commercial and industrial mechanical/plumbing platform (~33 companies) under Alpine Investors' Orion Group — a sister platform to the residential-focused Apex Service Partners.",
    },
    edgeNote:
      "Alpine Investors controls Astra Service Partners via its Orion Group holding company.",
    sources: [
      "https://astraservicepartners.com/",
      "https://alpineinvestors.com/vertical-category/hvac/",
    ],
  });

  // USA Hometown Experts — MSouth Equity Partners
  await platform({
    pe: {
      name: "MSouth Equity Partners",
      headquartersCity: "Atlanta",
      headquartersState: "GA",
      website: "https://www.msouth.com",
      description:
        "Private-equity firm; owner of USA Hometown Experts. (Reported to be exploring a sale in 2026 — ownership may change.)",
    },
    platform: {
      name: "USA Hometown Experts",
      headquartersCity: "Atlanta",
      headquartersState: "GA",
      website: "https://www.usahometownexperts.com",
      description:
        "Residential HVAC, plumbing, and electrical platform (~9 locations across the Southeast). Owned by MSouth Equity Partners.",
    },
    edgeNote: "MSouth Equity Partners owns USA Hometown Experts.",
    sources: ["https://www.msouth.com/Portfolio/Bio?id=2045"],
  });
}
