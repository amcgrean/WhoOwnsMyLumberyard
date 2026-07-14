import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronUp } from "lucide-react";
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
import { OwnershipBadge } from "@/components/ownership-badge";
import { TradeChip } from "@/components/trade-chip";
import { Socials } from "@/components/socials";
import { LocationCard } from "@/components/location-card";
import { CitationRegistry, SourcesList } from "@/components/citation";
import {
  COMPANY_TYPE_LABELS,
  STATE_NAME_BY_CODE,
  TRADE_LABELS,
  stateSlug,
  type OwnershipBadgeKind,
} from "@/lib/constants";

export const revalidate = 3600; // 1 hour

type Params = Promise<{ slug: string }>;

// Ownership badge CSS variable per kind — used to tint the callout box and role labels.
const BADGE_VAR: Record<OwnershipBadgeKind, string> = {
  independent: "--color-badge-independent",
  private_equity: "--color-badge-pe",
  public: "--color-badge-public",
  coop: "--color-badge-coop",
  franchise: "--color-badge-franchise",
  family_mega: "--color-badge-family",
  unknown: "--color-badge-unknown",
};

/**
 * Callout box background + border, keyed to the ownership badge kind.
 * Independent reads greenish (accent-soft); everything else is a light tint of
 * its badge color via color-mix.
 */
