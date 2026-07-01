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
} from "@/lib/constants";
import {
  getOwnershipChain,
  classifyOwnership,
  ultimateOwner,
} from "@/lib/ownership-graph";
import { OwnershipBadge } from "@/components/ownership-badge";
import { TradeChip } from "@/components/trade-chip";
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
  const chainByCompany = new Map<string, { badge: OwnershipBadgeKind; owner: Company | null }>();
  for (const companyId of new Set(base.map((r) => r.company.id))) {
    const chain = await getOwnershipChain(companyId);
    chainByCompany.set(companyId, {
      badge: classifyOwnership(chain),
      owner: ultimateOwner(chain),
    });
  }
  const rows: Row[] = base.map((r) => ({
    ...r,
    badge: chainByCompany.get(r.company.id)?.badge ?? "unknown",
    owner: chainByCompany.get(r.company.id)?.owner ?? null,
  }));

  const independents = rows.filter((r) => r.badge === "independent");
  const owned = rows.filter((r) => r.badge !== "independent");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
          {resolved.name} · {TRADE_LABELS[resolved.trade]}
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl mt-1">
          Who owns {TRADE_SHORT_LABELS[resolved.trade]} companies in {resolved.name}?
        </h1>
        <p className="mt-3 text-[var(--color-muted)] max-w-2xl">{INTRO[resolved.trade]}</p>
      </header>

      {rows.length === 0 ? (
        <p className="text-[var(--color-muted)]">
          No {TRADE_SHORT_LABELS[resolved.trade]} companies tracked in {resolved.name} yet.{" "}
          <Link href="/submit" className="underline">
            Know one? Submit a tip
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-10">
          {independents.length > 0 ? (
            <section>
              <h2 className="font-serif text-xl mb-1">Locally owned &amp; independent</h2>
              <p className="text-sm text-[var(--color-muted)] mb-3">
                No private-equity or out-of-state consolidator owner on the public record.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {independents.map((r) => (
                  <BusinessRow key={r.location.id} row={r} />
                ))}
              </div>
            </section>
          ) : null}

          {owned.length > 0 ? (
            <section>
              <h2 className="font-serif text-xl mb-1">Owned by a larger company</h2>
              <p className="text-sm text-[var(--color-muted)] mb-3">
                Operating under the local name, but owned further up the chain — often by
                a private-equity-backed platform.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {owned.map((r) => (
                  <BusinessRow key={r.location.id} row={r} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <p className="mt-10 text-xs text-[var(--color-muted)]">
        Ownership reflects the best available public evidence and is sourced on each
        business page. Spotted something wrong?{" "}
        <Link href="/submit" className="underline">
          Submit a source-backed correction
        </Link>
        .
      </p>
    </div>
  );
}

function BusinessRow({ row }: { row: Row }) {
  const { location, company, badge, owner } = row;
  return (
    <Link
      href={`/yard/${location.slug}`}
      className="block rounded-md border border-[var(--color-rule)] p-4 hover:border-[var(--color-accent)] transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-serif text-base">{location.displayName}</div>
        <TradeChip trade={location.trade} className="mt-0.5 shrink-0" />
      </div>
      <div className="mt-1 text-sm text-[var(--color-muted)]">
        {location.city}, {location.state}
      </div>
      <div className="mt-2">
        <OwnershipBadge
          kind={badge}
          label={owner && owner.id !== company.id ? `Owned by ${owner.name}` : undefined}
        />
      </div>
    </Link>
  );
}
