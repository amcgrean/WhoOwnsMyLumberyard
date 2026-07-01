import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { acquisitions } from "@/lib/db/schema";
import { getLocationBySlug, getNearbyLocations } from "@/lib/queries/locations";
import { getCompanyById } from "@/lib/queries/companies";
import {
  getOwnershipChain,
  classifyOwnership,
  ultimateOwner,
} from "@/lib/ownership-graph";
import { getCitedSources } from "@/lib/queries/sources";
import { OwnershipChain } from "@/components/ownership-chain";
import { OwnershipBadge } from "@/components/ownership-badge";
import { TradeChip } from "@/components/trade-chip";
import { LocationCard } from "@/components/location-card";
import { CitationRegistry, CitationMarker, SourcesList } from "@/components/citation";
import { COMPANY_TYPE_LABELS, STATE_NAME_BY_CODE } from "@/lib/constants";

export const revalidate = 3600; // 1 hour

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const loc = await getLocationBySlug(slug);
  if (!loc) return { title: "Business not found" };
  const stateName = STATE_NAME_BY_CODE[loc.state] ?? loc.state;
  return {
    title: `${loc.displayName} — ${loc.city}, ${stateName}`,
    description: `Ownership and acquisition history for ${loc.displayName} at ${loc.addressLine1}, ${loc.city}, ${stateName} ${loc.zip}.`,
    alternates: { canonical: `/yard/${loc.slug}` },
  };
}

export default async function YardPage({ params }: { params: Params }) {
  const { slug } = await params;
  const loc = await getLocationBySlug(slug);
  if (!loc) notFound();

  const operatingCompany = await getCompanyById(loc.companyId);
  if (!operatingCompany) notFound();

  const chain = await getOwnershipChain(operatingCompany.id);
  const badge = classifyOwnership(chain);
  const ultimate = ultimateOwner(chain);

  // Acquisition history relevant to any company in the chain
  const chainIds = chain.map((n) => n.company.id);
  const acqRows = chainIds.length
    ? await db
        .select()
        .from(acquisitions)
        .where(eq(acquisitions.targetId, operatingCompany.id))
    : [];

  // Sources cited on this page: location, operating company, every edge, every acquisition.
  const subjectPairs: Array<{
    subjectType: "location" | "company" | "ownership_edge" | "acquisition";
    subjectId: string;
  }> = [
    { subjectType: "location", subjectId: loc.id },
    ...chain.map((n) => ({ subjectType: "company" as const, subjectId: n.company.id })),
    ...chain
      .filter((n) => n.edge)
      .map((n) => ({ subjectType: "ownership_edge" as const, subjectId: n.edge!.id })),
    ...acqRows.map((a) => ({ subjectType: "acquisition" as const, subjectId: a.id })),
  ];
  const cited = await getCitedSources(subjectPairs);
  const registry = new CitationRegistry(cited);

  // Build per-edge citation numbers by re-querying the join table for each edge
  // and reserving stable numbers in the registry in chain order.
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

  // Cite location-level sources to anchor a marker next to the address
  const locSrcRows = await db.query.claimSources.findMany({
    where: (cs, { and, eq }) =>
      and(eq(cs.subjectType, "location"), eq(cs.subjectId, loc.id)),
    columns: { sourceId: true },
  });
  const locCitations = registry.cite(...locSrcRows.map((r) => r.sourceId));

  const stateName = STATE_NAME_BY_CODE[loc.state] ?? loc.state;
  const nearby = await getNearbyLocations({ id: loc.id, lat: loc.lat, lng: loc.lng }, 5);

  // JSON-LD: LocalBusiness with parentOrganization
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: loc.displayName,
    address: {
      "@type": "PostalAddress",
      streetAddress: loc.addressLine1,
      addressLocality: loc.city,
      addressRegion: loc.state,
      postalCode: loc.zip,
      addressCountry: "US",
    },
    telephone: loc.phone ?? undefined,
    url: operatingCompany.website ?? undefined,
    parentOrganization: ultimate
      ? {
          "@type": "Organization",
          name: ultimate.name,
          url: ultimate.website ?? undefined,
        }
      : undefined,
  };

  return (
    <article className="mx-auto max-w-4xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
          {COMPANY_TYPE_LABELS.yard}
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl mt-1">
          {loc.displayName}
          <CitationMarker numbers={locCitations} />
        </h1>
        <p className="mt-2 text-[var(--color-muted)]">
          {loc.addressLine1}
          {loc.addressLine2 ? `, ${loc.addressLine2}` : ""}, {loc.city}, {stateName} {loc.zip}
          {loc.phone ? ` · ${loc.phone}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <OwnershipBadge
            kind={badge}
            label={
              ultimate && ultimate.id !== operatingCompany.id
                ? `Owned by ${ultimate.name}`
                : badge === "independent"
                  ? "Independent"
                  : undefined
            }
          />
          <TradeChip trade={loc.trade} />
        </div>
      </header>

      <section className="mb-10">
        <h2 className="font-serif text-xl mb-3">Ownership chain</h2>
        <OwnershipChain chain={chain} edgeCitations={edgeCitations} />
      </section>

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

      <section className="mb-10">
        <h2 className="font-serif text-xl mb-3">About this business</h2>
        <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div>
            <dt className="text-[var(--color-muted)]">Operating brand</dt>
            <dd>
              <Link href={`/company/${operatingCompany.slug}`} className="underline">
                {operatingCompany.name}
              </Link>
            </dd>
          </div>
          {operatingCompany.foundedYear ? (
            <div>
              <dt className="text-[var(--color-muted)]">Established</dt>
              <dd>{operatingCompany.foundedYear}</dd>
            </div>
          ) : null}
          {loc.services.length > 0 ? (
            <div className="sm:col-span-2">
              <dt className="text-[var(--color-muted)]">Services</dt>
              <dd>{loc.services.join(", ")}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {nearby.length > 0 ? (
        <section className="mb-10">
          <h2 className="font-serif text-xl mb-3">Nearby businesses</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {nearby.map((n) => (
              <LocationCard key={n.id} location={n} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-md border border-[var(--color-rule)] p-4 my-10 bg-[var(--color-muted-bg)]">
        <p className="text-sm">
          See something wrong?{" "}
          <Link href="/submit" className="underline">
            Submit a correction
          </Link>{" "}
          — every claim on this site is sourced and corrections are reviewed.
        </p>
      </section>

      <SourcesList sources={registry.cited()} />
    </article>
  );
}
