import type { Metadata } from "next";
import { searchAll, type SearchResult } from "@/lib/search";
import {
  COMPANY_TYPE_LABELS,
  TRADE_SHORT_LABELS,
  type OwnershipBadgeKind,
} from "@/lib/constants";
import { BizRow } from "@/components/biz-row";
import { OwnershipBadge } from "@/components/ownership-badge";
import { ResultsMap, type MapPoint } from "@/components/map/results-map";
import { SearchField } from "./search-field";
import Link from "next/link";
import type { Trade } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Search",
  description: "Search businesses, companies, and owners.",
};

type SearchParams = Promise<{ q?: string; trade?: string }>;

const TRADES = Object.keys(TRADE_SHORT_LABELS) as Trade[];

// Map a company's record type to the color-coded ownership badge shown on the
// right of each Companies & Owners row. Best-effort from the type alone (the
// search query doesn't walk the ownership graph); consolidators/holdcos read as
// "unknown" until the chain is resolved on the detail page.
const COMPANY_TYPE_BADGE: Record<string, OwnershipBadgeKind> = {
  pe_firm: "private_equity",
  public_company: "public",
  coop: "coop",
  family_office: "family_mega",
  yard: "independent",
};

function companyBadge(type: string): OwnershipBadgeKind {
  return COMPANY_TYPE_BADGE[type] ?? "unknown";
}

