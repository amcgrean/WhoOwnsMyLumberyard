import Link from "next/link";
import type { Metadata } from "next";
import { searchAll, type SearchResult } from "@/lib/search";
import { COMPANY_TYPE_LABELS, TRADE_SHORT_LABELS } from "@/lib/constants";
import { TradeChip } from "@/components/trade-chip";
import type { Trade } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Search",
  description: "Search businesses, companies, and owners.",
};

type SearchParams = Promise<{ q?: string; trade?: string }>;

const TRADES = Object.keys(TRADE_SHORT_LABELS) as Trade[];

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const { q, trade } = await searchParams;
  const activeTrade = TRADES.includes(trade as Trade) ? (trade as Trade) : null;
  const results = q ? await searchAll(q, 50) : [];
  const grouped = groupByKind(results);
  const locations = activeTrade
    ? grouped.location.filter((r) => r.trade === activeTrade)
    : grouped.location;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-3xl mb-6">Search</h1>
      {!q ? (
        <p className="text-[var(--color-muted)]">
          Type a zip, business name, or city in the search bar above.
        </p>
      ) : results.length === 0 ? (
        <p className="text-[var(--color-muted)]">
          No matches for <strong>{q}</strong>. Try a city or a business name.
        </p>
      ) : (
        <div className="space-y-8">
          {grouped.location.length > 0 ? (
            <TradeFilter q={q} active={activeTrade} />
          ) : null}

          {locations.length > 0 ? (
            <section>
              <h2 className="font-serif text-xl mb-3">Businesses</h2>
              <ul className="space-y-2">
                {locations.map((r) => (
                  <li key={`l-${r.id}`}>
                    <Link
                      href={`/yard/${r.slug}`}
                      className="block rounded-md border border-[var(--color-rule)] p-3 hover:border-[var(--color-accent)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-serif">{r.displayName}</div>
                        <TradeChip trade={r.trade} className="mt-0.5 shrink-0" />
                      </div>
                      <div className="text-xs text-[var(--color-muted)]">
                        {r.city}, {r.state} {r.zip}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : activeTrade ? (
            <p className="text-sm text-[var(--color-muted)]">
              No {TRADE_SHORT_LABELS[activeTrade]} businesses in these results.
            </p>
          ) : null}

          {grouped.company.length > 0 ? (
            <section>
              <h2 className="font-serif text-xl mb-3">Companies & owners</h2>
              <ul className="space-y-2">
                {grouped.company.map((r) => {
                  const linkBase =
                    r.type === "pe_firm" || r.type === "public_company" || r.type === "family_office"
                      ? "/owner"
                      : "/company";
                  return (
                    <li key={`c-${r.id}`}>
                      <Link
                        href={`${linkBase}/${r.slug}`}
                        className="block rounded-md border border-[var(--color-rule)] p-3 hover:border-[var(--color-accent)]"
                      >
                        <div className="font-serif">{r.name}</div>
                        <div className="text-xs text-[var(--color-muted)]">
                          {COMPANY_TYPE_LABELS[r.type as keyof typeof COMPANY_TYPE_LABELS] ?? r.type}
                          {r.description ? ` — ${r.description.slice(0, 120)}` : ""}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function TradeFilter({ q, active }: { q: string; active: Trade | null }) {
  const base = "rounded-full px-3 py-1 text-xs ring-1 transition-colors";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-[var(--color-muted)]">Filter:</span>
      <Link
        href={`/search?q=${encodeURIComponent(q)}`}
        className={
          base +
          (active === null
            ? " bg-[var(--color-ink)] text-[var(--color-paper)] ring-transparent"
            : " ring-[var(--color-rule)] hover:border-[var(--color-accent)]")
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
              ? " bg-[var(--color-ink)] text-[var(--color-paper)] ring-transparent"
              : " ring-[var(--color-rule)] hover:border-[var(--color-accent)]")
          }
        >
          {TRADE_SHORT_LABELS[t]}
        </Link>
      ))}
    </div>
  );
}

function groupByKind(rows: SearchResult[]) {
  const out = { location: [] as Extract<SearchResult, { kind: "location" }>[], company: [] as Extract<SearchResult, { kind: "company" }>[] };
  for (const r of rows) {
    if (r.kind === "location") out.location.push(r);
    else out.company.push(r);
  }
  return out;
}
