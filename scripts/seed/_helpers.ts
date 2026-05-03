import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  acquisitions,
  claimSources,
  companies,
  locations,
  ownershipEdges,
  sources,
  type Company,
  type NewCompany,
  type NewLocation,
  type NewOwnershipEdge,
  type NewAcquisition,
} from "@/lib/db/schema";
import { slugify, locationSlug } from "@/lib/slug";

export type ClaimSubject = "ownership_edge" | "acquisition" | "company" | "location";

/** Upsert a company by slug. Returns the row. */
export async function upsertCompany(input: Omit<NewCompany, "slug"> & { slug?: string }): Promise<Company> {
  const slug = input.slug ?? slugify(input.name);
  const existing = await db.query.companies.findFirst({ where: eq(companies.slug, slug) });
  if (existing) {
    const [updated] = await db
      .update(companies)
      .set({ ...input, slug, updatedAt: new Date() })
      .where(eq(companies.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db.insert(companies).values({ ...input, slug }).returning();
  return created;
}

/** Upsert a directed ownership edge keyed on (parent, child, startDate). */
export async function upsertEdge(
  input: NewOwnershipEdge & { sources?: string[]; quote?: string }
): Promise<{ id: string }> {
  const { sources: srcUrls = [], quote, ...rest } = input;
  const existing = await db.query.ownershipEdges.findFirst({
    where: and(
      eq(ownershipEdges.parentId, rest.parentId),
      eq(ownershipEdges.childId, rest.childId)
    ),
  });
  let id: string;
  if (existing) {
    const [u] = await db
      .update(ownershipEdges)
      .set({ ...rest, updatedAt: new Date() })
      .where(eq(ownershipEdges.id, existing.id))
      .returning({ id: ownershipEdges.id });
    id = u.id;
  } else {
    const [u] = await db.insert(ownershipEdges).values(rest).returning({ id: ownershipEdges.id });
    id = u.id;
  }
  for (const url of srcUrls) {
    await linkSource({ url }, "ownership_edge", id, quote);
  }
  return { id };
}

export async function upsertAcquisition(
  input: NewAcquisition & { sources?: string[] }
): Promise<{ id: string }> {
  const { sources: srcUrls = [], ...rest } = input;
  const existing = await db.query.acquisitions.findFirst({
    where: eq(acquisitions.slug, rest.slug),
  });
  let id: string;
  if (existing) {
    const [u] = await db
      .update(acquisitions)
      .set({ ...rest, updatedAt: new Date() })
      .where(eq(acquisitions.id, existing.id))
      .returning({ id: acquisitions.id });
    id = u.id;
  } else {
    const [u] = await db.insert(acquisitions).values(rest).returning({ id: acquisitions.id });
    id = u.id;
  }
  for (const url of srcUrls) {
    await linkSource({ url }, "acquisition", id);
  }
  return { id };
}

export async function upsertSource(input: { url: string; title?: string; publication?: string; publishedDate?: string; archiveUrl?: string }) {
  const existing = await db.query.sources.findFirst({ where: eq(sources.url, input.url) });
  if (existing) return existing;
  const [created] = await db
    .insert(sources)
    .values({
      url: input.url,
      title: input.title ?? null,
      publication: input.publication ?? null,
      publishedDate: input.publishedDate ?? null,
      archiveUrl: input.archiveUrl ?? null,
    })
    .returning();
  return created;
}

export async function linkSource(
  src: { url: string; title?: string; publication?: string; publishedDate?: string; archiveUrl?: string },
  subjectType: ClaimSubject,
  subjectId: string,
  quote?: string
) {
  const source = await upsertSource(src);
  await db
    .insert(claimSources)
    .values({ sourceId: source.id, subjectType, subjectId, quote: quote ?? null })
    .onConflictDoNothing();
}

export async function upsertLocation(
  input: Omit<NewLocation, "slug"> & { slug?: string; sources?: string[] }
) {
  const { sources: srcUrls = [], ...rest } = input;
  const slug = rest.slug ?? locationSlug({ name: rest.displayName, city: rest.city, state: rest.state });
  const existing = await db.query.locations.findFirst({ where: eq(locations.slug, slug) });
  let row;
  if (existing) {
    [row] = await db
      .update(locations)
      .set({ ...rest, slug, updatedAt: new Date() })
      .where(eq(locations.id, existing.id))
      .returning();
  } else {
    [row] = await db.insert(locations).values({ ...rest, slug }).returning();
  }
  for (const url of srcUrls) {
    await linkSource({ url }, "location", row.id);
  }
  return row;
}
