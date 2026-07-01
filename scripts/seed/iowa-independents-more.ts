import { upsertCompany, upsertLocation } from "./_helpers";

/**
 * Iowa residential-trades expansion — statewide locally-owned independents (batch 2).
 *
 * A wider sweep of family-owned and employee-owned (ESOP) HVAC / plumbing /
 * electrical companies across Iowa's small and mid-size metros, sourced from
 * each company's own site or a directory/BBB listing. Each is seeded as an
 * operating brand (`yard`) with no parent edge, so it classifies as
 * Independent. "Independent" reflects the best available public evidence;
 * source-backed corrections are welcome via /submit. lat/lng left null — run
 * `pnpm geocode:missing` to place them on the map.
 */

type Trade = "plumbing" | "electrical" | "hvac";

type Independent = {
  name: string;
  legalName?: string;
  trade: Trade;
  city: string;
  zip: string;
  address: string;
  website?: string;
  foundedYear?: number;
  description: string;
  services: string[];
  sources: string[];
};

const COMPANIES: Independent[] = [
  // ── Cedar Rapids (electrical, city proper) ────────────────────────────
  {
    name: "Acme Electric Company",
    trade: "electrical",
    city: "Cedar Rapids",
    zip: "52404",
    address: "1060 Capital Dr SW",
    website: "https://acmeelectric.com",
    foundedYear: 1950,
    description:
      "Cedar Rapids electrical contractor, family-owned and now in its third generation under Jackson Barrigar; founded in 1950 and serving the Cedar Rapids-Iowa City corridor.",
    services: ["electrical_repair", "panel_wiring", "generator"],
    sources: ["https://acmeelectric.com/about-acme/"],
  },
  {
    name: "Duball Electric",
    legalName: "Duball Electric, Inc.",
    trade: "electrical",
    city: "Cedar Rapids",
    zip: "52404",
    address: "901 2nd Ave SW",
    website: "https://www.duballelectric.com",
    description:
      "Family-owned Cedar Rapids electrical contractor serving eastern Iowa for about three decades.",
    services: ["electrical_repair", "panel_wiring", "generator"],
    sources: ["https://www.duballelectric.com/"],
  },
  // ── Fort Dodge ────────────────────────────────────────────────────────
  {
    name: "Riley-Armstrong Plumbing & Heating",
    trade: "plumbing",
    city: "Fort Dodge",
    zip: "50501",
    address: "11 N 20th St",
    website: "https://business.greaterfortdodge.com/member-list/Details/riley-armstrong-plumbing-heating-inc-3254718",
    foundedYear: 1989,
    description:
      "Locally-owned Fort Dodge plumbing and heating company, established in 1989.",
    services: ["plumbing_repair", "hvac_service"],
    sources: [
      "https://business.greaterfortdodge.com/member-list/Details/riley-armstrong-plumbing-heating-inc-3254718",
    ],
  },
  {
    name: "Midstate Plumbing & Heating",
    legalName: "Midstate Plumbing & Heating Inc.",
    trade: "plumbing",
    city: "Fort Dodge",
    zip: "50501",
    address: "2120 2nd Ave S",
    website: "https://www.midstateplumbingheating.com",
    description:
      "Locally-owned Fort Dodge plumbing, heating, and air-conditioning contractor with over 40 years in the trade.",
    services: ["plumbing_repair", "hvac_install", "hvac_service"],
    sources: ["https://www.midstateplumbingheating.com/"],
  },
  // ── Muscatine ─────────────────────────────────────────────────────────
  {
    name: "Kirk Butcher Plumbing & Heating",
    legalName: "Kirk Butcher Plumbing & Heating, Inc.",
    trade: "plumbing",
    city: "Muscatine",
    zip: "52761",
    address: "821 Park Ave",
    website: "https://kirkbutcherplumbing.com",
    foundedYear: 1995,
    description:
      "Family-owned and operated Muscatine plumbing and heating company, in business since 1995.",
    services: ["plumbing_repair", "hvac_service", "water_heater"],
    sources: ["https://kirkbutcherplumbing.com/"],
  },
  {
    name: "Kelly Heating, Cooling & Plumbing",
    legalName: "Kelly Heating, Cooling & Plumbing, Inc.",
    trade: "hvac",
    city: "Muscatine",
    zip: "52761",
    address: "913 W Mississippi Dr",
    foundedYear: 1972,
    description:
      "Family-owned Muscatine heating, cooling, and plumbing company owned by Tim and Stephanie Kelly; in business since 1972.",
    services: ["hvac_install", "hvac_service", "plumbing_repair"],
    sources: [
      "https://www.bbb.org/us/ia/muscatine/profile/heating-and-air-conditioning/kelly-heating-cooling-plumbing-inc-0664-18001501",
    ],
  },
  {
    name: "RIVO, Inc.",
    legalName: "RIVO, Inc. (formerly Boche Plumbing)",
    trade: "plumbing",
    city: "Muscatine",
    zip: "52761",
    address: "1109 Grandview Ave",
    website: "https://rivo-inc.com",
    description:
      "Locally-owned Muscatine plumbing company (formerly Boche Plumbing).",
    services: ["plumbing_repair", "drain_sewer", "water_heater"],
    sources: ["https://rivo-inc.com/"],
  },
  // ── Clinton ───────────────────────────────────────────────────────────
  {
    name: "Air Control, Inc.",
    trade: "hvac",
    city: "Clinton",
    zip: "52732",
    address: "80 14th Avenue North",
    website: "https://aciheatingandcooling.com",
    foundedYear: 1956,
    description:
      "Family-owned and operated Clinton heating and cooling company, in business since 1956.",
    services: ["hvac_install", "hvac_service"],
    sources: ["https://aciheatingandcooling.com/"],
  },
  // ── Keokuk ────────────────────────────────────────────────────────────
  {
    name: "Kraus & Son Heating & Air",
    trade: "hvac",
    city: "Keokuk",
    zip: "52632",
    address: "1012 Main St",
    website: "https://krausandsons.com",
    foundedYear: 1932,
    description:
      "Fourth-generation family-owned Keokuk heating and air-conditioning company, operated by Adam Kraus, great-grandson of the founder; established 1932.",
    services: ["hvac_install", "hvac_service"],
    sources: ["https://krausandsons.com/about-us/"],
  },
  {
    name: "Patterson Plumbing & Heating",
    trade: "plumbing",
    city: "Keokuk",
    zip: "52632",
    address: "3006 Middle Rd",
    foundedYear: 1968,
    description:
      "Locally-owned Keokuk plumbing and heating company (owner Mark Patterson).",
    services: ["plumbing_repair", "hvac_service"],
    sources: ["https://www.yellowpages.com/keokuk-ia/mip/patterson-plumbing-heating-11536227"],
  },
  // ── Mount Pleasant ────────────────────────────────────────────────────
  {
    name: "Taft Plumbing, Heating & Cooling",
    trade: "plumbing",
    city: "Mount Pleasant",
    zip: "52641",
    address: "201 E Monroe St",
    website: "https://taftllc.com",
    foundedYear: 1984,
    description:
      "Locally-owned Mount Pleasant plumbing, heating, and cooling company owned and operated by John Zihlman.",
    services: ["plumbing_repair", "hvac_service"],
    sources: ["http://business.mountpleasantiowa.org/list/member/taft-plg-htg-cooling-1007"],
  },
  // ── Maquoketa ─────────────────────────────────────────────────────────
  {
    name: "Kellams & Bertsch",
    legalName: "Kellams & Bertsch, Inc.",
    trade: "hvac",
    city: "Maquoketa",
    zip: "52060",
    address: "105 E Quarry St",
    foundedYear: 1940,
    description:
      "Locally-owned Maquoketa heating and air-conditioning company (President Lee Cook); serving the area since 1940.",
    services: ["hvac_install", "hvac_service"],
    sources: [
      "https://www.bbb.org/us/ia/maquoketa/profile/heating-and-air-conditioning/kellams-bertsch-inc-0664-18001303",
    ],
  },
  // ── Carroll ───────────────────────────────────────────────────────────
  {
    name: "Drees Co.",
    trade: "hvac",
    city: "Carroll",
    zip: "51401",
    address: "609 N Carroll St",
    website: "https://dreesco.com",
    foundedYear: 1933,
    description:
      "Family-owned Carroll mechanical contractor (HVAC, plumbing, and electrical) founded in 1933; led by Howard Drees with Sara Drees.",
    services: ["hvac_install", "hvac_service", "plumbing_repair", "electrical_repair"],
    sources: ["https://dreesco.com/"],
  },
  // ── Denison ───────────────────────────────────────────────────────────
  {
    name: "Totten Plumbing & Heating",
    trade: "plumbing",
    city: "Denison",
    zip: "51442",
    address: "2609 4th Ave S",
    description: "Locally-owned Denison plumbing and heating company.",
    services: ["plumbing_repair", "hvac_service"],
    sources: ["https://www.facebook.com/tottensplumbing/"],
  },
  // ── Le Mars (ESOP) ────────────────────────────────────────────────────
  {
    name: "Langel's Plumbing, Heating, AC & Well Service",
    legalName: "Langel's Plumbing, Heating, AC & Well Service, Inc.",
    trade: "plumbing",
    city: "Le Mars",
    zip: "51031",
    address: "735 6th St SE",
    website: "https://langelsplumbing.com",
    description:
      "Employee-owned Le Mars plumbing, heating, cooling, and well-service company — employee-controlled rather than private-equity-owned.",
    services: ["plumbing_repair", "hvac_service", "well_septic"],
    sources: ["https://langelsplumbing.com/"],
  },
  // ── Storm Lake ────────────────────────────────────────────────────────
  {
    name: "Wiese Plumbing & Heating",
    legalName: "Wiese Plumbing & Heating, Inc.",
    trade: "plumbing",
    city: "Storm Lake",
    zip: "50588",
    address: "1400 Michigan St",
    description: "Locally-owned, independent Storm Lake plumbing and heating company.",
    services: ["plumbing_repair", "hvac_service"],
    sources: ["https://www.lennox.com/residential/locate/dealer/ia/storm-lake/wiese-plbg-and-htg-inc"],
  },
  // ── Spencer ───────────────────────────────────────────────────────────
  {
    name: "Christians Sheet Metal, HVAC",
    legalName: "Christians Sheet Metal, HVAC, Inc.",
    trade: "hvac",
    city: "Spencer",
    zip: "51301",
    address: "2416 Highway Blvd",
    website: "https://christianssheetmetal.com",
    foundedYear: 1925,
    description:
      "Family-owned Spencer HVAC, plumbing, and sheet-metal company, established 1925.",
    services: ["hvac_install", "hvac_service", "plumbing_repair"],
    sources: ["https://www.christianssheetmetal.com/"],
  },
  // ── Spirit Lake ───────────────────────────────────────────────────────
  {
    name: "Lakes Plumbing, Heating & Cooling",
    trade: "plumbing",
    city: "Spirit Lake",
    zip: "51360",
    address: "1902 Zenith Ave",
    website: "https://lakesphc.com",
    foundedYear: 1975,
    description:
      "Family-owned Spirit Lake plumbing, heating, and cooling company serving the Iowa Great Lakes since 1975.",
    services: ["plumbing_repair", "hvac_install", "hvac_service"],
    sources: ["https://www.lakesphc.com/"],
  },
  // ── Orange City ───────────────────────────────────────────────────────
  {
    name: "Hubers Plumbing, Heating & Air Conditioning",
    legalName: "Hubers Plumbing, Heating & Air Conditioning, Inc.",
    trade: "plumbing",
    city: "Orange City",
    zip: "51041",
    address: "1104 IA-10 W",
    website: "https://hubersplumbingoc.com",
    foundedYear: 2000,
    description:
      "Family-owned Orange City plumbing, heating, and air-conditioning company (the Hubers family), founded in 2000.",
    services: ["plumbing_repair", "hvac_install", "hvac_service"],
    sources: ["https://hubersplumbingoc.com/about/"],
  },
  // ── Atlantic ──────────────────────────────────────────────────────────
  {
    name: "Camblin Mechanical",
    legalName: "Camblin Mechanical, Inc.",
    trade: "plumbing",
    city: "Atlantic",
    zip: "50022",
    address: "714 W 7th St",
    website: "https://camblinmechanical.com",
    foundedYear: 1918,
    description:
      "Family-owned Atlantic plumbing and mechanical contractor spanning three generations; founded in 1918.",
    services: ["plumbing_repair", "hvac_install", "hvac_service"],
    sources: ["https://www.camblinmechanical.com/"],
  },
  // ── Creston ───────────────────────────────────────────────────────────
  {
    name: "Orr Heating & Air Conditioning",
    legalName: "Orr Heating & Air Conditioning Inc.",
    trade: "hvac",
    city: "Creston",
    zip: "50801",
    address: "314 W Montgomery St",
    website: "https://orrheatingandairconditioning.com",
    description: "Family-owned Creston heating and air-conditioning company.",
    services: ["hvac_install", "hvac_service"],
    sources: ["https://orrheatingandairconditioning.com/"],
  },
  // ── Harlan ────────────────────────────────────────────────────────────
  {
    name: "Alpha & Omega",
    trade: "plumbing",
    city: "Harlan",
    zip: "51537",
    address: "607 Court St",
    website: "https://alphaomegaharlan.com",
    foundedYear: 1996,
    description:
      "Locally-owned and operated Harlan plumbing, HVAC, and electrical company, established 1996.",
    services: ["plumbing_repair", "hvac_service", "electrical_repair"],
    sources: ["https://alphaomegaharlan.com/"],
  },
  // ── Cherokee ──────────────────────────────────────────────────────────
  {
    name: "Modern Heating, Inc.",
    trade: "hvac",
    city: "Cherokee",
    zip: "51012",
    address: "800 N 2nd St",
    website: "https://modernheatingcherokee.com",
    foundedYear: 1938,
    description:
      "Family-owned Cherokee heating and cooling company (the Lucas family — President Dan Lucas), established 1938.",
    services: ["hvac_install", "hvac_service", "plumbing_repair"],
    sources: ["https://www.modernheatingcherokee.com/"],
  },
  // ── Boone ─────────────────────────────────────────────────────────────
  {
    name: "Pritchard Bros. Plumbing, Heating & Cooling",
    trade: "plumbing",
    city: "Boone",
    zip: "50036",
    address: "1019 Story St",
    website: "https://pritchardbros.com",
    foundedYear: 1946,
    description:
      "Family-owned Boone plumbing, heating, and cooling company serving central Iowa for over 75 years (since 1946).",
    services: ["plumbing_repair", "hvac_install", "hvac_service"],
    sources: ["https://pritchardbros.com/about/"],
  },
  {
    name: "Duncan Heating & Plumbing",
    legalName: "Duncan Heating & Plumbing, Inc.",
    trade: "hvac",
    city: "Boone",
    zip: "50036",
    address: "706 Allen St",
    website: "https://duncanhp.com",
    foundedYear: 1972,
    description:
      "Family-owned Boone heating and plumbing company, in business since 1972.",
    services: ["hvac_install", "hvac_service", "plumbing_repair"],
    sources: ["https://duncanhp.com/"],
  },
  {
    name: "Kruck Plumbing & Heating",
    trade: "plumbing",
    city: "Boone",
    zip: "50036",
    address: "615 Story St",
    website: "https://kruckph.com",
    foundedYear: 1941,
    description:
      "Locally-owned Boone plumbing and heating company serving central Iowa since 1941.",
    services: ["plumbing_repair", "hvac_service"],
    sources: ["https://kruckph.com/"],
  },
  // ── Grinnell ──────────────────────────────────────────────────────────
  {
    name: "German Plumbing Heating & Cooling",
    legalName: "German Plumbing Heating & Cooling, Inc.",
    trade: "plumbing",
    city: "Grinnell",
    zip: "50112",
    address: "610 1st Ave",
    website: "https://germanphc.com",
    foundedYear: 1898,
    description:
      "Fourth-generation family-owned Grinnell plumbing, heating, and cooling company, founded in 1898.",
    services: ["plumbing_repair", "hvac_install", "hvac_service"],
    sources: ["https://germanphc.com/"],
  },
  {
    name: "Jensen Heating & Air Conditioning",
    trade: "hvac",
    city: "Grinnell",
    zip: "50112",
    address: "519 West St",
    website: "https://jensenheating.com",
    foundedYear: 1987,
    description:
      "Family-owned Grinnell heating and air-conditioning company founded in 1987 by Tracy and Vicki Jensen.",
    services: ["hvac_install", "hvac_service"],
    sources: ["https://jensenheating.com/about/"],
  },
  // ── Newton ────────────────────────────────────────────────────────────
  {
    name: "Warnick Mechanical",
    trade: "plumbing",
    city: "Newton",
    zip: "50208",
    address: "1618 N 15th Ave E",
    website: "https://warnickmechanical.com",
    foundedYear: 1969,
    description:
      "Locally-owned Newton plumbing and mechanical contractor serving the area since 1969.",
    services: ["plumbing_repair", "hvac_install", "hvac_service"],
    sources: ["https://warnickmechanical.com/"],
  },
  // ── Pella ─────────────────────────────────────────────────────────────
  {
    name: "Van Rheenen Inc.",
    trade: "hvac",
    city: "Pella",
    zip: "50219",
    address: "1707 Washington St",
    website: "https://vanrheeneninc.com",
    description:
      "Family-owned, second-generation Pella HVAC and plumbing company.",
    services: ["hvac_install", "hvac_service", "plumbing_repair"],
    sources: ["https://vanrheeneninc.com/"],
  },
  {
    name: "Van Haaften Plumbing & Heating",
    legalName: "Van Haaften Plumbing & Heating, Inc.",
    trade: "plumbing",
    city: "Pella",
    zip: "50219",
    address: "914 W 8th St",
    website: "https://vanhaaftenplumbingandheating.com",
    foundedYear: 1951,
    description:
      "Locally-owned Pella plumbing and heating company serving the community since 1951.",
    services: ["plumbing_repair", "hvac_service"],
    sources: ["https://vanhaaftenplumbingandheating.com/"],
  },
  // ── Iowa Falls ────────────────────────────────────────────────────────
  {
    name: "Tjarks Plumbing, Heating & Air Conditioning",
    legalName: "Tjarks Plumbing, Heating & Air Conditioning, Inc.",
    trade: "plumbing",
    city: "Iowa Falls",
    zip: "50126",
    address: "121 River St",
    website: "https://tjarksplumbing.com",
    foundedYear: 1989,
    description:
      "Locally-owned Iowa Falls plumbing, heating, and air-conditioning company serving the area since 1989.",
    services: ["plumbing_repair", "hvac_install", "hvac_service"],
    sources: ["https://tjarksplumbing.com/"],
  },
  // ── Waverly ───────────────────────────────────────────────────────────
  {
    name: "Crystal Heating, Plumbing & Excavating",
    trade: "hvac",
    city: "Waverly",
    zip: "50677",
    address: "1210 W Bremer Ave",
    foundedYear: 1930,
    description:
      "Locally-owned Waverly heating, plumbing, and excavating company (owner Andrew Barber); established 1930.",
    services: ["hvac_install", "hvac_service", "plumbing_repair"],
    sources: ["https://www.facebook.com/crystalhpe"],
  },
  // ── New Hampton ───────────────────────────────────────────────────────
  {
    name: "Mick Gage Plumbing & Heating",
    trade: "plumbing",
    city: "New Hampton",
    zip: "50659",
    address: "511 W Milwaukee St",
    website: "https://mickgage.com",
    foundedYear: 1969,
    description:
      "Family-owned plumbing and heating company based in New Hampton (with a Charles City store), serving north-central Iowa since 1969.",
    services: ["plumbing_repair", "hvac_install", "hvac_service"],
    sources: ["https://mickgage.com/"],
  },
  // ── Fort Dodge (electrical) ───────────────────────────────────────────
  {
    name: "Bemrich Electric & Telephone",
    trade: "electrical",
    city: "Fort Dodge",
    zip: "50501",
    address: "110 S 21st St",
    website: "https://bemrich.com",
    foundedYear: 1984,
    description:
      "Locally-owned and operated Fort Dodge electrical and low-voltage contractor, established 1984.",
    services: ["electrical_repair", "panel_wiring", "generator"],
    sources: ["https://bemrich.com/"],
  },
  // ── Marshalltown ──────────────────────────────────────────────────────
  {
    name: "Kapaun & Brown, Inc.",
    trade: "hvac",
    city: "Marshalltown",
    zip: "50158",
    address: "1002 W Lincoln Way",
    website: "https://kapaunandbrowninc.com",
    foundedYear: 1974,
    description:
      "Locally-owned Marshalltown heating, cooling, and plumbing company, in business since 1974.",
    services: ["hvac_install", "hvac_service", "plumbing_repair"],
    sources: ["https://kapaunandbrowninc.com/"],
  },
];

export async function seedIowaIndependentsMore() {
  for (const c of COMPANIES) {
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
  }
  return { added: COMPANIES.length };
}
