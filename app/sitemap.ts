import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { companies, locations } from "@/lib/db/schema";
import { STATE_NAME_BY_CODE, US_STATES } from "@/lib/constants";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://whoownsmylumberyard.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Tolerant of a not-yet-migrated database so the first deploy succeeds.
  let locRows: { slug: string; updatedAt: Date }[] = [];
  let compRows: { slug: string; type: string; updatedAt: Date }[] = [];
  try {
    [locRows, compRows] = await Promise.all([
      db.select({ slug: locations.slug, updatedAt: locations.updatedAt }).from(locations),
      db
        .select({ slug: companies.slug, type: companies.type, updatedAt: companies.updatedAt })
        .from(companies),
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

  const stateUrls: MetadataRoute.Sitemap = US_STATES.map((s) => ({
    url: `${SITE_URL}/state/${(STATE_NAME_BY_CODE[s.code] ?? s.code).toLowerCase().replace(/\s+/g, "-")}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
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

  return [...staticPaths, ...stateUrls, ...yardUrls, ...companyUrls];
}
