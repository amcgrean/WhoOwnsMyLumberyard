import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { upsertCompany, upsertEdge, linkSource } from "./_helpers";

/**
 * Sourced correction: reclassify confirmed hidden franchisees of Neighborly
 * brands (Mr. Rooter, Mr. Electric, Aire Serv) surfaced by the website scan.
 * Each operates under a national brand — verified from its own site's page
 * title — under a local-sounding name. Neighborly is owned by the private-equity
 * firm KKR (majority stake since 2021).
 *
 * Models them as franchises (franchise_of), NOT ownership: the franchisee is
 * locally owned, so it reads as "Franchise of <brand>", neither a clean
 * independent nor PE-acquired. Idempotent.
 *
 *   franchisee --franchise_of--> brand --owns--> Neighborly --owns--> KKR (PE)
 */

// keyed on the company slug the scan flagged.
const FRANCHISEES: Array<{ companySlug: string; brandSlug: string; site: string }> = [
  { companySlug: "rooter-town-plumbing-denver", brandSlug: "mr-rooter", site: "https://rootertown.com/denver" },
  { companySlug: "mr-electric-joliet", brandSlug: "mr-electric", site: "https://mrelectric.com/naperville" },
  { companySlug: "reliable-electrician-company-fort-worth-fort-worth", brandSlug: "mr-electric", site: "https://www.mrelectricfortworth.com/" },
  { companySlug: "stay-cool-heating-and-cooling-roswell", brandSlug: "aire-serv", site: "https://www.staycoolga.com/" },
];

async function main() {
  const kkr = await upsertCompany({
    slug: "kkr",
    name: "KKR",
    type: "pe_firm",
    headquartersCity: "New York",
    headquartersState: "NY",
    description: "Global private-equity firm; majority owner of Neighborly since 2021.",
  });

  const neighborly = await upsertCompany({
    slug: "neighborly",
    name: "Neighborly",
    type: "consolidator",
    headquartersCity: "Waco",
    headquartersState: "TX",
    description:
      "Home-services franchisor (Mr. Rooter, Mr. Electric, Aire Serv, and ~30 other brands). Majority-owned by the private-equity firm KKR since 2021.",
  });

  await upsertEdge({
    parentId: kkr.id,
    childId: neighborly.id,
    relationship: "owns",
    sources: ["https://www.kkr.com", "https://www.neighborlybrands.com"],
  });

  const brandMeta: Record<string, { name: string; trade: "plumbing" | "electrical" | "hvac" }> = {
    "mr-rooter": { name: "Mr. Rooter Plumbing", trade: "plumbing" },
    "mr-electric": { name: "Mr. Electric", trade: "electrical" },
    "aire-serv": { name: "Aire Serv", trade: "hvac" },
  };

  const brandIds: Record<string, string> = {};
  for (const [slug, meta] of Object.entries(brandMeta)) {
    const brand = await upsertCompany({
      slug,
      name: meta.name,
      type: "consolidator",
      trade: meta.trade,
      description: `National ${meta.trade} franchise brand operated by Neighborly (owned by KKR). Local franchisees are independently owned and operated under the brand.`,
    });
    brandIds[slug] = brand.id;
    await upsertEdge({
      parentId: neighborly.id,
      childId: brand.id,
      relationship: "owns",
      sources: ["https://www.neighborlybrands.com/our-brands"],
    });
  }

  let done = 0;
  for (const f of FRANCHISEES) {
    const co = await db.query.companies.findFirst({ where: eq(companies.slug, f.companySlug) });
    if (!co) {
      console.warn(`  skip: company ${f.companySlug} not found`);
      continue;
    }
    const brandId = brandIds[f.brandSlug];
    await upsertEdge({
      parentId: brandId,
      childId: co.id,
      relationship: "franchise_of",
      sources: [f.site],
    });
    await upsertCompany({
      slug: co.slug,
      name: co.name,
      type: co.type,
      trade: co.trade,
      headquartersCity: co.headquartersCity,
      headquartersState: co.headquartersState,
      website: co.website ?? f.site,
      description: `Operates as a ${brandMeta[f.brandSlug].name} franchise (Neighborly, owned by KKR). Locally owned and operated under the national brand.`,
    });
    await linkSource({ url: f.site }, "company", co.id);
    console.log(`  reclassified "${co.name}" → franchise of ${brandMeta[f.brandSlug].name}`);
    done++;
  }
  console.log(`\nDone. ${done}/${FRANCHISEES.length} franchisees reclassified under Neighborly → KKR.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
