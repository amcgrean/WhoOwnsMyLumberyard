import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, locations, type Trade } from "@/lib/db/schema";
import {
  STATE_CODE_BY_SLUG,
  STATE_NAME_BY_CODE,
  TRADE_LABELS,
  TRADE_SHORT_LABELS,
  type OwnershipBadgeKind,
} from "@/lib/constants";
import { ownershipSelect, kindFromRow } from "@/lib/ownership-sql";
import { isChainOwned, isLocallyOwned } from "@/lib/ownership-kind";
import { OwnershipBadge } from "@/components/ownership-badge";
import { TradeChip } from "@/components/trade-chip";
import { BizRow } from "@/components/biz-row";

export const revalidate = 3600;

type Params = Promise<{ state: string; trade: string }>;

const TRADES = Object.keys(TRADE_LABELS) as Trade[];
/** Locally-owned rows shown before the list collapses. */
const LOCAL_PREVIEW = 12;

function resolve(stateSlug: string, tradeSlug: string) {
  const code = STATE_CODE_BY_SLUG[stateSlug.toLowerCase()];
  const trade = TRADES.includes(tradeSlug as Trade) ? (tradeSlug as Trade) : null;
  if (!code || !trade) return null;
  return { code, name: STATE_NAME_BY_CODE[code], trade };
}

/** Trade name for running prose — keeps acronyms like HVAC upper-case. */
function tradeNoun(t: Trade): string {
  return t === "hvac" ? "HVAC" : TRADE_SHORT_LABELS[t].toLowerCase();
}

const INTRO: Record<Trade, string> = {
  hvac: "Heating and cooling is one of the most heavily consolidated home-services trades — private-equity-backed platforms have been buying up local HVAC companies and keeping the original name on the truck.",
  plumbing: "Plumbing companies are a frequent private-equity target: platforms roll up trusted local plumbers, often without changing the name customers know.",
  electrical: "Residential electrical contractors are increasingly acquired by national, private-equity-backed home-services platforms operating under the local brand.",
  lumber: "Lumberyards and building-materials dealers have consolidated heavily under public companies, private-equity firms, and buying groups over the last two decades.",
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { state, trade } = await params;
  const resolved = resolve(state, trade);
  if (!resolved) return { title: "Not found" };
  const noun = tradeNoun(resolved.trade);
  return {
    title: `Who owns ${resolved.name}'s ${noun} companies?`,
    description: `Which ${noun} companies in ${resolved.name} are locally owned and which are owned by private equity, public companies, or national chains — with the ownership chain and sources for each.`,
    alternates: { canonical: `/state/${state}/${trade}` },
  };
}

type Row = {
  slug: string;
  name: string;
  city: string;
  state: string;
  trade: Trade | null;
  brand: string;
  ownerName: string | null;
  franchiseOf: string | null;
  kind: OwnershipBadgeKind;
};

function ownerLine(r: Row): string {
  if (r.franchiseOf) return `Franchise of ${r.franchiseOf}`;
  if (r.ownerName) return `Owned by ${r.ownerName}`;
  switch (r.kind) {
    case "independent":
      return "Locally owned";
    case "coop":
      return "Locally owned · co-op member";
    case "public":
      return `Publicly traded · ${r.brand}`;
    case "unknown":
      return "Ownership not yet verified";
    default:
      return r.brand;
  }
}

