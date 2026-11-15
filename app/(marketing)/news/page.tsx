import Link from "next/link";
import type { Metadata } from "next";
import type { Trade } from "@/lib/db/schema";
import { TRADE_SHORT_LABELS } from "@/lib/constants";
import { getNews, type NewsItem } from "@/lib/news";
import { OwnershipBadge } from "@/components/ownership-badge";
import { TradeChip } from "@/components/trade-chip";
import { cn } from "@/lib/utils";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "In the news: who's buying the trades",
  description:
    "Acquisitions of lumberyards and plumbing, electrical, and HVAC companies since 2025: who bought whom, when, and links to the coverage.",
  alternates: { canonical: "/news" },
};

const TRADES = Object.keys(TRADE_SHORT_LABELS) as Trade[];

type Search = Promise<{ trade?: string; iowa?: string }>;

function fmtDay(iso: string | null): string {
  if (!iso) return "";
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function fmtMonth(iso: string): string {
  return new Date(`${iso.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B`;
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`;
  return `$${n.toLocaleString("en-US")}`;
}

/** What the buyer is, in words: "Private-equity firm", "Owned by Bain Capital"... */
function buyerLabel(n: NewsItem): string | undefined {
  if (n.acquirer.ownerName) return `Buyer owned by ${n.acquirer.ownerName}`;
  if (n.acquirer.type === "pe_firm") return "Private-equity firm";
  if (n.acquirer.type === "public_company") return "Public company";
  if (n.acquirer.kind === "family_mega") return "Large private company";
  if (n.acquirer.kind === "independent") return "Independently owned buyer";
  return undefined;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function filterHref(trade: string | undefined, iowa: boolean): string {
  const p = new URLSearchParams();
  if (trade) p.set("trade", trade);
  if (iowa) p.set("iowa", "1");
  const q = p.toString();
  return q ? `/news?${q}` : "/news";
}

export default async function NewsPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const trade = TRADES.includes(sp.trade as Trade) ? (sp.trade as Trade) : undefined;
  const iowa = sp.iowa === "1";

  let all: NewsItem[] = [];
  try {
    all = await getNews();
  } catch (err) {
    console.warn("[news] DB read failed", err);
  }
  const items = all.filter((n) => (!trade || n.target.trade === trade) && (!iowa || n.iowa));
  const iowaCount = all.filter((n) => n.iowa).length;

  const months: Array<{ key: string; items: NewsItem[] }> = [];
  for (const n of items) {
    const key = n.date.slice(0, 7);
    const last = months[months.length - 1];
    if (last?.key === key) last.items.push(n);
    else months.push({ key, items: [n] });
  }

  const pill = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-[13px] font-medium transition-colors",
      active ? "border-ink bg-ink text-paper" : "border-rule bg-paper text-ink hover:border-ink/40",
    );

  return (
    <div className="mx-auto max-w-[860px] px-5 py-10">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">In the news</p>
        <h1 className="mt-2 font-serif text-[34px] font-semibold leading-tight sm:text-[42px]">Who&rsquo;s buying the trades</h1>
        <p className="mt-3 max-w-2xl text-[16px] text-muted">
          {`Acquisitions of lumberyards and plumbing, electrical, and HVAC companies since 2025: ${all.length} deals, ${iowaCount} touching Iowa.`}{" "}
          Each one links to the press release or news coverage it&rsquo;s based on.
        </p>
      </header>

      <nav aria-label="Filter news" className="mb-8 flex flex-wrap items-center gap-2">
        <Link href={filterHref(undefined, iowa)} className={pill(!trade)}>All trades</Link>
        {TRADES.map((t) => (
          <Link key={t} href={filterHref(t, iowa)} className={pill(trade === t)}>
            {t === "hvac" ? "HVAC" : TRADE_SHORT_LABELS[t]}
          </Link>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-rule sm:inline-block" aria-hidden />
        <Link href={filterHref(trade, !iowa)} className={pill(iowa)} aria-pressed={iowa}>
          Iowa only
        </Link>
      </nav>

      {months.length === 0 ? (
        <p className="rounded-xl border border-rule bg-paper px-5 py-8 text-center text-muted">
          No acquisitions match these filters yet. <Link href="/news" className="text-accent underline">Show all</Link>
        </p>
      ) : (
        <div className="space-y-10">
          {months.map((m) => (
            <section key={m.key} aria-labelledby={`m-${m.key}`}>
              <h2 id={`m-${m.key}`} className="mb-3 border-b border-rule pb-2 font-serif text-[20px] font-semibold">
                {fmtMonth(m.key)}
              </h2>
              <ol className="space-y-3">
                {m.items.map((n) => (
                  <li key={n.slug} className="rounded-xl border border-rule bg-paper px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
                      <time dateTime={n.date}>{fmtDay(n.date)}</time>
                      <span aria-hidden>·</span>
                      <span>{n.closedDate ? "Closed" : "Announced"}</span>
                      {n.dealValueUsd ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>{fmtUsd(n.dealValueUsd)}</span>
                        </>
                      ) : null}
                      <TradeChip trade={n.target.trade} className="ml-auto" />
                      {n.iowa ? (
                        <span className="rounded-full border border-accent/40 px-2 py-[1px] text-[11.5px] font-semibold text-accent">Iowa</span>
                      ) : null}
                    </div>
                    <h3 className="mt-1.5 font-serif text-[19px] font-semibold leading-snug">
                      <Link href={`/owner/${n.acquirer.slug}`} className="hover:text-accent">{n.acquirer.name}</Link>{" "}
                      <span className="font-normal text-muted">{n.closedDate ? "acquires" : "agrees to acquire"}</span>{" "}
                      <Link href={`/company/${n.target.slug}`} className="hover:text-accent">{n.target.name}</Link>
                    </h3>
                    {n.summary ? <p className="mt-1.5 text-[15px] leading-relaxed text-ink/85">{n.summary}</p> : null}
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                      <OwnershipBadge kind={n.acquirer.kind} size="sm" label={buyerLabel(n)} />
                      {n.target.city ? (
                        <span className="text-[13px] text-muted">
                          {n.target.name} is based in {n.target.city}
                          {n.target.state ? `, ${n.target.state}` : ""}
                        </span>
                      ) : null}
                    </div>
                    {n.sources.length ? (
                      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-rule pt-2.5 text-[13px]">
                        {n.sources.map((s) => (
                          <li key={s.url}>
                            <a href={s.url} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
                              {s.publication || hostOf(s.url)} ↗
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      <p className="mt-12 text-[13px] text-muted">
        Know of a deal we&rsquo;re missing? <Link href="/submit" className="text-accent underline">Send us a tip</Link>. How we source and
        classify ownership is on the <Link href="/methodology" className="text-accent underline">methodology</Link> page.
      </p>
    </div>
  );
}
