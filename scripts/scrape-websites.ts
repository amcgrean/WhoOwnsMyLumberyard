import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { writeFile } from "node:fs/promises";

/**
 * Website-scrape enrichment. For every operating business (`yard` companies
 * with a website) it fetches the homepage and extracts three things:
 *
 *   1. Social profile URLs (facebook / instagram / x / youtube / linkedin /
 *      tiktok) → stored on companies.socials and shown on the business pages.
 *   2. Buying-group / network membership ("Nexstar", "Service Nation") →
 *      appended to the company description (advertised on the company's site).
 *   3. Private-equity platform ownership signals — footer text naming one of
 *      the national roll-up platforms from the TradeRunner "Residential HVAC,
 *      Plumbing & Electrical Platforms" chart. These are NOT auto-reassigned
 *      (too easy to false-positive on a stray mention); they're written to a
 *      review report so the operator can confirm and reassign each.
 *
 * Flags: --limit N, --dry-run, --concurrency N (default 8).
 */

const SOCIAL_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "facebook", re: /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9_.\-/?=]+/gi },
  { label: "instagram", re: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.\-/]+/gi },
  { label: "x", re: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_.\-/]+/gi },
  { label: "youtube", re: /https?:\/\/(?:www\.)?youtube\.com\/[A-Za-z0-9_.@\-/]+/gi },
  { label: "linkedin", re: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9_.\-/]+/gi },
  { label: "tiktok", re: /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.\-/]+/gi },
];

// Widget / share / tracking URLs that are not the business's own profile.
const BAD_SOCIAL = /sharer|\/plugins\/|\/intent\/|\/share|dialog|\/tr\b|\/gtag|\/embed|profile\.php\?id=$/i;

// PE roll-up platforms (from the TradeRunner platforms chart). Multi-word to
// avoid matching common English / city names.
const PE_PLATFORMS = [
  "apex service partners",
  "wrench group",
  "sila services",
  "redwood services",
  "turnpoint",
  "any hour",
  "leap partners",
  "legacy service partners",
  "liberty service partners",
  "southern home services",
  "authority brands",
  "strikepoint",
  "blue cardinal",
  "northwinds",
  "p1 service group",
  "resixperts",
  "granite comfort",
  "champions group",
  "cascade services",
  "near u",
  "premistar",
  "home services group",
  "service partners",
];

function parseArgs() {
  const args = process.argv.slice(2);
  let limit = Infinity;
  let dryRun = false;
  let concurrency = 8;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit") limit = Number(args[++i]);
    else if (args[i] === "--dry-run") dryRun = true;
    else if (args[i] === "--concurrency") concurrency = Number(args[++i]);
  }
  return { limit, dryRun, concurrency };
}

async function fetchHtml(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": "WhoOwnsMyTradesBot/1.0 (+https://whoownsmylumberyard.com)" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractSocials(html: string): string[] {
  const out: string[] = [];
  for (const { re } of SOCIAL_PATTERNS) {
    for (const m of html.matchAll(re)) {
      // strip trailing quote/paren/space fragments the greedy class may grab
      const url = m[0].replace(/["'){}<>\\].*$/, "").replace(/[/,.]+$/, "");
      if (BAD_SOCIAL.test(url)) continue;
      if (!out.includes(url)) {
        out.push(url);
        break; // first clean profile per platform
      }
    }
  }
  return out;
}

type PeFlag = { slug: string; name: string; city: string | null; website: string; matched: string };

async function main() {
  const { limit, dryRun, concurrency } = parseArgs();

  const all = await db
    .select({
      id: companies.id,
      slug: companies.slug,
      name: companies.name,
      city: companies.headquartersCity,
      website: companies.website,
      description: companies.description,
    })
    .from(companies)
    .where(and(eq(companies.type, "yard"), isNotNull(companies.website)));

  const todo = all.slice(0, limit === Infinity ? all.length : limit);
  console.log(`${all.length} businesses with a website; scraping ${todo.length}${dryRun ? " (dry-run)" : ""}…`);

  let socialsFound = 0;
  let members = 0;
  const peFlags: PeFlag[] = [];
  let processed = 0;

  // Simple bounded-concurrency pool.
  let idx = 0;
  async function worker() {
    while (idx < todo.length) {
      const c = todo[idx++];
      const html = await fetchHtml(c.website!);
      processed++;
      if (processed % 100 === 0) console.log(`  …${processed}/${todo.length}`);
      if (!html) continue;
      const lower = html.toLowerCase();

      const socials = extractSocials(html);
      const isNexstar = lower.includes("nexstar");
      const isServiceNation = /service\s*nation|service\s*roundtable/.test(lower);
      const peMatch = PE_PLATFORMS.find((p) => lower.includes(p));

      if (peMatch) {
        peFlags.push({ slug: c.slug, name: c.name, city: c.city, website: c.website!, matched: peMatch });
      }

      if (dryRun) {
        if (socials.length) socialsFound++;
        if (isNexstar || isServiceNation) members++;
        if (socials.length || isNexstar || peMatch) {
          console.log(`  ${c.name} — socials:[${socials.map((s) => s.replace(/https?:\/\/(www\.)?/, "").split("/")[0]).join(",")}]${isNexstar ? " NEXSTAR" : ""}${isServiceNation ? " SERVICE-NATION" : ""}${peMatch ? ` PE?:${peMatch}` : ""}`);
        }
        continue;
      }

      const updates: Partial<typeof companies.$inferInsert> = {};
      if (socials.length) {
        updates.socials = socials;
        socialsFound++;
      }
      const membershipNote = isNexstar
        ? "Advertises membership in the member-owned Nexstar Network."
        : isServiceNation
          ? "Advertises membership in Service Nation."
          : null;
      if (membershipNote) {
        members++;
        const desc = c.description ?? "";
        if (!desc.includes("Nexstar") && !desc.includes("Service Nation")) {
          updates.description = `${desc} ${membershipNote}`.trim();
        }
      }
      if (Object.keys(updates).length) {
        await db
          .update(companies)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(companies.id, c.id));
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));

  // Write the PE-review report (never auto-reassigns).
  if (peFlags.length && !dryRun) {
    const path = `data/scraped/pe-review-flags.json`;
    await writeFile(path, JSON.stringify(peFlags, null, 2));
    console.log(`\nWrote ${peFlags.length} PE-review flags → ${path}`);
  }

  console.log(
    `\nDone. Socials found: ${socialsFound} · Network members: ${members} · PE flags: ${peFlags.length}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
