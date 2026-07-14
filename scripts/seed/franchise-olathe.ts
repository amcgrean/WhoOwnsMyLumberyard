import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, locations } from "@/lib/db/schema";
import { upsertCompany, upsertEdge, linkSource } from "./_helpers";

/**
 * Sourced correction: "Olathe Heating & Cooling Inc" is not a clean local
 * independent — its own website (onehourairkc.com) states it is "part of the
 * Authority Brands family", i.e. a One Hour Heating & Air Conditioning
 * franchise. One Hour is a brand of Authority Brands, which is owned by the
 * private-equity firm Apax Partners.
 *
 * Models it as a franchise (franchise_of), NOT ownership: the franchisee is
 * locally owned, so it should read as "Franchise of One Hour", neither a clean
 * independent nor PE-acquired. Idempotent.
 *
 * Chain built (bottom-up):
 *   Olathe Heating & Cooling  --franchise_of-->  One Hour Heating & Air
 *   One Hour  --owns(brand of)-->  Authority Brands
 *   Authority Brands  --owns-->  Apax Partners (PE)
 */

const FRANCHISEE_LOCATION_SLUG = "olathe-heating-and-cooling-inc-olathe-ks";
const SITE = "https://www.onehourairkc.com/";

async function main() {
  const loc = await db.query.locations.findFirst({
    where: eq(locations.slug, FRANCHISEE_LOCATION_SLUG),
  });
  if (!loc) {
    console.error(`Location ${FRANCHISEE_LOCATION_SLUG} not found — nothing to do.`);
    process.exit(1);
  }
  const franchisee = await db.query.companies.findFirst({
    where: eq(companies.id, loc.companyId),
  });
  if (!franchisee) {
    console.error("Franchisee company not found for location — aborting.");
    process.exit(1);
  }

  const apax = await upsertCompany({
    slug: "apax-partners",
    name: "Apax Partners",
    type: "pe_firm",
    headquartersCity: "London",
    description: "Global private-equity firm; owner of Authority Brands.",
  });

  const authorityBrands = await upsertCompany({
    slug: "authority-brands",
    name: "Authority Brands",
    type: "consolidator",
    headquartersCity: "Columbia",
    headquartersState: "MD",
    description:
      "Home-services franchisor (One Hour Heating & Air Conditioning, Benjamin Franklin Plumbing, Mister Sparky, and others). Owned by the private-equity firm Apax Partners since 2021.",
  });

  const oneHour = await upsertCompany({
    slug: "one-hour-heating-air-conditioning",
    name: "One Hour Heating & Air Conditioning",
    type: "consolidator",
    trade: "hvac",
    description:
      "National HVAC franchise brand operated by Authority Brands. Local franchisees are independently owned and operated under the brand.",
  });

  // Apax owns Authority Brands (ownership).
  await upsertEdge({
    parentId: apax.id,
    childId: authorityBrands.id,
    relationship: "owns",
    sources: ["https://www.apax.com", "https://www.authoritybrands.com"],
  });

  // One Hour is a brand of Authority Brands (ownership of the brand).
  await upsertEdge({
    parentId: authorityBrands.id,
    childId: oneHour.id,
    relationship: "owns",
    sources: ["https://www.authoritybrands.com/our-brands"],
  });

  // The franchisee operates under the One Hour brand — franchise, not ownership.
  await upsertEdge({
    parentId: oneHour.id,
    childId: franchisee.id,
    relationship: "franchise_of",
    sources: [SITE],
    quote: "part of the Authority Brands family",
  });

  // Note the affiliation on the franchisee company + cite its site.
  await upsertCompany({
    slug: franchisee.slug,
    name: franchisee.name,
    type: franchisee.type,
    trade: franchisee.trade,
    headquartersCity: franchisee.headquartersCity ?? loc.city,
    headquartersState: franchisee.headquartersState ?? loc.state,
    website: franchisee.website ?? SITE,
    description:
      "Kansas City-area HVAC company operating as a One Hour Heating & Air Conditioning franchise (Authority Brands, owned by Apax Partners). Locally owned and operated under the national brand.",
  });
  await linkSource({ url: SITE }, "company", franchisee.id);

  console.log(
    `Reclassified "${franchisee.name}" as a franchise of One Hour → Authority Brands → Apax Partners.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