export default async function StateTradePage({ params }: { params: Params }) {
  const { state, trade } = await params;
  const resolved = resolve(state, trade);
  if (!resolved) notFound();

  let rows: Row[] = [];
  try {
    const raw = await db
      .select({
        slug: locations.slug,
        name: locations.displayName,
        city: locations.city,
        state: locations.state,
        trade: locations.trade,
        brand: companies.name,
        companySlug: companies.slug,
        companyType: companies.type,
        ...ownershipSelect(companies.id),
      })
      .from(locations)
      .innerJoin(companies, eq(locations.companyId, companies.id))
      .where(and(eq(locations.state, resolved.code), eq(locations.trade, resolved.trade)))
      .orderBy(locations.city, locations.displayName);
    rows = raw.map((r) => ({ ...r, kind: kindFromRow(r) }));
  } catch (err) {
    console.warn("[state-trade] read failed (likely no migrations yet)", err);
  }

  const local = rows.filter((r) => isLocallyOwned(r.kind));
  const chain = rows.filter((r) => isChainOwned(r.kind));
  const other = rows.filter((r) => !isLocallyOwned(r.kind) && !isChainOwned(r.kind));

  // Who's behind the chain-owned rows, by immediate parent.
  const owners = new Map<string, { name: string; count: number; kind: OwnershipBadgeKind }>();
  for (const r of chain) {
    const name = r.ownerName ?? r.brand;
    const cur = owners.get(name);
    if (cur) cur.count += 1;
    else owners.set(name, { name, count: 1, kind: r.kind });
  }
  const ownerList = [...owners.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const stateName = resolved.name;
  const noun = tradeNoun(resolved.trade);
  const pct = rows.length ? Math.round((chain.length / rows.length) * 100) : 0;
  const mapHref = `/map?state=${resolved.code}&trade=${resolved.trade}`;

  const stats: { value: string; label: string; color: string }[] = [
    { value: rows.length.toLocaleString(), label: "Businesses tracked", color: "var(--color-ink)" },
    { value: local.length.toLocaleString(), label: "Locally owned", color: "var(--color-badge-independent)" },
    { value: chain.length.toLocaleString(), label: `Chain-owned (${pct}%)`, color: "var(--color-badge-pe)" },
    ...(other.length
      ? [{ value: other.length.toLocaleString(), label: "Franchise or unverified", color: "var(--color-muted)" }]
      : []),
  ];

  const row = (r: Row) => (
    <BizRow
      key={r.slug}
      href={`/yard/${r.slug}`}
      name={r.name}
      city={r.city}
      state={r.state}
      ownerLine={ownerLine(r)}
      trade={r.trade}
      badge={r.kind}
    />
  );

  return (
    <div className="mx-auto max-w-4xl px-4 pb-14 pt-6">
      <nav className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted" aria-label="Breadcrumb">
        <Link href="/" className="text-accent hover:underline">Home</Link>
        <span aria-hidden>/</span>
        <Link href={`/state/${state}`} className="text-accent hover:underline">{stateName}</Link>
        <span aria-hidden>/</span>
        <span className="text-ink">{TRADE_SHORT_LABELS[resolved.trade]}</span>
      </nav>

      <section className="pt-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <TradeChip trade={resolved.trade} />
          <span className="text-[12.5px] text-muted">{stateName}</span>
        </div>

        <h1 className="mt-3 max-w-[20ch] text-balance font-serif text-[clamp(28px,4.5vw,42px)] font-semibold leading-[1.08] tracking-tight text-ink">
          Who owns {stateName}&rsquo;s {noun} companies?
        </h1>

        <p className="mt-4 max-w-[64ch] text-[15.5px] leading-[1.65] text-ink">{INTRO[resolved.trade]}</p>

        {rows.length === 0 ? (
          <p className="mt-6 text-muted">
            No {noun} companies tracked in {stateName} yet.{" "}
            <Link href="/submit" className="underline">Know one? Submit a tip</Link>.
          </p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="rounded-[12px] border border-rule bg-paper px-4 py-3">
                  <div className="font-serif text-[26px] font-semibold leading-none" style={{ color: s.color }}>
                    {s.value}
                  </div>
                  <div className="mt-1.5 text-[12px] leading-[1.4] text-muted">{s.label}</div>
                </div>
              ))}
            </div>
            <Link
              href={mapHref}
              className="mt-4 inline-flex items-center gap-1 text-[14px] font-semibold text-accent hover:underline hover:underline-offset-2"
            >
              See them on the map &rarr;
            </Link>

            {/* ── Chain-owned: the headline finding ── */}
            {chain.length > 0 ? (
              <section className="mt-9">
                <div className="flex flex-wrap items-center gap-2.5">
                  <OwnershipBadge kind="private_equity" label="Chain-owned" />
                  <h2 className="font-serif text-[21px] font-semibold text-ink">
                    Owned further up the chain
                  </h2>
                </div>
                <p className="mb-4 mt-2.5 max-w-[62ch] text-[13.5px] leading-[1.55] text-muted">
                  Run under a local-sounding name but controlled by a private-equity fund, a public
                  company, or a large private chain. Tap any row for the ownership chain and sources.
                </p>
                {ownerList.length > 1 ? (
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {ownerList.map((o) => (
                      <span
                        key={o.name}
                        className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper px-2.5 py-1 text-[12px] text-ink"
                      >
                        {o.name}
                        <span className="tabular-nums text-muted">{o.count}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-col gap-2">{chain.map(row)}</div>
              </section>
            ) : null}

            {/* ── Locally owned ── */}
            {local.length > 0 ? (
              <section
                className="mt-9 rounded-[14px] bg-accent-soft p-5"
                style={{ border: "1px solid color-mix(in oklch, var(--color-accent) 30%, var(--color-rule))" }}
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <OwnershipBadge kind="independent" label="Locally owned" />
                  <h2 className="font-serif text-[21px] font-semibold text-ink">
                    {local.length.toLocaleString()} locally owned in {stateName}
                  </h2>
                </div>
                <p className="mb-4 mt-2.5 max-w-[60ch] text-[13.5px] leading-[1.55] text-ink">
                  No private-equity or consolidator parent on the public record — family-owned,
                  employee-owned, or co-op members. These are the ones to call first.
                </p>
                <div className="flex flex-col gap-2">{local.slice(0, LOCAL_PREVIEW).map(row)}</div>
                {local.length > LOCAL_PREVIEW ? (
                  <details className="group mt-2">
                    <summary className="flex cursor-pointer list-none items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[color-mix(in_oklch,var(--color-accent)_35%,var(--color-rule))] px-4 py-2.5 text-[13.5px] font-semibold text-accent hover:bg-paper/60 [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">
                        Show all {local.length.toLocaleString()} locally-owned {noun} companies
                      </span>
                      <span className="hidden group-open:inline">Show fewer</span>
                    </summary>
                    <div className="mt-2 flex flex-col gap-2">{local.slice(LOCAL_PREVIEW).map(row)}</div>
                  </details>
                ) : null}
              </section>
            ) : null}

            {/* ── Franchises + unverified ── */}
            {other.length > 0 ? (
              <section className="mt-9">
                <h2 className="font-serif text-[19px] font-semibold text-ink">
                  Franchises &amp; not yet verified
                </h2>
                <p className="mb-4 mt-2 max-w-[62ch] text-[13.5px] leading-[1.55] text-muted">
                  Franchisees are locally owned but operate under a national brand. &ldquo;Unverified&rdquo;
                  businesses are in our records but their ownership hasn&rsquo;t been confirmed yet.
                </p>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13.5px] font-semibold text-accent [&::-webkit-details-marker]:hidden">
                    <span className="group-open:hidden">Show {other.length.toLocaleString()} {other.length === 1 ? "business" : "businesses"}</span>
                    <span className="hidden group-open:inline">Hide</span>
                  </summary>
                  <div className="mt-3 flex flex-col gap-2">{other.map(row)}</div>
                </details>
              </section>
            ) : null}
          </>
        )}

        <p className="mt-12 border-t border-rule pt-5 text-[12.5px] leading-relaxed text-muted">
          Ownership reflects the best available public evidence and is sourced on each business
          page. Spotted something wrong?{" "}
          <Link href="/submit" className="underline underline-offset-2">Submit a source-backed correction</Link>.
        </p>
      </section>
    </div>
  );
}
