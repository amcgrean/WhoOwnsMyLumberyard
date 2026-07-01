import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, locations, type Trade, type Company } from "@/lib/db/schema";
import {
  STATE_CODE_BY_SLUG,
  STATE_NAME_BY_CODE,
  TRADE_LABELS,
  TRADE_SHORT_LABELS,
  COMPANY_TYPE_LABELS,
} from "@/lib/constants";
import {
  getOwnershipChain,
  classifyOwnership,
  ultimateOwner,
} from "@/lib/ownership-graph";
import { OwnershipBadge } from "@/components/ownership-badge";
import { TradeChip } from "@/components/trade-chip";
import { BizRow } from "@/components/biz-row";
import type { OwnershipBadgeKind } from "@/lib/constants";

export const revalidate = 3600;

type Params = Promise<{ state: string; trade: string }>;

const TRADES = Object.keys(TRADE_LABELS) as Trade[];

function resolve(stateSlug: string, tradeSlug: string) {
  const code = STATE_CODE_BY_SLUG[stateSlug.toLowerCase()];
  const trade = TRADES.includes(tradeSlug as Trade) ? (tradeSlug as Trade) : null;
  if (!code || !trade) return null;
  return { code, name: STATE_NAME_BY_CODE[code], trade };
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
  return {
    title: `${TRADE_SHORT_LABELS[resolved.trade]} companies in ${resolved.name}: who owns them`,
    description: `Which ${TRADE_SHORT_LABELS[resolved.trade]} companies in ${resolved.name} are locally owned and which are owned by private equity — with the ownership chain and sources for each.`,
    alternates: { canonical: `/state/${state}/${trade}` },
  };
}

type Row = {
  location: typeof locations.$inferSelect;
  company: Company;
  badge: OwnershipBadgeKind;
  owner: Company | null;
};

// Short, human ownerLine for a BizRow — the ultimate owner when there is one,
// otherwise a badge-appropriate description of how it's held.
function ownerLine(row: Row): string {
  const { company, badge, owner } = row;
  if (owner && owner.id !== company.id) return `Owned by ${owner.name}`;
  switch (badge) {
    case "independent":
      return "Locally owned";
    case "coop":
      return "Co-op member";
    case "family_mega":
      return "Family-owned";
    case "public":
      return "Publicly traded";
    case "private_equity":
      return "Private-equity-owned";
    default:
      return "Ownership on record";
  }
}

