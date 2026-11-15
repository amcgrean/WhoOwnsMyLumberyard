import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, locations, ownershipEdges, type Trade } from "@/lib/db/schema";
import { SearchBar } from "@/components/search-bar";
import { TradeChip } from "@/components/trade-chip";
import { ownershipSelect, kindFromRow } from "@/lib/ownership-sql";
import { isChainOwned, isLocallyOwned } from "@/lib/ownership-kind";

export const revalidate = 600; // 10 minutes

type TradeCount = { total: number; chain: number };

async function getStats() {
  const empty = {
    iowaTotal: 0,
    iowaLocal: 0,
    iowaChain: 0,
    nationalTotal: 0,
    statesCovered: 0,
    peFirms: 0,
    lastUpdated: null as Date | null,
    byTrade: {} as Partial<Record<Trade, TradeCount>>,
  };
  // Degrade to zeros if the DB is unreachable or mid-migration at build time.
  try {
    // Iowa: classify every location the same way the map and detail pages do.
    const iowa = await db
      .select({
        trade: locations.trade,
        companySlug: companies.slug,
        companyType: companies.type,
        ...ownershipSelect(companies.id),
      })
      .from(locations)
      .innerJoin(companies, eq(locations.companyId, companies.id))
      .where(eq(locations.state, "IA"));

    const byTrade: Partial<Record<Trade, TradeCount>> = {};
    let iowaLocal = 0;
    let iowaChain = 0;
    for (const r of iowa) {
      const kind = kindFromRow(r);
      const chain = isChainOwned(kind);
      if (chain) iowaChain++;
      if (isLocallyOwned(kind)) iowaLocal++;
      if (r.trade) {
        const t = (byTrade[r.trade] ??= { total: 0, chain: 0 });
        t.total++;
        if (chain) t.chain++;
      }
    }

    const [national] = await db
      .select({
        total: sql<number>`cast(count(*) as int)`,
        states: sql<number>`cast(count(distinct ${locations.state}) as int)`,
        updated: sql<string | null>`max(${locations.updatedAt})`,
      })
      .from(locations);
    const [edges] = await db
      .select({ updated: sql<string | null>`max(${ownershipEdges.updatedAt})` })
      .from(ownershipEdges);
    const [pe] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(companies)
      .where(eq(companies.type, "pe_firm"));

    const stamps = [national?.updated, edges?.updated]
      .filter((x): x is string => Boolean(x))
      .map((x) => new Date(x).getTime());

    return {
      iowaTotal: iowa.length,
      iowaLocal,
      iowaChain,
      nationalTotal: national?.total ?? 0,
      statesCovered: national?.states ?? 0,
      peFirms: pe?.count ?? 0,
      lastUpdated: stamps.length ? new Date(Math.max(...stamps)) : null,
      byTrade,
    };
  } catch (err) {
    console.warn("[home] getStats failed (likely no migrations yet)", err);
    return empty;
  }
}

// Trade cards for the "Browse Iowa by trade" section. Each links to the existing
// /state/iowa/[trade] landing route.
const TRADE_CARDS: ReadonlyArray<{ trade: Trade; title: string; blurb: string; stat: string }> = [
  {
    trade: "hvac",
    title: "HVAC",
    blurb:
      "Heating and cooling companies — the trade private-equity roll-ups have moved into hardest across Iowa.",
    stat: "Who really owns the name on the truck",
  },
  {
    trade: "plumbing",
    title: "Plumbing",
    blurb:
      "Plumbers and drain companies, from family-owned shops to consolidator-backed brands.",
    stat: "Locally owned vs. rolled up",
  },
  {
    trade: "electrical",
    title: "Electrical",
    blurb:
      "Electrical contractors and repair companies — trace each back to its ultimate owner.",
    stat: "Independent, ESOP, or PE-backed",
  },
  {
    trade: "lumber",
    title: "Lumber & Building Materials",
    blurb:
      "Lumberyards and building-materials dealers behind the local storefront and buying-group signage.",
    stat: "Distributor, co-op, or consolidator",
  },
];

