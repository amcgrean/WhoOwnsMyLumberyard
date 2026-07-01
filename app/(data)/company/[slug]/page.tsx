import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { acquisitions } from "@/lib/db/schema";
import { getCompanyBySlug, getLocationsForCompany } from "@/lib/queries/companies";
import {
  classifyOwnership,
  getOwnedCompanies,
  getOwnershipChain,
  ultimateOwner,
} from "@/lib/ownership-graph";
import { getCitedSources } from "@/lib/queries/sources";
import { OwnershipChain } from "@/components/ownership-chain";
import { OwnershipBadge } from "@/components/ownership-badge";
import { Socials } from "@/components/socials";
import { LocationCard } from "@/components/location-card";
import { CitationRegistry, SourcesList } from "@/components/citation";
import { COMPANY_TYPE_LABELS } from "@/lib/constants";

export const revalidate = 3600;

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCompanyBySlug(slug);
  if (!c) return { title: "Company not found" };
  return {
    title: c.name,
    description: c.description ?? `Ownership profile for ${c.name}.`,
    alternates: { canonical: `/company/${c.slug}` },
  };
}

export default async function CompanyPage({ params }: { params: Params }) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const chain = await getOwnershipChain(company.id);
  const badge = classifyOwnership(chain);
  const ultimate = ultimateOwner(chain);
  const owned = await getOwnedCompanies(company.id);
  const locations = await getLocationsForCompany(company.id, 200);

  const acqRows = await db
    .select()
    .from(acquisitions)
    .where(or(eq(acquisitions.acquirerId, company.id), eq(acquisitions.targetId, company.id)));

  const subjectPairs: Array<{
    subjectType: "company" | "ownership_edge" | "acquisition";
    subjectId: string;
  }> = [
    { subjectType: "company", subjectId: company.id },
    ...chain
      .filter((n) => n.edge)
      .map((n) => ({ subjectType: "ownership_edge" as const, subjectId: n.edge!.id })),
    ...acqRows.map((a) => ({ subjectType: "acquisition" as const, subjectId: a.id })),
  ];
  const cited = await getCitedSources(subjectPairs);
  const registry = new CitationRegistry(cited);
  const edgeCitations: Record<string, number[]> = {};
  for (const node of chain) {
    if (!node.edge) continue;
    const rows = await db.query.claimSources.findMany({
      where: (cs, { and, eq }) =>
        and(eq(cs.subjectType, "ownership_edge"), eq(cs.subjectId, node.edge!.id)),
      columns: { sourceId: true },
    });
    edgeCitations[node.edge.id] = registry.cite(...rows.map((r) => r.sourceId));
  }

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
          <OwnershipBadge
            kind={badge}
            label={
              ultimate && ultimate.id !== company.id
                ? `Owned by ${ultimate.name}`
                : undefined
            }
          />
        </div>
        {company.website ? (
          <p className="mt-3 text-sm">
            <a
              href={company.website}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-accent)] underline"
            >
              Visit website ↗
            </a>
          </p>
        ) : null}
        <Socials urls={company.socials} className="mt-2" />
      </header>

      {chain.length > 1 ? (
        <section className="mb-10">
          <h2 className="font-serif text-xl mb-3">Ownership chain</h2>
          <OwnershipChain chain={chain} edgeCitations={edgeCitations} />
        </section>
      ) : null}

      {owned.length > 0 ? (
        <section className="mb-10">
          <h2 className="font-serif text-xl mb-3">Owns</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {owned.map(({ company: c }) => (
              <li key={c.id}>
                <Link
                  href={`/company/${c.slug}`}
                  className="block rounded-md border border-[var(--color-rule)] p-3 hover:border-[var(--color-accent)]"
                >
                  <div className="font-serif">{c.name}</div>
                  <div className="text-xs text-[var(--color-muted)]">
                    {COMPANY_TYPE_LABELS[c.type]}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {locations.length > 0 ? (
        <section className="mb-10">
          <h2 className="font-serif text-xl mb-3">
            Locations <span className="text-[var(--color-muted)] text-sm">({locations.length})</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {locations.slice(0, 50).map((l) => (
              <LocationCard key={l.id} location={l} />
            ))}
          </div>
          {locations.length > 50 ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">
              Showing 50 of {locations.length}. Browse the full list on the{" "}
              <Link href="/map" className="underline">
                map
              </Link>
              .
            </p>
          ) : null}
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