export default async function StateTradePage({ params }: { params: Params }) {
  const { state, trade } = await params;
  const resolved = resolve(state, trade);
  if (!resolved) notFound();

  let base: { location: typeof locations.$inferSelect; company: Company }[] = [];
  try {
    base = await db
      .select({ location: locations, company: companies })
      .from(locations)
      .innerJoin(companies, eq(locations.companyId, companies.id))
      .where(and(eq(locations.state, resolved.code), eq(locations.trade, resolved.trade)))
      .orderBy(locations.city, locations.displayName);
  } catch (err) {
    console.warn("[state-trade] read failed (likely no migrations yet)", err);
  }

  // Classify each distinct operating company once, then map back to rows.
  const chainByCompany = new Map<
    string,
    { badge: OwnershipBadgeKind; owner: Company | null; chainTop: Company | null }
  >();
  for (const companyId of new Set(base.map((r) => r.company.id))) {
    const chain = await getOwnershipChain(companyId);
    chainByCompany.set(companyId, {
      badge: classifyOwnership(chain),
      owner: ultimateOwner(chain),
      chainTop: chain.length > 1 ? chain[chain.length - 1].company : null,
    });
  }
  const rows: Row[] = base.map((r) => ({
    ...r,
    badge: chainByCompany.get(r.company.id)?.badge ?? "unknown",
    owner: chainByCompany.get(r.company.id)?.owner ?? null,
  }));

  const independents = rows.filter((r) => r.badge === "independent");
  const owned = rows.filter((r) => r.badge !== "independent");

  const stateName = resolved.name;
  const tradeShort = TRADE_SHORT_LABELS[resolved.trade];
  const tradeTitle = `Who owns ${stateName}'s ${tradeShort.toLowerCase()} companies?`;

  // Stat pills — real counts off the classified rows.
  const stats: { value: number; label: string; color: string }[] = [
    { value: rows.length, label: "Businesses tracked", color: "var(--color-ink)" },
    { value: independents.length, label: "Locally owned", color: "var(--color-badge-independent)" },
    { value: owned.length, label: "Owned up the chain", color: "var(--color-badge-pe)" },
  ];

  // Lumber-only "consolidators & owners" list: the distinct ultimate owners
  // behind the tracked yards, in the prototype's company-row style.
  const lumberCos: { name: string; typeLabel: string; note: string; badge: OwnershipBadgeKind }[] =
    [];
  if (resolved.trade === "lumber") {
    const seen = new Set<string>();
    for (const r of owned) {
      const info = chainByCompany.get(r.company.id);
      const co = info?.owner ?? info?.chainTop;
      if (!co || seen.has(co.id)) continue;
      seen.add(co.id);
      const count = owned.filter((o) => {
        const oi = chainByCompany.get(o.company.id);
        return (oi?.owner ?? oi?.chainTop)?.id === co.id;
      }).length;
      lumberCos.push({
        name: co.name,
        typeLabel: COMPANY_TYPE_LABELS[co.type],
        note: `${count} tracked ${count === 1 ? "yard" : "yards"} in ${stateName}`,
        badge: r.badge,
      });
    }
    lumberCos.sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <section className="pt-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <TradeChip trade={resolved.trade} />
          <span className="text-[12.5px] text-muted">{stateName}</span>
        </div>

        <h1 className="mt-3 max-w-[18ch] text-balance font-serif font-semibold tracking-tight text-ink text-[clamp(28px,4.5vw,42px)] leading-[1.08]">
          {tradeTitle}
        </h1>

        <div className="mt-4 max-w-[64ch]">
          <p className="mb-3.5 text-[15.5px] leading-[1.65] text-ink">{INTRO[resolved.trade]}</p>
          <p className="mb-3.5 text-[15.5px] leading-[1.65] text-ink">
            Below, {tradeShort.toLowerCase()} businesses tracked in {stateName} are sorted by who
            actually owns them. Independents come first — then the ones held further up the chain,
            with the parent named on each row.
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="mt-6 text-muted">
            No {tradeShort.toLowerCase()} companies tracked in {stateName} yet.{" "}
            <Link href="/submit" className="underline">
              Know one? Submit a tip
            </Link>
            .
          </p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap gap-2.5">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="min-w-[120px] rounded-[12px] border border-rule bg-paper px-4 py-3"
                >
                  <div
                    className="font-serif text-[26px] font-semibold leading-none"
                    style={{ color: s.color }}
                  >
                    {s.value.toLocaleString()}
                  </div>
                  <div className="mt-1.5 text-[12px] leading-[1.4] text-muted">{s.label}</div>
                </div>
              ))}
            </div>

            {independents.length > 0 ? (
              <div
                className="mt-[34px] rounded-[14px] bg-accent-soft p-5"
                style={{
                  border: "1px solid color-mix(in oklch, var(--color-accent) 30%, var(--color-rule))",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <OwnershipBadge kind="independent" />
                  <h2 className="font-serif text-[20px] font-semibold text-ink">
                    Locally owned in {stateName}
                  </h2>
                </div>
                <p className="mb-4 mt-2.5 max-w-[60ch] text-[13.5px] leading-[1.55] text-ink">
                  No private-equity or consolidator parent on the public record — family-owned,
                  employee-owned, or member-owned. These are the ones to call first.
                </p>
                <div className="flex flex-col gap-2">
                  {independents.map((r) => (
                    <BizRow
                      key={r.location.id}
                      href={`/yard/${r.location.slug}`}
                      name={r.location.displayName}
                      city={r.location.city}
                      state={r.location.state}
                      ownerLine={ownerLine(r)}
                      trade={r.location.trade}
                      badge={r.badge}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {owned.length > 0 ? (
              <div className="mt-[26px]">
                <div className="flex items-center gap-2.5">
                  <OwnershipBadge kind="private_equity" />
                  <h2 className="font-serif text-[20px] font-semibold text-ink">
                    Owned further up the chain
                  </h2>
                </div>
                <p className="mb-4 mt-2.5 max-w-[60ch] text-[13.5px] leading-[1.55] text-muted">
                  Still run under the local name, but ultimately controlled by a private-equity
                  fund, consolidator, or public company. Tap any row for the full ownership chain
                  and sources.
                </p>
                <div className="flex flex-col gap-2">
                  {owned.map((r) => (
                    <BizRow
                      key={r.location.id}
                      href={`/yard/${r.location.slug}`}
                      name={r.location.displayName}
                      city={r.location.city}
                      state={r.location.state}
                      ownerLine={ownerLine(r)}
                      trade={r.location.trade}
                      badge={r.badge}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {lumberCos.length > 0 ? (
              <div className="mt-[26px]">
                <div className="flex items-baseline gap-2 border-b border-rule pb-[9px]">
                  <h2 className="font-serif text-[20px] font-semibold text-ink">
                    The consolidators &amp; owners
                  </h2>
                </div>
                <div className="mt-3.5 flex flex-col gap-2">
                  {lumberCos.map((co) => (
                    <div
                      key={co.name}
                      className="flex items-center gap-3.5 rounded-[12px] border border-rule bg-paper px-[15px] py-[13px]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-serif text-[16px] font-semibold leading-[1.25] text-ink">
                          {co.name}
                        </div>
                        <div className="mt-[3px] text-[12.5px] text-muted">
                          {co.typeLabel} &middot; {co.note}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <OwnershipBadge kind={co.badge} size="sm" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}

        <p className="mt-10 text-xs text-muted">
          Ownership reflects the best available public evidence and is sourced on each business
          page. Spotted something wrong?{" "}
          <Link href="/submit" className="underline">
            Submit a source-backed correction
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
