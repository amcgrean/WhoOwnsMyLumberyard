# Who Owns My Trades: ownership data review (as of 2026-11-15)

Scope: the seed scripts in `scripts/seed/*.ts` and the live Iowa data at `https://who-owns-my-lumberyard.vercel.app/api/map?state=IA` (1,354 features: 438 electrical, 421 plumbing, 395 HVAC, 100 lumber). Only 29 Iowa features have a non-null owner (`o`). The rest show as not owned.

This review was read-only. No database writes, no repo edits, no paid Google APIs. I fetched homepages with plain HTTP for a fingerprint scan.

**Note on `o`.** The deployed `/api/map` returns the business's *immediate* active non-co-op, non-franchise parent, not its ultimate owner (see `app/api/map/route.ts`). So Iowa TurnPoint brands show "TurnPoint Services", not OMERS, and SRS yards show "SRS Distribution", not Home Depot. Businesses that are themselves a public company's operating entity (Builders FirstSource) get `o = null`. The repo's working tree has uncommitted changes that add a `k` (kind) property. The live API does not return `k` yet.

---

## (A) Confirmed claims

| Claim (seed) | Status | Primary / reputable source |
|---|---|---|
| OMERS PE controls TurnPoint Services (since Nov 2020, from Trivest) | Confirmed. No 2025–26 sale found. | https://www.omers.com/news/omers-private-equity-further-expands-us-portfolio-through-acquisition-of-turnpoint-services |
| TurnPoint owns Schaal (Johnston), Bell Brothers (Des Moines), Green's (Des Moines) | Confirmed on TurnPoint's brand page (55 brands; also lists Getzschman, Omaha) | https://www.turnpointservices.com/turnpoint-brands/ |
| Partners Group controls PremiStar (ex-Reedy), bought from Audax Jul 27 2021; Audax kept a minority stake | Confirmed. PremiStar is still acquiring in 2026 as a "portfolio company of Partners Group" (Armistead, Apr 2026; MSS, Jun 2026). | https://premistar.com/blog/2022/05/24/partners-group-has-signed-a-definitive-agreement-to-acquire-reedy-industries-a-leading-provider-of-commercial-hvac-services/ ; https://www.pkfod.com/?p=21476 |
| PremiStar owns Mechanical Service Inc. (Iowa City; acquired Aug 2022, rebranded "PremiStar Iowa" 2024) and Environmental Control Solutions (Cedar Rapids) | Confirmed; both listed on PremiStar "Our Companies" | https://premistar.com/our-companies/ ; https://premistar.com/blog/2024/05/07/mechanical-service-of-iowa-rebrands-as-premistar/ |
| GI Partners (majority, 2020) and Charlesbank control ARS; Aksarben ARS serves Council Bluffs | Confirmed, with a watch item: Reuters (Mar 2026) reports GI is exploring a sale of ARS at more than $3.5B, run by Rothschild. No signed deal found. The NE DOL contractor record names American Residential Services LLC as Aksarben's corporation. | https://www.prnewswire.com/news-releases/gi-partners-joins-charlesbank-capital-partners-to-accelerate-growth-at-american-residential-services-301131174.html ; https://srnnews.com/exclusive-american-residential-services-explores-3-5-billion-plus-sale-sources-say/ ; https://dol.nebraska.gov/conreg/Contractor/Details/2151825 |
| LightBay Capital backs Burton (Dec 2021), after ShoreView (2020) | Plausibly current. No later transaction found (low certainty that nothing changed). | https://www.businesswire.com/news/home/20211214005556/en/ |
| Bain Capital controls US LBM | Confirmed. Bain's Dec 2025 Service Logic release still lists US LBM in its portfolio. (See B for the Platinum dates.) | https://www.baincapital.com/news/bain-capital-completes-acquisition-service-logic |
| Home Depot owns SRS Distribution (closed Jun 2024) | Confirmed | https://corporate.homedepot.com/news/company/home-depot-and-its-subsidiary-srs-distribution-complete-acquisition-gms |
| ABC Supply owns L&W Supply (2016); Hendricks family controls ABC | Confirmed (no change found) | ABC/Forbes, as cited |
| Builders FirstSource and BMC merger (Jan 1 2021); BFS public (BLDR) | Confirmed | BFS IR |
| Carter Lumber family of companies (Holmes, Kight, Kempsville, Townsend) | Confirmed on Carter's page | https://www.carterlumber.com/company-info/family-of-companies |
| US LBM Iowa banners: Gilcrest/Jewett (acquired Jan 2021), Lumber Specialties (Dyersville, Dec 2014), Scott's, Lampert | Gilcrest/Jewett and Lumber Specialties confirmed by press. Scott's and Lampert come from US LBM's own locator (scraper), not independently verified. | https://news.uslbm.com/us-lbm-acquires-gilcrestjewett-lumber-company/ ; https://www.inddist.com/mergers-acquisitions/news/13764769/us-lbm-holdings-acquires-lumber-specialties |
| Bain Capital and Mubadala acquired Service Logic from Leonard Green (closed Dec 16 2025) | Confirmed | https://www.baincapital.com/news/bain-capital-completes-acquisition-service-logic |
| Blackstone acquiring Champions Group from Odyssey (announced Feb 17 2026, about $2.5B; Odyssey keeps a minority stake) | Confirmed as announced | https://www.ocbj.com/oc-homepage/blackstone-to-acquire-irvines-champions-group/ |
| Apex Service Partners: Alpine control; Apollo minority stake (announced May 28 2026, closing expected Q4 2026) | Confirmed (Apollo stake is minority) | https://www.apollo.com/insights-news/pressreleases/2026/05/apex-service-partners-and-alpine-investors-announce-strategic-mi |
| Leonard Green majority of Wrench Group; TSG and Oak Hill minority (2022) | No later change found | https://www.leonardgreen.com/tsg-consumer-partners-oak-hill-partner-with-leonard-green-and-management-to-enhance-wrench-groups-next-phase-of-growth/ |
| Apax majority of Authority Brands (2018; BCI minority 2022) | No sale found. Apax's Aug 2026 Oncourse sale still lists Authority as an Apax investment. | https://www.apax.com/news-views/funds-advised-by-apax-partners-acquire-authority-brands/ |
| KKR owns Neighborly (2021, from Harvest) | Still held. A Sep 2026 article on KKR's A1 Garage deal names Neighborly as a KKR portfolio company. | https://www.businesswire.com/news/home/20210708005304/en/ ; https://247wallst.com/investing/2026/09/03/private-equity-wants-your-broken-garage-door-why-kkr-thinks-they-are-worth-2-billion/ |
| Baker Group (Ankeny) ESOP; Bergen PHC (Waterloo) employee-owned; Schebler (Bettendorf) ESOP Jan 2022; CW Suter ESOP | Confirmed (company sites, press) | dsmpartnership.com; wcfcourier.com; scheblerhvac.com; siouxlandchamber.com |
| Franchise seeds: Rooter Town Denver → Mr. Rooter; Stay Cool (Roswell) → Aire Serv | Confirmed (both domains 301-redirect to mrrooter.com/denver and aireserv.com/suwanee) | — |

