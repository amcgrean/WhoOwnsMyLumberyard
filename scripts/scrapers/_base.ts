import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import fs from "node:fs/promises";
import path from "node:path";

export type ScrapedLocation = {
  name: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  zip: string;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  services?: string[];
  sourceUrl: string;
  /**
   * Per-row override for the operating-company slug. Use this when a single
   * scrape file contains rows belonging to multiple owned brands (e.g. Carter
   * Lumber's family includes Holmes / Kight / Kempsville / Townsend). When
   * absent, the importer falls back to the file-level consolidator slug.
   */
  operatingCompanySlug?: string;
  /**
   * Optional metadata for auto-creating the operating-company row when it
   * doesn't yet exist in the database. The importer creates a yard-type
   * company with these fields and parents it to the file-level consolidator
   * via a subsidiary_of edge. Leave undefined to skip auto-creation; the
   * importer will fall back to the file-level company instead.
   */
  operatingCompanyName?: string;
  operatingCompanyWebsite?: string;
};

export type ScrapeOutput = {
  consolidator: string;
  scrapedAt: string;
  count: number;
  rows: ScrapedLocation[];
  /**
   * If set, the importer auto-creates any new per-row operating companies as
   * children of this slug. Defaults to the `subsidiary_of` relationship; pass
   * `autoCreateRelationship` to override (e.g. `member_of` for co-op
   * directories where the parent doesn't *own* the member). Sourced to the
   * file-level locator URL.
   */
  autoCreateChildrenOf?: string;
  autoCreateRelationship?:
    | "owns"
    | "controls"
    | "member_of"
    | "franchise_of"
    | "subsidiary_of";
  /** Source URL used to back any auto-created ownership edges. */
  autoCreateSourceUrl?: string;
};

export type ScraperOptions = {
  /** Stop after N records (testing). */
  limit?: number;
  /** If true, do not write any output files. */
  dryRun?: boolean;
  /** Min ms between requests. */
  minIntervalMs?: number;
};

const OUTPUT_DIR = path.resolve(process.cwd(), "data/scraped");

/** Sleep for ms milliseconds. */
export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Simple request rate limiter. */
export class RateLimiter {
  private lastAt = 0;
  constructor(private intervalMs: number) {}
  async wait() {
    const wait = Math.max(0, this.intervalMs - (Date.now() - this.lastAt));
    if (wait > 0) await sleep(wait);
    this.lastAt = Date.now();
  }
}

export async function writeScrape(
  slug: string,
  rows: ScrapedLocation[],
  opts: ScraperOptions,
  extra?: {
    autoCreateChildrenOf?: string;
    autoCreateRelationship?: ScrapeOutput["autoCreateRelationship"];
    autoCreateSourceUrl?: string;
  }
) {
  if (opts.dryRun) {
    console.log(`[${slug}] dry-run: ${rows.length} rows (not writing)`);
    return null;
  }
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${slug}-${date}.json`;
  const filepath = path.join(OUTPUT_DIR, filename);
  const out: ScrapeOutput = {
    consolidator: slug,
    scrapedAt: new Date().toISOString(),
    count: rows.length,
    rows,
    autoCreateChildrenOf: extra?.autoCreateChildrenOf,
    autoCreateRelationship: extra?.autoCreateRelationship,
    autoCreateSourceUrl: extra?.autoCreateSourceUrl,
  };
  await fs.writeFile(filepath, JSON.stringify(out, null, 2));
  console.log(`[${slug}] wrote ${rows.length} rows → ${filepath}`);
  return filepath;
}

export function parseCliArgs(argv: string[] = process.argv.slice(2)): ScraperOptions {
  const opts: ScraperOptions = { minIntervalMs: 1000 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--limit") opts.limit = Number(argv[++i]);
    else if (arg === "--interval") opts.minIntervalMs = Number(argv[++i]);
  }
  return opts;
}
