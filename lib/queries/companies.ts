import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, locations } from "@/lib/db/schema";
import type { Company } from "@/lib/db/schema";

export async function getCompanyBySlug(slug: string): Promise<Company | null> {
  const row = await db.query.companies.findFirst({ where: eq(companies.slug, slug) });
  return row ?? null;
}

export async function getCompanyById(id: string): Promise<Company | null> {
  const row = await db.query.companies.findFirst({ where: eq(companies.id, id) });
  return row ?? null;
}

export async function getCompanyLocationCount(companyId: string): Promise<number> {
  const rows = await db.query.locations.findMany({
    where: eq(locations.companyId, companyId),
    columns: { id: true },
  });
  return rows.length;
}

export async function getLocationsForCompany(companyId: string, limit = 100) {
  return db.query.locations.findMany({
    where: eq(locations.companyId, companyId),
    orderBy: (l, { asc }) => [asc(l.state), asc(l.city), asc(l.displayName)],
    limit,
  });
}