---

## (B) Corrections needed (existing claims that are wrong or stale)

| # | Company | What the site says | What's actually true | Confidence | Source(s) |
|---|---|---|---|---|---|
| B1 | **Beacon Building Products** (`scripts/seed/beacon.ts`) | `public_company`, ticker BECN, active | QXO acquired Beacon on **Apr 29 2025** (about $11B, $124.35/share). It is now a wholly owned QXO subsidiary renamed **QXO Building Products, Inc.**, and BECN is delisted. It needs a QXO (public) parent edge. The cited `becn.com/our-company` returns 404. | High | https://www.businesswire.com/news/home/20250429541973/en/QXO-Completes-Acquisition-of-Beacon-Roofing-Supply ; https://www.sec.gov/Archives/edgar/data/1236275/000114036125016371/ef20048077_ex99-1.htm |
| B2 | **GMS Inc.** (`scripts/seed/gms.ts`), and Iowa's **Tamarack Materials (Iowa City)**, whose page says "Ultimately owned by GMS Inc. · Public Company" | Public company (NYSE: GMS) | Home Depot completed its acquisition of GMS through **SRS Distribution** on **Sep 4 2025** (about $5.5B EV). GMS is now a direct subsidiary of SRS and an indirect wholly owned subsidiary of Home Depot. Add GMS `subsidiary_of` SRS and retype it from public company. | High | https://corporate.homedepot.com/news/company/home-depot-and-its-subsidiary-srs-distribution-complete-acquisition-gms |
| B3 | **US LBM / Platinum Equity** (`scripts/seed/us-lbm.ts`) | Platinum co-control edge `startDate: 2022-02-15`; Platinum described as co-owner "since 2022"; Bain note says partnership "in early 2022" | The Platinum co-controlling stake (equal stakes, joint board) was **announced Oct 16 2023**, with closing expected by end of Q1 2024. The cited URL (`platinum-equity-and-bain-capital-...-to-co-own-us-lbm`) returns **404** and looks fabricated. Replace it with the real release. The Bain completion URL on uslbm.com also returns 404. | High | https://www.platinumequity.com/news/platinum-equity-to-acquire-co-controlling-stake-in-us-lbm/ ; https://www.baincapital.com/news/us-lbm-announces-joint-ownership-agreement-bain-capital-private-equity-and-platinum-equity |
| B4 | **Holt Plumbing, Heating & Cooling** (Des Moines/West Des Moines). Seeded in `iowa-independents.ts` as "Family-owned … founded 1947"; shown Independent. | Independent | Evidence points to **Apex Service Partners (Alpine Investors)**. The homepage embeds "APEX GLOBAL Google Tag Manager" and Apex's shared container GTM-NPGVD6LP. Holt's job portal (careers-holtplumbingandheating.icims.com) is branded "Apex Service Partners". ParityOps lists Holt as Apex-owned. No press release found. | Medium-high | https://holtplumbingandheating.com/ (page source) ; https://careers-holtplumbingandheating.icims.com/jobs/8154/hvac-service-tech/job ; https://parityops.com/ownership-record |
| B5 | **Tri-City Electric Co.** (Davenport and Des Moines locations) | Independent (o=null) | **Quanta Services (NYSE: PWR)** acquired Tri-City Group (f/k/a PALCO Group; Tri-City Electric) in Q4 2025, disclosed Feb 2026. Quanta lists Tri-City Group on its companies page, and the Tri-City name is retained. | High | https://www.quantaservices.com/companies/tri-city-group ; https://www.kslaw.com/news-and-insights/quanta-services-acquires-tri-city-group ; https://quadcitiesbusiness.com/quanta-services-acquires-tri-city-group |
| B6 | **Horizon Services** (`national-home-services.ts`) | New Mountain acquired it "in 2024 from Sun Capital", `startDate 2024-01-01` | New Mountain bought Horizon from a Sun Capital affiliate in **November 2019**. | High | https://peprofessional.com/2019/11/sun-sells-horizon-new-mountain/ ; https://mergr.com/transaction/new-mountain-capital-acquires-horizon-services |
| B7 | **USA Hometown Experts** (`national-home-services.ts`) | Owned by MSouth Equity Partners ("exploring a sale") | **GHK Capital Partners** acquired it from MSouth (about Oct 15 2026). End-date the MSouth edge and add GHK. | Medium-high (law-firm client note and trade press; no company release read) | https://www.paulweiss.com/insights/client-news/ghk-capital-partners-acquires-usa-hometown-experts ; https://pulse2.com/ghk-capital-partners-acquires-usa-hometown-experts-to-accelerate-southeast-expansion/ |
| B8 | **Schaal Plumbing, Heating & Cooling**: Cedar Rapids (`schaal-plumbing-heating-and-cooling-cedar-rapids-ia`) and Des Moines (`…-des-moines-ia`) rows | "Unverified Independent". The Cedar Rapids yard page says "Independent … no private-equity parent". | These are Schaal (TurnPoint/OMERS) locations, imported as separate rows and not linked to the curated Schaal company. The Cedar Rapids office (6115 7th St SW / 1012 66th Ave SW, 319-209-5120) markets as Schaal. Re-parent both to the Schaal company. | High (that it's Schaal; TurnPoint lists Schaal) | https://www.turnpointservices.com/turnpoint-brands/ |
| B9 | **Bell Brothers Heating, Cooling & Plumbing** (Des Moines, `bell-brothers-heating-cooling-and-plumbing-des-moines-ia`) | Unverified Independent | Duplicate of the curated TurnPoint-owned Bell Brothers. Merge or re-parent it. | High | same |
| B10 | **Builders FirstSource Iowa yards** (Boone, Davenport, Des Moines, Mason City, New Hampton, Sioux City, Waterloo) | Yard pages correctly say "Public Company", but `/api/map` returns `o = null`, so the map and list do not show them as chain-owned. | BFS is a public company. Modeling issue: the location's company *is* the public company, so it has no parent edge. Fix the API to treat a public_company or consolidator operating company as owned. | High | — |
| B11 | **Munn Lumber Company of Ames** | "Co-op Member"; ultimate owner shown as Do it Best | Owned by **Mead Lumber** (employee-owned, Columbus NE; about 53 locations) since **2018**. The site's own Do it Best source URL is `doitbest.com/store/1295-mead`. Not PE, but not a standalone independent either. | Medium-high | https://www.businessrecord.com/?p=8498 ; https://meadlumber.com/?p=3291 ; https://hbsdealer.com/lumberyards/mead-lumber-grows-in-iowa |
| B12 | **Lampert Lumber, Webster City** | Two rows: one "US LBM", one independent (`lampert-lumber-webster-city-webster-city-ia-webster-city-ia`) | Same yard. The independent duplicate should be merged into the US LBM row. | High (that it's a duplicate) | — |
| B13 | Dead or blocked source URLs in seeds | — | 404: platinumequity.com/…strategic-partnership…, uslbm.com/news/bain-capital-…, corporate.homedepot.com/news/business/home-depot-completes-acquisition-srs-distribution, becn.com/our-company, 84lumber.com/about/our-story/, goldmansachs.com/alternatives/. KKR→Neighborly and Apax→Authority edges cite only homepages; use the 2021 KKR and 2018 Apax releases instead. | High | — |

---

## (C) Missed acquisitions (Iowa businesses shown as not owned)

| # | Business (map) | Site shows | Actually | Confidence | Source(s) |
|---|---|---|---|---|---|
| C1 | **Metro Heating & Cooling**, Des Moines | Independent | Acquired **Nov 2025** by **Merit Management Group**, which the Business Record describes as a Johnston, IA private-equity firm buying trades businesses. | High (local business press) | https://www.businessrecord.com/merit-management-group-acquires-two-central-iowa-companies/ |
| C2 | **Dorrian Heating & Cooling Inc**, Waukee | Independent | Acquired by Merit Management Group (2025) | Medium-high (same article; no second source) | same |
| C3 | **Heartland Heating & Cooling**, Grimes | Independent | Acquired by Merit Management Group (Preqin dates it Nov 15 2025) | Medium-high | same ; https://www.preqin.com/data/profile/asset/heartland-heating---cooling/778437 |
| C4 | **ServiceOne Heating, Cooling, Plumbing & Electrical**, Dubuque (Omaha HQ) | Independent | Likely **Apex Service Partners**. Its site uses Apex's shared GTM container (GTM-NPGVD6LP), and its icims job portal is branded Apex Service Partners. No announcement found. | Medium | https://serviceone.com/ (page source) ; https://career-serviceone.icims.com/jobs/23274/2026-23274/job ; https://parityops.com/ownership-record |
| C5 | Holt (see B4) and Tri-City Electric (see B5) | — | — | — | — |
| C6 | **Maquoketa Do It Best Lumber** (Maquoketa) | Co-op member, standalone | **Ogden & Adams Building Solutions** (Hiawatha, IA; owner Marty Hoeger) announced on **Jun 18 2026** that it will acquire the assets of Maquoketa Lumber and Bellevue Lumber. This is family-owned consolidation, not PE. Confirm that the map row is the same business. | Medium | https://www.lmc.net/News/Ogden-Adams-Building-Solutions-to-acquire-Maquoket |
| C7 | **Schoeneman's** Hawarden and Spencer, IA yards | Not on map | Builders FirstSource acquired Schoeneman's (Sioux Falls) in **May 2024**, including the Hawarden and Spencer, IA stores. Hawarden has since closed. Spencer status is unknown. | High (deal); low (current Spencer status) | https://www.businesswire.com/news/home/20240510923168/en/ |
| C8 | **SP Heating & Cooling**, Sheldon | (not checked on map) | Being sold to CW Suter Services (an ESOP; not PE). Date unclear; the article says the handover is set for "March 1". | Low-medium | https://kiwaradio.com/news/sp-heating-cooling-to-be-sold-to-cw-suter-services |
| C9 | **DeRocher Services Heating & AC, Sioux City**, listed as "… – CW Suter Services" | Independent | The listing name implies it now operates under CW Suter (ESOP). Not verified. | Low | — |

Sample of Iowa "independents" that checked out clean (fingerprint scan of 56 seeded homepages plus searches): no PE platform markers on any site except Holt. Self-described family-owned or ESOP: Nystrom Electric, A2Z, ACI, Acme Electric (ESOP), Alpha & Omega, CW Suter (ESOP), Duncan, Jensen, Kirk Butcher, Lakes PHC, Langel's (employee-owned), Bergen (ESOP), Orr, Pritchard Bros, RIVO, Tjarks, Willenborg, Converse, Duball, Mundt, Norm's, Quinn, Schebler (ESOP), Tappendorf, Young, Baker Group (ESOP). No acquisition found for Kalins Indoor Comfort, Brecke Mechanical, Neal Chase Lumber, Gulfeagle Supply (family-owned, multi-state), Akin Building Center (Nov 2025 ownership change among individuals only), Golden Rule (Nexstar member), or Dalton. "No acquisition found" is not proof of independence.

---

## (D) Franchise and co-op findings

**No Iowa business has a `franchise_of` edge** (`f` is null for all 1,354 features). These obviously branded franchise locations are filed under the placeholder company **"Unverified Independent"** with `o = null`:

| Map name (city) | Brand → owner | Notes |
|---|---|---|
| Roto-Rooter Des Moines (Grimes) | Roto-Rooter → Chemed (NYSE: CHE) | rotorooter.com/desmoines: "Operated as an Independent Franchise", franchisee Jim Dahlke. Franchise. |
| Roto-Rooter Sewer & Drain Service (Cedar Rapids) | Chemed | Independent franchise (Maher family since 1972) |
| Roto-Rooter (Waterloo) | Chemed | "Operated as an Independent Franchise" (Maher/Spenner) |
| Roto-Rooter Plumbing & Water Cleanup (Council Bluffs) | Chemed | No franchise language; a "manager" is listed and it uses company-branch naming, so possibly **company-owned** by Chemed (i.e., public-company owned). Medium-low. |
| Roto-Rooter: Ames, Ottumwa, Bettendorf, Mason City, Iowa Falls | Chemed | Status not checked (rotorooter.com blocks curl) |
| Benjamin Franklin Plumbing of Eastern Iowa (Cedar Rapids), of Ames | Authority Brands → Apax | Franchise |
| One Hour Heating & Air Conditioning of Ames | Authority Brands → Apax | Franchise. Also mis-tagged trade = plumbing. |
| Mr. Rooter Plumbing of Des Moines (Grimes), of Dubuque | Neighborly → KKR | Franchise |
| Aire Serv of Council Bluffs, of NW Des Moines (Urbandale), of Iowa City (Tiffin) | Neighborly → KKR | Franchise |
| Mr. Electric of Central Iowa (Urbandale) | Neighborly → KKR | Franchise |
| 1-Tom-Plumber (Cedar Rapids, Carlisle) | 1-Tom-Plumber franchise system | Franchise (brand owner not researched) |
| Christian Brothers Automotive Cedar Rapids | Auto-repair franchise | Not a trade business at all (listed under HVAC) |

**National-company-owned branches shown as independent:**
- **Sears Heating and Air Conditioning** (Cedar Rapids, Marshalltown): Sears Home Services (Transformco).
- **Trane Commercial Sales Office** (Cedar Rapids, Davenport): Trane Technologies, public. A sales office, not a contractor.
- **Lennox** (Clinton) and **Lennox NADC** (Marshalltown): Lennox International, public. NADC is a manufacturing/distribution site, not a contractor.

**Co-op modeling:**
- Spot checks of Do it Best (Maquoketa, Akin–Creston, Munn–Ames) and LMC (Beisser–Grimes) show the member_of edges come from the co-ops' dealer locators. That is plausible, but I could not independently confirm Beisser's LMC membership.
- **Presentation problem:** yard pages label the co-op as **"Ultimate owner: Do it Best / LMC"** even though the badge says "Co-op Member". That contradicts the project's own rule that member_of is not ownership.
- Golden Rule's Nexstar membership appears only in its description and sources, not as an edge. Fine.

---

## (E) Data-quality notes

- **Auto shops under HVAC/electrical (at least 25).** Examples: Fort Dodge has about 11 of them (Swanson Auto Repair, Farrell's Automotive, MPH Auto Repair, Heartland Tire, Laughlin Auto Repair, "Pingel Tyre & Auto Centre", whose British spelling suggests a non-US or bad record). Others: Honest Wrenches Automotive and Burch Auto Repair (West Des Moines), Anytime Auto Repair and Revive Auto Care (Cedar Rapids), Wallick's Auto Service (Davenport), and auto-electric shops (Ankeny Auto Electric, A&D Auto Electric) under electrical.
- **Supply houses and non-contractors in trade categories:** Gustave A Larson (HVAC wholesaler; Cedar Rapids, Mason City), Electric Supply of Marshalltown, Holt Supply Bath & Kitchen Showroom (Burlington), The Neighborly Handyman (Ankeny, under plumbing), plus the Trane and Lennox sites above.
- **Non-LBM businesses under lumber:** Hog Slat (5 Iowa rows; hog-barn equipment), Morton Buildings (post-frame builder), EPS (Graettinger), Amwood Homes.
- **Duplicates.** The curated seed rows and the imported rows coexist unlinked: Golden Rule (2, Grimes), Holt (3: Des Moines ×2 and West Des Moines), Dalton (6 across Cedar Falls, Cedar Rapids and Des Moines), Schaal (3), Bell Brothers (2), Mechanical Service Inc (2, both PremiStar), Lampert–Webster City (2, inconsistent owners), plus pairs for Kirk Butcher, Hubers, Pritchard, German PHC, Willenborg, Bettendorf Heating, Mitchell & Sons, Nystrom, CW Suter, Kalins, Schebler, Tappendorf. The risk is that a fix lands on one row and the duplicate keeps showing "Independent". This is exactly what happened with Schaal and Bell Brothers.
- **"Unverified Independent" placeholder (23 Iowa rows).** It is almost entirely national-brand franchises plus TurnPoint duplicates. It is the highest-yield queue to clean up.
- **API doc and behavior mismatch.** The route's comment says `o` is the "ultimate ownership parent", but the SQL returns the immediate parent (first active edge). Two consequences: Iowa TurnPoint and PremiStar brands never surface OMERS or Partners Group on the map, and public-company operating entities (BFS) get `o = null`.
- **Coverage gaps (missing, not wrong):** no Beacon/QXO, Menards, Spahn & Rose (Dubuque), Mead or R.P. Lumber yards in the Iowa lumber layer. Getzschman (TurnPoint, Omaha) and ServiceOne Omaha serve the Council Bluffs area but have no Iowa rows.

---

## (F) Lead review: second web check of the medium-confidence leads (2026-11-15)

| Lead | Verdict | Evidence | Action |
|---|---|---|---|
| C2/C3 Dorrian (Waukee), Heartland (Grimes) → Merit Management Group | **Confirmed.** | The Business Record (Nov 14 2025) names both as Merit's earlier HVAC acquisitions and calls Merit "a Johnston-based private equity firm". | `leads-2026-11.ts` adds the `owns` edges. |
| B7 USA Hometown Experts → GHK Capital Partners | **Confirmed.** | Paul Weiss (GHK's counsel) client note. Privsource names MSouth as the seller. First reported Oct 15 2026. HQ is Memphis. | The seed now has GHK controlling it from 2026-10-15, with the MSouth edge end-dated. |
| B11 Munn Lumber (Ames) → Mead Lumber | **Confirmed.** | Business Record and HBS Dealer (2018). Mead's own history page lists Munn as its first Iowa yard. The Munn name was kept. | `leads-2026-11.ts` creates Mead Lumber (employee-owned consolidator) and the edge. The classifier now ranks an owner above co-op membership, so Munn shows as chain-owned, not "Co-op Member". |
| C9 DeRocher Services (Sioux City), listed as "– CW Suter Services" | **Confirmed duplicate.** | The listing name itself, plus the KIWA report on CW Suter expanding by acquisition. CW Suter is 100% employee-owned. | Move the row, and the separate CW Suter Spencer row, to the canonical CW Suter company. It still shows as independent, which is correct. |
| D Trane Commercial Sales Office ×2, Lennox, Lennox NADC | **Confirmed.** These are manufacturer sites, not contractors. | Trane Technologies (NYSE: TT) and Lennox International (NYSE: LII). | Linked to the public parents so they stop showing as independent. Removing them from the trade layer is still open. |
| B4 Holt Plumbing & Heating → Apex Service Partners | **Likely, but no public announcement.** | The homepage loads "APEX GLOBAL" Google Tag Manager and Apex's shared container GTM-NPGVD6LP (re-checked today). Every Holt job posting on its icims portal is employer-branded "Apex Service Partners". No press release, and Holt isn't on the Frontier Service Partners brand list. | **Applied** after a third check (see below). |
| C4 ServiceOne (Dubuque; Omaha HQ) → Apex Service Partners | **Likely, but weaker than Holt.** | The homepage has an "APEX ServiceOne" GTM block plus GTM-NPGVD6LP. A search-engine listing titles its careers page "Apex Service Partners", but the page body only says ServiceOne. No announcement. Directories still describe it as a private local company. | **Applied** after a third check (see below). |
| C6 Maquoketa Lumber → Ogden & Adams | **Announced, closing not confirmed.** | LMC news (Jun 18 2026) and Building Products Digest: "plans to acquire the assets". Ogden & Adams is owner-operated (Marty Hoeger), not PE. | Not applied. Re-check after closing. |
| C8 SP Heating & Cooling (Sheldon) → CW Suter | Confirmed by KIWA, but **not in our data**. | — | Nothing to change. |
| D Roto-Rooter Council Bluffs: company-owned? | **Unresolved.** rotorooter.com blocks automated fetches. | — | Stays linked to Roto-Rooter as a franchise. If it is company-owned it would be Public (Chemed). |
| D Sears Heating & Air (Cedar Rapids, Marshalltown) | **Not applied.** | Sears Home Services is Transformco, controlled by ESL Investments. That doesn't fit our existing badges well. | Open question. |
| E Auto shops, Hog Slat, Morton Buildings, supply houses | **Data cleanup, not ownership.** | — | Needs a way to hide non-trade rows. Not done. |

**Holt and ServiceOne: third check (2026-11-15), applied.** Both brands' job portals are tenants of one iCIMS hiring system branded "Apex Service Partners". It is shared across brands: Holt's job link resolves to Apex's "All Hours" listings, and a ServiceOne posting carries the "Careers at Holt Plumbing…" page title. Independent companies don't share one employer's applicant-tracking system, and both homepages also load Apex's shared GTM container. There is still no public announcement, so each edge's note states the evidence rather than claiming a deal, and the Holt description notes that its site still says family-owned.
