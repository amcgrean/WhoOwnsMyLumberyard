import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { acquisitions, claimSources, companies, sources, type Trade } from "@/lib/db/schema";
import { ownershipSelect, kindFromRow } from "@/lib/ownership-sql";
import type { OwnershipBadgeKind } from "@/lib/constants";

/** First day of the news window (the backfill covers 2025 onward). */
export const NEWS_SINCE = "2025-01-01";

export type NewsSource = { url: string; title: string | null; publication: string | null; publishedDate: string | null };

export type NewsItem = {
  slug: string;
  /** The date the item is filed under: closing date, else announcement. */
  date: string;
  announcedDate: string | null;
  closedDate: string | null;
  dealValueUsd: number | null;
  summary: string | null;
  acquirer: { slug: string; name: string; kind: OwnershipBadgeKind; ownerName: string | null };
  target: { slug: string; name: string; trade: Trade | null; city: string | null; state: string | null };
  iowa: boolean;
  sources: NewsSource[];
};

const acquirer = alias(companies, "acquirer");
const target = alias(companies, "target");

/**
 * The buyer's badge. A multi-yard dealer or holding company with no PE or
 * public owner on record is a large private owner, not "Unverified".
 */
function acquirerKind(r: { acquirerSlug: string; acquirerType: string; franchiseOf: string | null; isCoop: boolean | null; chainTypes: string | null }): OwnershipBadgeKind {
  const kind = kindFromRow({ companySlug: r.acquirerSlug, companyType: r.acquirerType, franchiseOf: r.franchiseOf, isCoop: r.isCoop, chainTypes: r.chainTypes });
  if (kind === "unknown" && (r.acquirerType === "consolidator" || r.acquirerType === "holding_company")) return "family_mega";
  return kind;
}

/** Acquisitions announced or closed since NEWS_SINCE, newest first. */
export async function getNews(): Promise<NewsItem[]> {
  const filed = sql<string>`coalesce(${acquisitions.closedDate}, ${acquisitions.announcedDate})`;
  const own = ownershipSelect(sql`"acquirer"."id"`);
  const rows = await db
    .select({
      id: acquisitions.id,
      slug: acquisitions.slug,
      date: sql<string>`${filed}::text`,
      announcedDate: sql<string | null>`${acquisitions.announcedDate}::text`,
      closedDate: sql<string | null>`${acquisitions.closedDate}::text`,
      dealValueUsd: sql<string | null>`${acquisitions.dealValueUsd}::text`,
      summary: acquisitions.summary,
      acquirerSlug: acquirer.slug,
      acquirerName: acquirer.name,
      acquirerType: sql<string>`${acquirer.type}::text`,
      ownerName: own.ownerName,
      franchiseOf: own.franchiseOf,
      isCoop: own.isCoop,
      chainTypes: own.chainTypes,
      targetSlug: target.slug,
      targetName: target.name,
      targetTrade: target.trade,
      targetCity: target.headquartersCity,
      targetState: target.headquartersState,
      iowa: sql<boolean>`(${target.headquartersState} = 'IA' or exists (select 1 from locations l where l.company_id = ${target.id} and l.state = 'IA'))`,
    })
    .from(acquisitions)
    .innerJoin(acquirer, eq(acquirer.id, acquisitions.acquirerId))
    .innerJoin(target, eq(target.id, acquisitions.targetId))
    .where(gte(filed, NEWS_SINCE))
    .orderBy(desc(filed));

  const ids = rows.map((r) => r.id);
  const srcRows = ids.length
    ? await db
        .select({
          subjectId: claimSources.subjectId,
          url: sources.url,
          title: sources.title,
          publication: sources.publication,
          publishedDate: sql<string | null>`${sources.publishedDate}::text`,
        })
        .from(claimSources)
        .innerJoin(sources, eq(sources.id, claimSources.sourceId))
        .where(and(eq(claimSources.subjectType, "acquisition"), inArray(claimSources.subjectId, ids)))
    : [];
  const bySubject = new Map<string, NewsSource[]>();
  for (const s of srcRows) {
    const list = bySubject.get(s.subjectId) ?? [];
    list.push({ url: s.url, title: s.title, publication: s.publication, publishedDate: s.publishedDate });
    bySubject.set(s.subjectId, list);
  }

  return rows.map((r) => ({
    slug: r.slug,
    date: r.date,
    announcedDate: r.announcedDate,
    closedDate: r.closedDate,
    dealValueUsd: r.dealValueUsd ? Number(r.dealValueUsd) : null,
    summary: r.summary,
    acquirer: {
      slug: r.acquirerSlug,
      name: r.acquirerName,
      ownerName: r.ownerName,
      kind: acquirerKind(r),
    },
    target: { slug: r.targetSlug, name: r.targetName, trade: r.targetTrade, city: r.targetCity, state: r.targetState },
    iowa: r.iowa,
    sources: bySubject.get(r.id) ?? [],
  }));
}