export default async function HomePage() {
  const stats = await getStats();
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <section className="pt-14">
        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)]">
          Iowa · Public ownership records
        </div>
        <h1 className="mt-3 max-w-[16ch] text-balance font-serif font-semibold leading-[1.05] tracking-tight text-[clamp(30px,5vw,52px)]">
          The name on the truck is local. The owner might not be.
        </h1>
        <p className="mt-[18px] max-w-[60ch] leading-[1.6] text-[var(--color-muted)] text-[clamp(15px,2vw,18px)]">
          Across Iowa, private-equity funds are quietly rolling up the plumbers,
          electricians, HVAC companies, and lumberyards you already know — and keeping
          the familiar name on the sign. We map who really owns them, with every link
          sourced, so you can choose a locally-owned business on purpose.
        </p>

        <div className="mt-[26px] max-w-[620px]">
          <SearchBar variant="hero" />
        </div>
        <div className="mt-2.5 text-[12.5px] text-[var(--color-muted)]">
          Try{" "}
          <Link
            href="/search?q=Schaal"
            className="text-[var(--color-accent)] underline underline-offset-2"
          >
            Schaal Heating &amp; Cooling
          </Link>
          ,{" "}
          <Link
            href="/search?q=Golden%20Rule"
            className="text-[var(--color-accent)] underline underline-offset-2"
          >
            Golden Rule
          </Link>
          , or{" "}
          <Link
            href="/map"
            className="text-[var(--color-accent)] underline underline-offset-2"
          >
            the map
          </Link>
          .
        </div>

        <div className="mt-[38px] grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            value={stats.iowaTotal.toLocaleString()}
            label="Iowa businesses tracked"
            color="var(--color-ink)"
          />
          <Stat
            value={`${pct(stats.iowaChain, stats.iowaTotal)}%`}
            label="of them owned up a chain — private equity, public, or national"
            color="var(--color-badge-pe)"
          />
          <Stat
            value={stats.iowaLocal.toLocaleString()}
            label="Iowa businesses locally owned on the public record"
            color="var(--color-badge-independent)"
          />
          <Stat
            value={stats.nationalTotal.toLocaleString()}
            label={`tracked nationwide across ${stats.statesCovered} ${stats.statesCovered === 1 ? "state" : "states"}`}
            color="var(--color-accent)"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-1.5 text-[12px] text-[var(--color-muted)]">
          {stats.lastUpdated ? (
            <span>
              Updated{" "}
              {stats.lastUpdated.toLocaleDateString("en-US", { month: "long", year: "numeric" })}{" "}
              ·
            </span>
          ) : null}
          <span>{stats.peFirms.toLocaleString()} private-equity owners on the record ·</span>
          <Link
            href="/methodology"
            className="text-[var(--color-accent)] underline underline-offset-2"
          >
            methodology &amp; sources
          </Link>
        </div>
      </section>

      <section className="mt-[52px] border-t border-[var(--color-rule)] pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="m-0 font-serif text-[24px] font-semibold tracking-tight">
            Browse Iowa by trade
          </h2>
          <Link
            href="/map"
            className="text-sm font-semibold text-[var(--color-accent)]"
          >
            Open the full map →
          </Link>
        </div>
        <div className="mt-5 grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
          {TRADE_CARDS.map((t) => (
            <TradeCard key={t.trade} {...t} counts={stats.byTrade[t.trade]} />
          ))}
        </div>
      </section>
    </div>
  );
}

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="rounded-[14px] border border-[var(--color-rule)] bg-[var(--color-paper)] p-5">
      <div
        className="font-serif text-[40px] font-semibold leading-none tracking-tight"
        style={{ color }}
      >
        {value}
      </div>
      <div className="mt-2.5 text-[13.5px] leading-[1.45] text-[var(--color-muted)]">
        {label}
      </div>
    </div>
  );
}

function TradeCard({
  trade,
  title,
  blurb,
  stat,
  counts,
}: {
  trade: Trade;
  title: string;
  blurb: string;
  stat: string;
  counts?: TradeCount;
}) {
  return (
    <Link
      href={`/state/iowa/${trade}`}
      className="group flex min-h-[150px] flex-col gap-3.5 rounded-[14px] border border-[var(--color-rule)] bg-[var(--color-paper)] p-[18px] transition hover:-translate-y-0.5 hover:border-[color-mix(in_oklch,var(--color-accent)_45%,var(--color-rule))] hover:shadow-[0_10px_26px_-18px_rgba(30,30,20,0.55)]"
    >
      <div>
        <TradeChip trade={trade} />
      </div>
      <div className="mt-0.5 font-serif text-[19px] font-semibold leading-[1.2]">
        {title}
      </div>
      <div className="-mt-1 text-[13px] leading-[1.5] text-[var(--color-muted)]">
        {blurb}
      </div>
      <div className="mt-auto flex min-h-[44px] items-center justify-between gap-2 border-t border-dashed border-[var(--color-rule)] pt-2.5">
        <span className="text-[12.5px] leading-snug text-[var(--color-muted)]">
          {counts && counts.total > 0 ? (
            <>
              <span className="font-semibold text-[var(--color-ink)]">
                {counts.total.toLocaleString()}
              </span>{" "}
              tracked ·{" "}
              <span className="font-semibold text-[var(--color-badge-pe)]">
                {counts.chain.toLocaleString()}
              </span>{" "}
              chain-owned
            </>
          ) : (
            stat
          )}
        </span>
        <span className="text-[18px] font-semibold text-[var(--color-accent)] transition-transform group-hover:translate-x-0.5">
          &rarr;
        </span>
      </div>
    </Link>
  );
}