// PE firms, public companies, and family offices live under /owner; everything
// else (local businesses, consolidators, holdcos, co-ops) under /company.
function companyHref(type: string, slug: string): string {
  const base =
    type === "pe_firm" || type === "public_company" || type === "family_office"
      ? "/owner"
      : "/company";
  return `${base}/${slug}`;
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const { q, trade } = await searchParams;
  const activeTrade = TRADES.includes(trade as Trade) ? (trade as Trade) : null;
  const results = q ? await searchAll(q, 50) : [];
  const grouped = groupByKind(results);
  const locations = activeTrade
    ? grouped.location.filter((r) => r.trade === activeTrade)
    : grouped.location;
  const companies = grouped.company;

  // Any matched businesses that carry coordinates get plotted on a map so a
  // location search (zip, city) shows where the results are, not just a list.
  const mapPoints: MapPoint[] = locations
    .filter((r) => r.lat != null && r.lng != null)
    .map((r) => ({
      slug: r.slug,
      name: r.displayName,
      city: r.city,
      state: r.state,
      brand: r.displayName,
      owner: r.ownerName,
      franchise: r.franchiseOf,
      trade: r.trade,
      lng: Number(r.lng),
      lat: Number(r.lat),
    }));

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-4">
      <h1 className="m-0 font-serif text-[clamp(26px,4vw,36px)] font-semibold leading-[1.1] tracking-tight text-ink">
        Search the record
      </h1>

      <SearchField initialQuery={q ?? ""} />

      {!q ? (
        <p className="mt-7 text-[13.5px] text-muted">
          Type a zip, business name, or city to search the record.
        </p>
      ) : (
        <>
          {grouped.location.length > 0 ? (
            <div className="mt-6">
              <TradeFilter q={q} active={activeTrade} />
            </div>
          ) : null}

          {mapPoints.length > 0 ? (
            <section className="mt-6">
              <ResultsMap points={mapPoints} className="h-[360px]" />
              <p className="mt-2 text-[12px] text-muted">
                {mapPoints.length.toLocaleString()} of {locations.length.toLocaleString()}{" "}
                matched businesses have mapped locations. Click a pin for details.
              </p>
            </section>
          ) : null}

          {/* ---------------- Businesses ---------------- */}
          <section className="mt-7">
            <div className="flex items-baseline gap-2 border-b border-rule pb-[9px]">
              <h2 className="m-0 font-serif text-[18px] font-semibold text-ink">Businesses</h2>
              <span className="text-[13px] text-muted">{locations.length}</span>
            </div>
            <div className="mt-[13px] flex flex-col gap-2">
              {locations.length > 0 ? (
                locations.map((r) => (
                  <BizRow
                    key={`l-${r.id}`}
                    href={`/yard/${r.slug}`}
                    name={r.displayName}
                    city={r.city}
                    state={r.state}
                    ownerLine={
                      r.franchiseOf
                        ? `Franchise of ${r.franchiseOf}`
                        : r.ownerName
                          ? `Owned by ${r.ownerName}`
                          : r.zip ||
                            (r.trade ? TRADE_SHORT_LABELS[r.trade] : "On the record")
                    }
                    trade={r.trade}
                    badge={
                      r.franchiseOf ? "franchise" : r.ownerName ? "private_equity" : "independent"
                    }
                  />
                ))
              ) : (
                <EmptyState query={q} noun="businesses" />
              )}
            </div>
          </section>

          {/* ------------- Companies & Owners ------------- */}
          <section className="mt-[30px]">
            <div className="flex items-baseline gap-2 border-b border-rule pb-[9px]">
              <h2 className="m-0 font-serif text-[18px] font-semibold text-ink">
                Companies &amp; Owners
              </h2>
              <span className="text-[13px] text-muted">{companies.length}</span>
            </div>
            <div className="mt-[13px] flex flex-col gap-2">
              {companies.length > 0 ? (
                companies.map((r) => {
                  const typeLabel =
                    COMPANY_TYPE_LABELS[r.type as keyof typeof COMPANY_TYPE_LABELS] ?? r.type;
                  const note = r.description ? r.description.slice(0, 120) : null;
                  return (
                    <Link
                      key={`c-${r.id}`}
                      href={companyHref(r.type, r.slug)}
                      className="flex items-center gap-3.5 rounded-[12px] border border-rule bg-paper px-[15px] py-[13px] transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-[color-mix(in_oklch,var(--color-accent)_50%,var(--color-rule))] hover:shadow-[0_6px_18px_-12px_rgba(30,30,20,0.5)]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-serif text-[16px] font-semibold leading-[1.25] text-ink">
                          {r.name}
                        </div>
                        <div className="mt-[3px] truncate text-[12.5px] text-muted">
                          {typeLabel}
                          {note ? ` · ${note}` : ""}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <OwnershipBadge kind={companyBadge(r.type)} size="sm" />
                      </div>
                    </Link>
                  );
                })
              ) : (
                <EmptyState query={q} noun="companies" />
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function EmptyState({ query, noun }: { query: string; noun: string }) {
  return (
    <div className="rounded-[12px] border border-dashed border-rule p-5 text-center text-[13px] text-muted">
      No {noun} match &ldquo;{query}&rdquo;.
    </div>
  );
}

function TradeFilter({ q, active }: { q: string; active: Trade | null }) {
  const base = "rounded-full px-3 py-1 text-xs ring-1 transition-colors";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted">Filter:</span>
      <Link
        href={`/search?q=${encodeURIComponent(q)}`}
        className={
          base +
          (active === null
            ? " bg-ink text-paper ring-transparent"
            : " ring-rule hover:border-accent")
        }
      >
        All trades
      </Link>
      {TRADES.map((t) => (
        <Link
          key={t}
          href={`/search?q=${encodeURIComponent(q)}&trade=${t}`}
          className={
            base +
            (active === t
              ? " bg-ink text-paper ring-transparent"
              : " ring-rule hover:border-accent")
          }
        >
          {TRADE_SHORT_LABELS[t]}
        </Link>
      ))}
    </div>
  );
}

function groupByKind(rows: SearchResult[]) {
  const out = {
    location: [] as Extract<SearchResult, { kind: "location" }>[],
    company: [] as Extract<SearchResult, { kind: "company" }>[],
  };
  for (const r of rows) {
    if (r.kind === "location") out.location.push(r);
    else out.company.push(r);
  }
  return out;
}
