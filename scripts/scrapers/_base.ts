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

export async function writeScrape(slug: string, rows: ScrapedLocation[], opts: ScraperOptions) {
  if (opts.dryRun) {
    console.log(`[${slug}] dry-run: ${rows.length} rows (not writing)`);
    return null;
  }
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${slug}-${date}.json`;
  const filepath = path.join(OUTPUT_DIR, filename);
  await fs.writeFile(
    filepath,
    JSON.stringify(
      {
        consolidator: slug,
        scrapedAt: new Date().toISOString(),
        count: rows.length,
        rows,
      },
      null,
      2
    )
  );
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