function calloutStyle(kind: OwnershipBadgeKind): React.CSSProperties {
  if (kind === "independent") {
    return {
      background: "var(--color-accent-soft)",
      borderColor: "color-mix(in oklch, var(--color-accent) 30%, var(--color-rule))",
    };
  }
  const v = `var(${BADGE_VAR[kind]})`;
  return {
    background: `color-mix(in oklch, ${v} 10%, white)`,
    borderColor: `color-mix(in oklch, ${v} 30%, white)`,
  };
}

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

  // Cite location-level sources to anchor a marker next to the business name.
  const locSrcRows = await db.query.claimSources.findMany({
    where: (cs, { and, eq }) =>
      and(eq(cs.subjectType, "location"), eq(cs.subjectId, loc.id)),
    columns: { sourceId: true },
  });
  const locCitations = registry.cite(...locSrcRows.map((r) => r.sourceId));

  const stateName = STATE_NAME_BY_CODE[loc.state] ?? loc.state;
  const nearby = await getNearbyLocations({ id: loc.id, lat: loc.lat, lng: loc.lng }, 5);

  // Ownership chain rendered bottom-up: business ("On the sign") at the bottom,
  // ultimate owner at the top — reverse of the chain array (root-first).
  const ladder = [...chain].reverse();

  // A one-sentence, human callout explaining who owns this business.
  const calloutText =
    ultimate && ultimate.id !== operatingCompany.id
      ? `The ${loc.displayName} name stays on the sign, but ownership traces up to ${ultimate.name}${
          ultimate.type === "pe_firm"
            ? ", a private-equity firm"
            : ultimate.type === "public_company"
              ? ", a publicly traded company"
              : ""
        }.`
      : badge === "independent"
        ? `No private-equity or consolidator parent on the public record — ${loc.displayName} is independently owned.`
        : `${loc.displayName} operates under the ${operatingCompany.name} brand.`;

  const tradeHref = loc.trade
    ? `/state/${stateSlug(loc.state)}/${loc.trade}`
    : `/state/${stateSlug(loc.state)}`;
  const tradeCrumb = loc.trade
    ? `${TRADE_LABELS[loc.trade]} in ${stateName}`
    : `${stateName}`;

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
    <article className="mx-auto max-w-4xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <nav
        className="flex flex-wrap items-center gap-[7px] text-[12.5px] text-[var(--color-muted)]"
        aria-label="Breadcrumb"
      >
        <Link href="/" className="text-[var(--color-accent)] hover:underline">
          Home
        </Link>
        <span aria-hidden>/</span>
        <Link href={tradeHref} className="text-[var(--color-accent)] hover:underline">
          {tradeCrumb}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-[var(--color-ink)]">{loc.displayName}</span>
      </nav>

      {/* Trade + city */}
      <div className="mt-4 flex flex-wrap items-center gap-[10px]">
        <TradeChip trade={loc.trade} />
        <span className="text-[12.5px] text-[var(--color-muted)]">
          {loc.city}, {stateName}
        </span>
      </div>

      {/* Title */}
      <h1 className="mt-[10px] max-w-[20ch] font-serif font-semibold leading-[1.08] tracking-tight text-balance text-[clamp(28px,4.5vw,42px)]">
        {loc.displayName}
      </h1>

      {/* Ownership callout */}
      <div
        className="mt-[18px] flex flex-wrap items-center gap-[14px] rounded-[12px] border px-4 py-[14px]"
        style={calloutStyle(badge)}
      >
        <OwnershipBadge
          kind={badge}
          size="md"
          label={
            ultimate && ultimate.id !== operatingCompany.id
              ? `Owned by ${ultimate.name}`
              : badge === "independent"
                ? "Independent"
                : undefined
          }
        />
        <span className="min-w-[220px] flex-1 text-[13.5px] leading-[1.5] text-[var(--color-ink)]">
          {calloutText}
        </span>
      </div>

      {/* Two-column body */}
      <div
        className="mt-[30px] grid items-start gap-[26px]"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
      >
        {/* LEFT: ownership ladder + sources */}
        <div>
          <h2 className="mb-1 font-serif text-[20px] font-semibold">Who owns whom</h2>
          <p className="mb-4 text-[13px] leading-[1.5] text-[var(--color-muted)]">
            Read bottom-up: the brand on the sign, then each owner above it, to the
            ultimate owner.
          </p>

          <ol className="list-none p-0">
            {ladder.map((node, idx) => {
              const isTop = idx === 0;
              const isBottom = idx === ladder.length - 1;
              const roleLabel = isBottom
                ? "On the sign"
                : isTop
                  ? "Ultimate owner"
                  : "Operated by";
              // Role label color: accent at the bottom (the local brand), PE-red for a
              // PE ultimate owner, muted otherwise.
              const roleColor = isBottom
                ? "var(--color-accent)"
                : node.company.type === "pe_firm"
                  ? "var(--color-badge-pe)"
                  : "var(--color-muted)";
              const nums = node.edge ? edgeCitations[node.edge.id] : undefined;
              const linkBase =
                node.company.type === "yard"
                  ? "/yard"
                  : node.company.type === "pe_firm" ||
                      node.company.type === "public_company" ||
                      node.company.type === "family_office"
                    ? "/owner"
                    : "/company";
              return (
                <li key={node.company.id} className="relative">
                  {idx > 0 ? (
                    <div className="flex justify-center py-[2px]" aria-hidden>
                      <ChevronUp className="size-[18px] text-[var(--color-muted)]" />
                    </div>
                  ) : null}
                  <div className="rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper)] p-4">
                    <div
                      className="text-[10.5px] font-semibold uppercase tracking-[0.07em]"
                      style={{ color: roleColor }}
                    >
                      {roleLabel}
                    </div>
                    <div className="mt-[5px] flex flex-wrap items-baseline gap-[6px]">
                      <Link
                        href={`${linkBase}/${node.company.slug}`}
                        className="font-serif text-[18px] font-semibold leading-[1.2] hover:underline"
                      >
                        {node.company.name}
                      </Link>
                      {nums && nums.length > 0 ? (
                        <sup className="text-[11px] font-semibold text-[var(--color-accent)]">
                          {nums.map((n, i) => (
                            <span key={n}>
                              {i > 0 ? "," : ""}
                              <a href={`#source-${n}`} className="citation-link">
                                {n}
                              </a>
                            </span>
                          ))}
                        </sup>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[12.5px] leading-[1.45] text-[var(--color-muted)]">
                      {COMPANY_TYPE_LABELS[node.company.type]}
                      {node.company.ticker ? ` · ${node.company.ticker}` : ""}
                      {node.edge?.stakePct ? ` · ${node.edge.stakePct}% stake` : ""}
                      {node.edge?.startDate ? ` · since ${node.edge.startDate}` : ""}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Sources */}
          {registry.cited().length > 0 ? (
            <>
              <h3 className="mb-[10px] mt-[26px] border-t border-[var(--color-rule)] pt-[18px] font-serif text-[15px] font-semibold">
                Sources
              </h3>
              <ol className="flex list-none flex-col gap-[10px] p-0">
                {registry.cited().map((s) => (
                  <li
                    key={s.id}
                    id={`source-${s.number}`}
                    className="flex gap-[10px] text-[12.5px] leading-[1.45]"
                  >
                    <span className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-[var(--color-accent-soft)] text-[11px] font-bold tabular-nums text-[var(--color-accent)]">
                      {s.number}
                    </span>
                    <span className="text-[var(--color-muted)]">
                      {s.publication ? (
                        <span className="font-semibold text-[var(--color-ink)]">
                          {s.publication}
                        </span>
                      ) : null}
                      {s.publication && s.title ? ", " : ""}
                      {s.title ? <>&ldquo;{s.title}.&rdquo; </> : null}
                      {s.publishedDate ? <span>{s.publishedDate} </span> : null}
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--color-accent)] hover:underline"
                      >
                        {s.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </a>
                    </span>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </div>

        {/* RIGHT: address / services / on the record */}
        <div className="flex flex-col gap-[18px]">
          <div className="rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper)] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--color-muted)]">
              Address
            </div>
            <div className="mt-[6px] text-[14px] leading-[1.5]">
              {loc.addressLine1}
              {loc.addressLine2 ? `, ${loc.addressLine2}` : ""}
              <br />
              {loc.city}, {stateName} {loc.zip}
            </div>
            {locCitations.length > 0 ? (
              <sup className="ml-[3px] text-[11px] font-semibold text-[var(--color-accent)]">
                {locCitations.map((n, i) => (
                  <span key={n}>
                    {i > 0 ? "," : ""}
                    <a href={`#source-${n}`} className="citation-link">
                      {n}
                    </a>
                  </span>
                ))}
              </sup>
            ) : null}
            {loc.phone ? (
              <div className="mt-2 text-[13px] text-[var(--color-muted)]">{loc.phone}</div>
            ) : null}
            {loc.rating ? (
              <div className="mt-1 text-[13px] text-[var(--color-muted)]">
                <a
                  href={loc.googleMapsUri ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[var(--color-accent)]"
                >
                  ★ {loc.rating}
                  {loc.reviewCount
                    ? ` · ${loc.reviewCount.toLocaleString()} Google reviews`
                    : ""}
                </a>
              </div>
            ) : null}

            {loc.services.length > 0 ? (
              <>
                <div className="mt-[14px] text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--color-muted)]">
                  Services
                </div>
                <div className="mt-2 flex flex-wrap gap-[6px]">
                  {loc.services.map((svc) => (
                    <span
                      key={svc}
                      className="rounded-full border border-[var(--color-rule)] bg-[var(--color-paper2)] px-[10px] py-[3px] text-[12px] text-[var(--color-ink)]"
                    >
                      {svc}
                    </span>
                  ))}
                </div>
              </>
            ) : null}

            {loc.hours && loc.hours.length > 0 ? (
              <>
                <div className="mt-[14px] text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--color-muted)]">
                  Hours
                </div>
                <div className="mt-1 text-[12px] leading-6 text-[var(--color-muted)]">
                  {loc.hours.map((h) => (
                    <div key={h}>{h}</div>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <div className="rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper)] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--color-muted)]">
              On the record
            </div>
            <p className="mt-2 text-[13px] leading-[1.55] text-[var(--color-ink)]">
              Operating brand:{" "}
              <Link
                href={`/company/${operatingCompany.slug}`}
                className="text-[var(--color-accent)] hover:underline"
              >
                {operatingCompany.name}
              </Link>
              {operatingCompany.foundedYear
                ? `, established ${operatingCompany.foundedYear}.`
                : "."}
              {ultimate && ultimate.id !== operatingCompany.id
                ? ` Ultimately owned by ${ultimate.name}.`
                : ""}
            </p>

            {operatingCompany.website ? (
              <p className="mt-2 text-[13px] leading-[1.55]">
                <a
                  href={operatingCompany.website}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-[var(--color-accent)] hover:underline"
                >
                  {operatingCompany.website
                    .replace(/^https?:\/\//, "")
                    .replace(/\/$/, "")}
                </a>
              </p>
            ) : null}

            {operatingCompany.socials.length > 0 ? (
              <div className="mt-2">
                <Socials urls={operatingCompany.socials} />
              </div>
            ) : null}

            {acqRows.length > 0 ? (
              <div className="mt-[14px] border-t border-[var(--color-rule)] pt-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--color-muted)]">
                  Acquisition history
                </div>
                <ul className="mt-2 flex flex-col gap-2">
                  {acqRows.map((a) => (
                    <li key={a.id} className="text-[12.5px] leading-[1.45]">
                      <span className="text-[var(--color-muted)]">
                        {a.closedDate ?? a.announcedDate ?? "Date unknown"} —{" "}
                      </span>
                      {a.summary}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-[14px] border-t border-dashed border-[var(--color-rule)] pt-3 text-[12px] leading-[1.5] text-[var(--color-muted)]">
              Something off? Ownership records change and private deals go unannounced.{" "}
              <Link
                href="/submit"
                className="text-[var(--color-accent)] underline underline-offset-2"
              >
                Submit a sourced correction →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Nearby businesses */}
      {nearby.length > 0 ? (
        <section className="mt-12">
          <h2 className="mb-3 font-serif text-[20px] font-semibold">Nearby businesses</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {nearby.map((n) => (
              <LocationCard key={n.id} location={n} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Full sourced footnotes */}
      <SourcesList sources={registry.cited()} />
    </article>
  );
}
