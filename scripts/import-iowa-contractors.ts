import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, locations } from "@/lib/db/schema";
import { locationSlug } from "@/lib/slug";

/**
 * FREE importer for the "Active Iowa Construction Contractor Registrations"
 * dataset (data.iowa.gov) — authoritative, public, ODbL/open-gov. The Iowa Data
 * Hub no longer exposes the old Socrata API, so download the dataset as CSV from
 * the dataset page and pass it here:
 *
 *   pnpm tsx --env-file=.env.local scripts/import-iowa-contractors.ts --file <path.csv>
 *
 * The registration is generic "construction contractor" (not trade-specific), so
 * we keep only rows whose business name signals one of our trades (plumbing /
 * electrical / HVAC) and tag them accordingly. Coordinates aren't in the file;
 * run a free geocoder later if map pins are wanted. Staged under "Unverified
 * Independent" for the same enrich pipeline.
 */

const SOURCE_URL = "https://data.iowa.gov/Workforce/Active-Iowa-Construction-Contractor-Registrations/dpf3-iz94";

function parseArgs() {
  const args = process.argv.slice(2);
  let file: string | undefined;
  for (let i = 0; i < args.length; i++) if (args[i] === "--file") file = args[++i];
  if (!file) {
    console.error("usage: ... import-iowa-contractors.ts --file <path.csv>");
    process.exit(1);
  }
  return { file };
}

// Minimal RFC-4180-ish CSV parser (handles quoted fields, embedded commas/quotes).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function pick(headers: string[], row: string[], ...names: string[]): string {
  for (const n of names) {
    const idx = headers.findIndex((h) => h.toLowerCase().replace(/[^a-z0-9]/g, "") === n);
    if (idx >= 0 && row[idx]?.trim()) return row[idx].trim();
  }
  return "";
}

function tradeFromName(name: string): "plumbing" | "electrical" | "hvac" | null {
  const n = name.toLowerCase();
  if (/\bplumb/.test(n)) return "plumbing";
  if (/electric/.test(n)) return "electrical";
  if (/heating|cooling|\bhvac\b|air condition|furnace|geotherm|mechanical/.test(n)) return "hvac";
  return null;
}

async function ensureUnverifiedIndependent() {
  const existing = await db.query.companies.findFirst({ where: eq(companies.slug, "unverified-independent") });
  if (existing) return existing;
  const [created] = await db
    .insert(companies)
    .values({ slug: "unverified-independent", name: "Unverified Independent", type: "yard", status: "active" })
    .returning();
  return created;
}

async function main() {
  const { file } = parseArgs();
  const text = await readFile(file, "utf8");
  const rows = parseCsv(text);
  if (rows.length < 2) { console.log("empty CSV"); return; }
  const headers = rows[0];

  const company = await ensureUnverifiedIndependent();
  let inserted = 0, skipped = 0, offTrade = 0;

  for (const row of rows.slice(1)) {
    const name = pick(headers, row, "dbaname", "doingbusinessas", "dba", "legalname", "businessname", "name");
    const trade = name ? tradeFromName(name) : null;
    if (!trade) { offTrade++; continue; }
    const street = pick(headers, row, "physicaladdress", "mailingaddress", "streetaddress", "address", "addressline1");
    const city = pick(headers, row, "physicalcity", "mailingcity", "city");
    const zip = pick(headers, row, "physicalzip", "mailingzip", "zip", "zipcode", "postalcode");
    const state = (pick(headers, row, "physicalstate", "mailingstate", "state") || "IA").toUpperCase();
    if (!name || !street || !city || !zip || state !== "IA") { skipped++; continue; }

    const slug = locationSlug({ name, city, state });
    const existing = await db.query.locations.findFirst({ where: eq(locations.slug, slug) });
    if (existing) { skipped++; continue; }

    await db.insert(locations).values({
      slug,
      companyId: company.id,
      displayName: name,
      addressLine1: street,
      city,
      state,
      zip,
      trade,
      sourceUrl: SOURCE_URL,
      status: "open",
    });
    inserted++;
  }

  console.log(`Iowa contractors: ${inserted} inserted · ${skipped} skipped · ${offTrade} off-trade (not plumbing/electrical/hvac)`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
