import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { companies, locations } from "@/lib/db/schema";
import { STATE_NAME_BY_CODE, US_STATES } from "@/lib/constants";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://whoownsmytrades.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Tolerant of a not-yet-migrated database so the first deploy succeeds.
  let locRows: { slug: string; updatedAt: Date }[] = [];
  let compRows: { slug: string; type: string; updatedAt: Date }[] = [];
  let stateTradeRows: { state: string; trade: string | null }[] = [];
  try {
    [locRows, compRows, stateTradeRows] = await Promise.all([
      db.select({ slug: locations.slug, updatedAt: locations.updatedAt }).from(locations),
      db
        .select({ slug: companies.slug, type: companies.type, updatedAt: companies.updatedAt })
        .from(companies),
      db.selectDistinct({ state: locations.state, trade: locations.trade }).from(locations),
    ]);
  } catch (err) {
    console.warn("[sitemap] DB read failed (likely no migrations yet)", err);
  }

  const staticPaths: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/map`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/methodology`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/submit`, changeFrequency: "yearly", priority: 0.4 },
  ];

  const stateSlug = (code: string) =>
    (STATE_NAME_BY_CODE[code] ?? code).toLowerCase().replace(/\s+/g, "-");

  const stateUrls: MetadataRoute.Sitemap = US_STATES.map((s) => ({
    url: `${SITE_URL}/state/${stateSlug(s.code)}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Per-trade landing pages, only for state/trade combinations that have data.
  const stateTradeUrls: MetadataRoute.Sitemap = stateTradeRows
    .filter((r) => r.trade)
    .map((r) => ({
      url: `${SITE_URL}/state/${stateSlug(r.state)}/${r.trade}`,
      changeFrequency: "weekly" as const,
      priority: 0.65,
    }));

  const yardUrls: MetadataRoute.Sitemap = locRows.map((r) => ({
    url: `${SITE_URL}/yard/${r.slug}`,
    lastModified: r.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const companyUrls: MetadataRoute.Sitemap = compRows.map((r) => {
    const base =
      r.type === "pe_firm" || r.type === "public_company" || r.type === "family_office"
        ? "owner"
        : "company";
    return {
      url: `${SITE_URL}/${base}/${r.slug}`,
      lastModified: r.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    };
  });

  return [...staticPaths, ...stateUrls, ...stateTradeUrls, ...yardUrls, ...companyUrls];
}
