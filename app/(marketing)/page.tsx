import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, locations, ownershipEdges, type Trade } from "@/lib/db/schema";
import { SearchBar } from "@/components/search-bar";
import { TradeChip } from "@/components/trade-chip";

export const revalidate = 600; // 10 minutes

async function getStats() {
  // Build runs before migrations may have been applied. Wrap each query so a
  // missing table degrades to zero rather than crashing the whole render.
  try {
    const [yardRow] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(locations);
    const totalYards = yardRow?.count ?? 0;

    // % consolidated = locations whose operating company has any active parent edge
    const [consolidatedRow] = await db
      .select({ count: sql<number>`cast(count(distinct ${locations.id}) as int)` })
      .from(locations)
      .innerJoin(ownershipEdges, sql`${ownershipEdges.childId} = ${locations.companyId} AND ${ownershipEdges.endDate} IS NULL AND ${ownershipEdges.relationship} NOT IN ('member_of', 'franchise_of')`);
    const consolidatedYards = consolidatedRow?.count ?? 0;

    const [peRow] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(companies)
      .where(sql`${companies.type} IN ('pe_firm','family_office')`);
    const peFirms = peRow?.count ?? 0;

    return {
      totalYards,
      consolidatedYards,
      peFirms,
      pctConsolidated: totalYards > 0 ? Math.round((consolidatedYards / totalYards) * 100) : 0,
    };
  } catch (err) {
    console.warn("[home] getStats failed (likely no migrations yet)", err);
    return { totalYards: 0, consolidatedYards: 0, peFirms: 0, pctConsolidated: 0 };
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

        <div className="mt-[38px] grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          <Stat
            value={stats.totalYards.toLocaleString()}
            label="Iowa businesses tracked"
            color="var(--color-ink)"
          />
          <Stat
            value={`${stats.pctConsolidated}%`}
            label="Under consolidator or private-equity ownership"
            color="var(--color-badge-pe)"
          />
          <Stat
            value={stats.peFirms.toLocaleString()}
            label="Distinct PE & family-office owners on the record"
            color="var(--color-accent)"
          />
        </div>
        <div className="mt-3 text-[12px] text-[var(--color-muted)]">
          Iowa dataset · last updated April 2025 ·{" "}
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
            <TradeCard key={t.trade} {...t} />
          ))}
        </div>
      </section>
    </div>
  );
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
}: {
  trade: Trade;
  title: string;
  blurb: string;
  stat: string;
}) {
  return (
    <Link
      href={`/state/iowa/${trade}`}
      className="flex min-h-[150px] flex-col gap-3.5 rounded-[14px] border border-[var(--color-rule)] bg-[var(--color-paper)] p-[18px] transition hover:-translate-y-0.5 hover:border-[color-mix(in_oklch,var(--color-accent)_45%,var(--color-rule))] hover:shadow-[0_10px_26px_-18px_rgba(30,30,20,0.55)]"
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
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-dashed border-[var(--color-rule)] pt-2">
        <span className="text-[12.5px] text-[var(--color-muted)]">{stat}</span>
        <span className="text-[18px] font-semibold text-[var(--color-accent)]">→</span>
      </div>
    </Link>
  );
}
