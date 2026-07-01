import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { eq, sql, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { acquisitions, locations } from "@/lib/db/schema";
import { getCompanyBySlug } from "@/lib/queries/companies";
import { getOwnedCompanies } from "@/lib/ownership-graph";
import { getCitedSources } from "@/lib/queries/sources";
import { OwnershipBadge } from "@/components/ownership-badge";
import { CitationRegistry, SourcesList } from "@/components/citation";
import {
  COMPANY_TYPE_LABELS,
  STATE_NAME_BY_CODE,
  type OwnershipBadgeKind,
} from "@/lib/constants";

export const revalidate = 3600;

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCompanyBySlug(slug);
  if (!c) return { title: "Owner not found" };
  return {
    title: c.name,
    description: c.description ?? `Businesses and brands controlled by ${c.name}.`,
    alternates: { canonical: `/owner/${c.slug}` },
  };
}

const TYPE_TO_BADGE: Record<string, OwnershipBadgeKind> = {
  pe_firm: "private_equity",
  public_company: "public",
  family_office: "family_mega",
  coop: "coop",
};

export default async function OwnerPage({ params }: { params: Params }) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const owned = await getOwnedCompanies(company.id);
  const ownedIds = owned.map((o) => o.company.id);

  // Aggregate location counts per child + per state
  const locStats = ownedIds.length
    ? await db
        .select({
          companyId: locations.companyId,
          state: locations.state,
          count: sql<number>`cast(count(*) as int)`,
        })
        .from(locations)
        .where(inArray(locations.companyId, ownedIds))
        .groupBy(locations.companyId, locations.state)
    : [];

  const totalLocations = locStats.reduce((acc, r) => acc + r.count, 0);
  const stateCounts = new Map<string, number>();
  for (const r of locStats) {
    stateCounts.set(r.state, (stateCounts.get(r.state) ?? 0) + r.count);
  }
  const topStates = [...stateCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const acqRows = await db
    .select()
    .from(acquisitions)
    .where(eq(acquisitions.acquirerId, company.id));

  const subjectPairs: Array<{
    subjectType: "company" | "acquisition";
    subjectId: string;
  }> = [
    { subjectType: "company", subjectId: company.id },
    ...acqRows.map((a) => ({ subjectType: "acquisition" as const, subjectId: a.id })),
  ];
  const cited = await getCitedSources(subjectPairs);
  const registry = new CitationRegistry(cited);
  for (const s of cited) registry.cite(s.id);

  const badge: OwnershipBadgeKind = TYPE_TO_BADGE[company.type] ?? "unknown";

  return (
    <article className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
          {COMPANY_TYPE_LABELS[company.type]}
          {company.ticker ? ` · ${company.ticker}` : ""}
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl mt-1">{company.name}</h1>
        {company.description ? (
          <p className="mt-2 text-[var(--color-muted)] max-w-2xl">{company.description}</p>
        ) : null}
        <div className="mt-3">
          <OwnershipBadge kind={badge} />
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3 mb-10">
        <Stat label="Locations controlled" value={totalLocations.toLocaleString()} />
        <Stat label="States with presence" value={stateCounts.size.toString()} />
        <Stat label="Brands owned" value={owned.length.toString()} />
      </section>

      {owned.length > 0 ? (
        <section className="mb-10">
          <h2 className="font-serif text-xl mb-3">Brands owned</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {owned.map(({ company: c }) => {
              const locCount = locStats
                .filter((s) => s.companyId === c.id)
                .reduce((a, r) => a + r.count, 0);
              return (
                <li key={c.id}>
                  <Link
                    href={`/company/${c.slug}`}
                    className="block rounded-md border border-[var(--color-rule)] p-3 hover:border-[var(--color-accent)]"
                  >
                    <div className="font-serif">{c.name}</div>
                    <div className="text-xs text-[var(--color-muted)]">
                      {COMPANY_TYPE_LABELS[c.type]}
                      {locCount > 0 ? ` · ${locCount.toLocaleString()} locations` : ""}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {topStates.length > 0 ? (
        <section className="mb-10">
          <h2 className="font-serif text-xl mb-3">Top states</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {topStates.map(([code, count]) => (
              <li key={code}>
                <Link
                  href={`/state/${(STATE_NAME_BY_CODE[code] ?? code).toLowerCase().replace(/\s+/g, "-")}`}
                  className="flex justify-between border-b border-[var(--color-rule)] py-1.5 text-sm hover:text-[var(--color-accent)]"
                >
                  <span>{STATE_NAME_BY_CODE[code] ?? code}</span>
                  <span className="text-[var(--color-muted)]">{count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {acqRows.length > 0 ? (
        <section className="mb-10">
          <h2 className="font-serif text-xl mb-3">Acquisition history</h2>
          <ul className="space-y-3">
            {acqRows.map((a) => (
              <li key={a.id} className="border-l-2 border-[var(--color-accent)] pl-4">
                <div className="text-xs text-[var(--color-muted)]">
                  {a.closedDate ?? a.announcedDate ?? "Date unknown"}
                </div>
                <div className="text-sm">{a.summary}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <SourcesList sources={registry.cited()} />
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-rule)] p-4">
      <div className="font-serif text-2xl">{value}</div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">{label}</div>
    </div>
  );
}
