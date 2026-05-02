import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { claimSources, sources } from "@/lib/db/schema";
import type { Source } from "@/lib/db/schema";

export type CitedSource = Source & { quote: string | null };

/**
 * Returns every source associated with any of the provided (subjectType, subjectId) pairs,
 * deduped by source.id, in a stable order. Used to render a numbered citations list at the
 * bottom of a page.
 */
export async function getCitedSources(
  subjects: Array<{ subjectType: "ownership_edge" | "acquisition" | "company" | "location"; subjectId: string }>
): Promise<CitedSource[]> {
  if (subjects.length === 0) return [];
  // Group by subjectType to issue one query per group
  const byType = new Map<string, string[]>();
  for (const s of subjects) {
    const arr = byType.get(s.subjectType) ?? [];
    arr.push(s.subjectId);
    byType.set(s.subjectType, arr);
  }

  const collected = new Map<string, CitedSource>();
  for (const [subjectType, ids] of byType.entries()) {
    if (ids.length === 0) continue;
    const rows = await db
      .select({
        source: sources,
        quote: claimSources.quote,
      })
      .from(claimSources)
      .innerJoin(sources, eq(sources.id, claimSources.sourceId))
      .where(
        and(
          eq(
            claimSources.subjectType,
            subjectType as "ownership_edge" | "acquisition" | "company" | "location"
          ),
          inArray(claimSources.subjectId, ids)
        )
      );
    for (const r of rows) {
      if (!collected.has(r.source.id)) {
        collected.set(r.source.id, { ...r.source, quote: r.quote });
      }
    }
  }
  return Array.from(collected.values()).sort((a, b) => {
    const ad = a.publishedDate ?? a.accessedDate;
    const bd = b.publishedDate ?? b.accessedDate;
    return String(ad).localeCompare(String(bd));
  });
}
