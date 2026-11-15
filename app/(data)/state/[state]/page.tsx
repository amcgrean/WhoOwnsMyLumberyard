import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
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

export const revalidate = 600;

type Params = Promise<{ state: string }>;

const TRADES = Object.keys(TRADE_LABELS) as Trade[];
const CHAIN_PREVIEW = 25;

function resolveState(slug: string): { code: string; name: string } | null {
  const code = STATE_CODE_BY_SLUG[slug.toLowerCase()];
  if (!code) return null;
  return { code, name: STATE_NAME_BY_CODE[code] };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { state } = await params;
  const resolved = resolveState(state);
  if (!resolved) return { title: "State not found" };
  return {
    title: `Who owns the trades in ${resolved.name}`,
    description: `Lumberyards, plumbers, electricians, and HVAC companies in ${resolved.name}: which are locally owned and which are owned by private equity, public companies, or national chains — with sources.`,
    alternates: { canonical: `/state/${state}` },
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

export default async function StatePage({ params }: { params: Params }) {
  const { state } = await params;
  const resolved = resolveState(state);
  if (!resolved) notFound();

  // Degrades to empty if the DB is unreachable or mid-migration at build time.
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
      .where(eq(locations.state, resolved.code))
      .orderBy(locations.city, locations.displayName);
    rows = raw.map((r) => ({ ...r, kind: kindFromRow(r) }));
  } catch (err) {
    console.warn("[state] location read failed (likely no migrations yet)", err);
  }

  const total = rows.length;
  const local = rows.filter((r) => isLocallyOwned(r.kind));
  const chain = rows.filter((r) => isChainOwned(r.kind));
  const other = total - local.length - chain.length;
  const pct = total ? Math.round((chain.length / total) * 100) : 0;

  const byTrade = TRADES.map((t) => {
    const tr = rows.filter((r) => r.trade === t);
    return {
      trade: t,
      total: tr.length,
      local: tr.filter((r) => isLocallyOwned(r.kind)).length,
      chain: tr.filter((r) => isChainOwned(r.kind)).length,
    };
  }).filter((t) => t.total > 0);

  // Biggest owners = immediate ownership parents of chain-owned businesses.
  const owners = new Map<string, { name: string; count: number; kind: OwnershipBadgeKind }>();
  for (const r of chain) {
    const name = r.ownerName ?? r.brand;
    const cur = owners.get(name);
    if (cur) cur.count += 1;
    else owners.set(name, { name, count: 1, kind: r.kind });
  }
  const topOwners = [...owners.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 8);

  const stats: { value: string; label: string; color: string }[] = [
    { value: total.toLocaleString(), label: "Businesses tracked", color: "var(--color-ink)" },
    { value: local.length.toLocaleString(), label: "Locally owned", color: "var(--color-badge-independent)" },
    { value: `${pct}%`, label: `Chain-owned (${chain.length.toLocaleString()})`, color: "var(--color-badge-pe)" },
    { value: other.toLocaleString(), label: "Franchise or unverified", color: "var(--color-muted)" },
  ];

  const mapHref = `/map?state=${resolved.code}`;
  const ownerLine = (r: Row) => (r.ownerName ? `Owned by ${r.ownerName}` : r.brand);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-14 pt-6">
      <nav className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted" aria-label="Breadcrumb">
        <Link href="/" className="text-accent hover:underline">Home</Link>
        <span aria-hidden>/</span>
        <span className="text-ink">{resolved.name}</span>
      </nav>

      <header className="pt-5">
        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">
          State overview
        </div>
        <h1 className="mt-2 max-w-[22ch] text-balance font-serif text-[clamp(28px,4.5vw,42px)] font-semibold leading-[1.08] tracking-tight text-ink">
          Who owns the trades in {resolved.name}
        </h1>
        <p className="mt-3 max-w-[64ch] text-[15px] leading-[1.6] text-muted">
          Lumberyards, plumbers, electricians, and HVAC companies we track in {resolved.name},
          classified by who ultimately owns them. Every ownership link is sourced on the
          business&rsquo;s page.
        </p>
      </header>

      {total === 0 ? (
        <p className="mt-8 text-muted">
          No businesses tracked here yet. If you operate or know one,{" "}
          <Link href="/submit" className="underline">submit a tip</Link>.
        </p>
      ) : (
        <>
          <div className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-[12px] border border-rule bg-paper px-4 py-3.5">
                <div className="font-serif text-[28px] font-semibold leading-none" style={{ color: s.color }}>
                  {s.value}
                </div>
                <div className="mt-1.5 text-[12px] leading-[1.4] text-muted">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── By trade ── */}
          <section className="mt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-serif text-[22px] font-semibold text-ink">By trade</h2>
              <Link href={mapHref} className="text-[14px] font-semibold text-accent hover:underline hover:underline-offset-2">
                {`Open the ${resolved.name} map`} &rarr;
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {byTrade.map((t) => (
                <Link
                  key={t.trade}
                  href={`/state/${state}/${t.trade}`}
                  className="flex flex-col gap-3 rounded-[14px] border border-rule bg-paper p-4 transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-[color-mix(in_oklch,var(--color-accent)_45%,var(--color-rule))] hover:shadow-[0_10px_26px_-18px_rgba(30,30,20,0.55)]"
                >
                  <span className="self-start"><TradeChip trade={t.trade} /></span>
                  <div className="font-serif text-[18px] font-semibold leading-tight text-ink">
                    {TRADE_LABELS[t.trade]}
                  </div>
                  <dl className="mt-auto grid grid-cols-3 gap-1 border-t border-dashed border-rule pt-3 text-[11.5px] text-muted">
                    <div><dt>Tracked</dt><dd className="font-serif text-[17px] font-semibold text-ink">{t.total.toLocaleString()}</dd></div>
                    <div><dt>Local</dt><dd className="font-serif text-[17px] font-semibold text-[var(--color-badge-independent)]">{t.local.toLocaleString()}</dd></div>
                    <div><dt>Chain</dt><dd className="font-serif text-[17px] font-semibold text-[var(--color-badge-pe)]">{t.chain.toLocaleString()}</dd></div>
                  </dl>
                </Link>
              ))}
            </div>
          </section>

          {/* ── Biggest owners ── */}
          {topOwners.length > 0 ? (
            <section className="mt-10">
              <h2 className="font-serif text-[22px] font-semibold text-ink">
                Biggest owners in {resolved.name}
              </h2>
              <p className="mt-1.5 text-[13.5px] text-muted">
                Parent companies behind the most locations we track here.
              </p>
              <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
                {topOwners.map((o) => (
                  <li key={o.name} className="flex items-center justify-between gap-3 border-b border-rule py-2.5">
                    <span className="min-w-0 truncate font-serif text-[15.5px] font-semibold text-ink">{o.name}</span>
                    <span className="flex shrink-0 items-center gap-2.5">
                      <OwnershipBadge kind={o.kind} size="sm" />
                      <span className="w-8 text-right tabular-nums text-[13px] text-muted">{o.count}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* ── Chain-owned list ── */}
          {chain.length > 0 ? (
            <section className="mt-10">
              <h2 className="font-serif text-[22px] font-semibold text-ink">
                Chain-owned businesses
              </h2>
              <p className="mb-4 mt-1.5 max-w-[62ch] text-[13.5px] text-muted">
                Local-sounding names owned further up the chain. Tap any row for the ownership
                chain and its sources.
              </p>
              <div className="flex flex-col gap-2">
                {chain.slice(0, CHAIN_PREVIEW).map((r) => (
                  <BizRow key={r.slug} href={`/yard/${r.slug}`} name={r.name} city={r.city} state={r.state} ownerLine={ownerLine(r)} trade={r.trade} badge={r.kind} />
                ))}
              </div>
              {chain.length > CHAIN_PREVIEW ? (
                <details className="group mt-2">
                  <summary className="flex cursor-pointer list-none items-center justify-center rounded-[10px] border border-dashed border-rule px-4 py-2.5 text-[13.5px] font-semibold text-accent hover:bg-muted-bg [&::-webkit-details-marker]:hidden">
                    <span className="group-open:hidden">Show all {chain.length.toLocaleString()} chain-owned businesses</span>
                    <span className="hidden group-open:inline">Show fewer</span>
                  </summary>
                  <div className="mt-2 flex flex-col gap-2">
                    {chain.slice(CHAIN_PREVIEW).map((r) => (
                      <BizRow key={r.slug} href={`/yard/${r.slug}`} name={r.name} city={r.city} state={r.state} ownerLine={ownerLine(r)} trade={r.trade} badge={r.kind} />
                    ))}
                  </div>
                </details>
              ) : null}
            </section>
          ) : null}

          <div className="mt-10 flex flex-col items-start gap-3 rounded-[14px] border border-rule bg-paper2 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-serif text-[18px] font-semibold text-ink">
                Looking for a locally-owned business?
              </div>
              <p className="mt-1 text-[13.5px] text-muted">
                Browse all {local.length.toLocaleString()} locally-owned businesses in{" "}
                {resolved.name} by trade or on the map.
              </p>
            </div>
            <Link
              href={mapHref}
              className="shrink-0 rounded-[9px] bg-accent px-4 py-2.5 text-[14px] font-semibold text-white hover:opacity-90"
            >
              Open the map
            </Link>
          </div>
        </>
      )}

      <p className="mt-10 border-t border-rule pt-5 text-[12.5px] leading-relaxed text-muted">
        Counts reflect businesses currently in the database — the dataset is incomplete by design
        and grows as sources and submissions land. See the{" "}
        <Link href="/methodology" className="underline underline-offset-2">methodology</Link>.
      </p>
    </div>
  );
}

// Pre-render a static set of states; others fall back to ISR. If the DB is
// not yet migrated at build time, return an empty list and let ISR fill in.
export async function generateStaticParams() {
  try {
    const rows = await db.selectDistinct({ state: locations.state }).from(locations);
    return rows
      .map((r) => {
        const name = STATE_NAME_BY_CODE[r.state];
        if (!name) return null;
        return { state: name.toLowerCase().replace(/\s+/g, "-") };
      })
      .filter((x): x is { state: string } => Boolean(x));
  } catch (err) {
    console.warn("[state] generateStaticParams DB read failed", err);
    return [];
  }
}
