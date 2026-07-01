import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, locations } from "@/lib/db/schema";
import { slugify } from "@/lib/slug";
import { upsertCompany, linkSource } from "./seed/_helpers";
import { TRADE_LABELS } from "@/lib/constants";

/**
 * Enrich the bulk Google-Places imports: give each staged business its own
 * Independent company (its real name), cite its official website as the source
 * for that status, and cross-check every name against national franchise / PE
 * brands so those are NOT mislabeled as independent.
 *
 * For each location currently under "Unverified Independent":
 *   1. Fetch its official website via Google Place Details (the per-business
 *      source, instead of a bare Google Maps pin).
 *   2. If the name matches a known franchise / PE-rollup brand → leave it
 *      staged and flag it (a franchisee is not a clean independent).
 *   3. Otherwise create/attach an Independent operating company named after the
 *      business, reassign the location to it, set the location's source to the
 *      website, and record the website as a cited source on the company.
 *
 * Flags: --limit N (process only N), --dry-run (no writes).
 *
 * "Independent" here means no private-equity owner on the public record — the
 * website evidences a real local operator but does not prove the absence of a
 * hidden parent. Source-backed corrections are welcome via /submit.
 */

const PLACES_KEY = process.env.MAPS_API ?? process.env.GOOGLE_PLACES_API_KEY;

// National franchise / PE-rollup brands. A business whose name contains any of
// these is a franchise or known rollup brand, not a clean local independent.
const FRANCHISE_BRANDS = [
  "one hour heating",
  "one hour air",
  "benjamin franklin plumbing",
  "mister sparky",
  "roto-rooter",
  "roto rooter",
  "aire serv",
  "aire-serv",
  "mr. rooter",
  "mr rooter",
  "mr. electric",
  "mr electric",
  "rescue rooter",
  "ars/rescue",
  "horizon services",
  "len the plumber",
  "michael & son",
  "1-tom-plumber",
  "1 tom plumber",
  "z plumberz",
  "z-plumberz",
  "bluefrog plumbing",
  "rooter-man",
  "rooter man",
  "plumbingforce",
  "wind river",
  "any hour",
  "precision door",
  // platform/operating brands already tracked elsewhere. Keep these specific —
  // avoid generic words like "mechanical" or "environmental" that would snag
  // independent firms (e.g. "Plains Mechanical", "Rasmussen Mechanical").
  "schaal plumbing",
  "bell brothers heating",
  "green's appliance",
  "aksarben",
  "premistar",
];

function parseArgs() {
  const args = process.argv.slice(2);
  let limit = Infinity;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit") limit = Number(args[++i]);
    else if (args[i] === "--dry-run") dryRun = true;
  }
  return { limit, dryRun };
}

async function fetchWebsite(placeId: string): Promise<string | null> {
  if (!PLACES_KEY) throw new Error("MAPS_API is not set");
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "x-goog-api-key": PLACES_KEY,
      "x-goog-fieldmask": "websiteUri",
    },
  });
  if (!res.ok) {
    console.warn(`  ! place details ${placeId} -> ${res.status}`);
    return null;
  }
  const json = (await res.json()) as { websiteUri?: string };
  return json.websiteUri ?? null;
}

function isFranchise(name: string): boolean {
  const n = name.toLowerCase();
  return FRANCHISE_BRANDS.some((b) => n.includes(b));
}

async function main() {
  const { limit, dryRun } = parseArgs();

  const bucket = await db.query.companies.findFirst({
    where: eq(companies.slug, "unverified-independent"),
  });
  if (!bucket) {
    console.log("No 'Unverified Independent' company — nothing to enrich.");
    return;
  }

  const rows = await db.query.locations.findMany({
    where: eq(locations.companyId, bucket.id),
  });
  const todo = rows.slice(0, limit === Infinity ? rows.length : limit);
  console.log(`${rows.length} staged businesses; processing ${todo.length}${dryRun ? " (dry-run)" : ""}…`);

  let independents = 0;
  let franchises = 0;
  let noWebsite = 0;

  for (const loc of todo) {
    if (isFranchise(loc.displayName)) {
      franchises++;
      console.log(`  franchise/PE  ${loc.displayName} (${loc.city}) — left staged`);
      continue;
    }

    const website = loc.googlePlaceId ? await fetchWebsite(loc.googlePlaceId) : null;
    if (!website) noWebsite++;
    const source = website ?? loc.sourceUrl ?? `https://www.google.com/maps/place/?q=place_id:${loc.googlePlaceId}`;
    const tradeLabel = loc.trade ? TRADE_LABELS[loc.trade] : "home services";

    if (dryRun) {
      independents++;
      console.log(`  independent   ${loc.displayName} (${loc.city}) — source: ${source}`);
      continue;
    }

    const company = await upsertCompany({
      slug: slugify(`${loc.displayName} ${loc.city}`),
      name: loc.displayName,
      type: "yard",
      trade: loc.trade,
      headquartersCity: loc.city,
      headquartersState: loc.state,
      website,
      description: `${tradeLabel} business in ${loc.city}, Iowa. Independent — no private-equity owner on the public record. Sourced to the company's own website; source-backed corrections welcome via /submit.`,
    });

    await db
      .update(locations)
      .set({ companyId: company.id, sourceUrl: source, updatedAt: new Date() })
      .where(eq(locations.id, loc.id));

    await linkSource({ url: source }, "company", company.id);
    await linkSource({ url: source }, "location", loc.id);

    independents++;
    // Gentle pacing for the Places details endpoint.
    await new Promise((r) => setTimeout(r, 120));
  }

  console.log(
    `\nDone. Independent: ${independents} · Franchise/PE flagged: ${franchises} · No website found: ${noWebsite}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
