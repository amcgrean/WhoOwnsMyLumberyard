import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { eq, inArray, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, locations, ownershipEdges, type Trade } from "@/lib/db/schema";
import { LocationCard } from "@/components/location-card";
import { STATE_CODE_BY_SLUG, STATE_NAME_BY_CODE, TRADE_SHORT_LABELS } from "@/lib/constants";

export const revalidate = 600;

type Params = Promise<{ state: string }>;

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
    title: `Tracked businesses in ${resolved.name}`,
    description: `Every tracked lumberyard, plumber, electrician, and HVAC company in ${resolved.name}, with ownership for each.`,
    alternates: { canonical: `/state/${state}` },
  };
}

export default async function StatePage({ params }: { params: Params }) {
  const { state } = await params;
  const resolved = resolveState(state);
  if (!resolved) notFound();

  // Selects full location/company rows. During a build that runs before a
  // new migration has been applied (e.g. the `trade` column), this query can
  // reference a column that doesn't exist yet — degrade to empty rather than
  // failing the whole build, matching the home page and sitemap.
  let yardRows: { location: typeof locations.$inferSelect; company: typeof companies.$inferSelect }[] = [];
  try {
    yardRows = await db
      .select({
        location: locations,
        company: companies,
      })
      .from(locations)
      .innerJoin(companies, eq(locations.companyId, companies.id))
      .where(eq(locations.state, resolved.code))
      .orderBy(locations.city, locations.displayName);
  } catch (err) {
    console.warn("[state] location read failed (likely no migrations yet)", err);
  }

  const total = yardRows.length;

  // Trades present in this state, in canonical order — for the "by trade" nav.
  const present = new Set(yardRows.map((r) => r.location.trade).filter(Boolean));
  const tradesPresent = (Object.keys(TRADE_SHORT_LABELS) as Trade[]).filter((t) =>
    present.has(t)
  );

  // % consolidated: yards whose operating company has an active parent edge
  const operatingIds = [...new Set(yardRows.map((r) => r.company.id))];
  const consolidatedSet = new Set<string>();
  if (operatingIds.length) {
    const edges = await db.query.ownershipEdges.findMany({
      where: and(inArray(ownershipEdges.childId, operatingIds), isNull(ownershipEdges.endDate)),
      columns: { childId: true },
    });
    for (const e of edges) consolidatedSet.add(e.childId);
  }
  const consolidatedYards = yardRows.filter((r) => consolidatedSet.has(r.company.id)).length;
  const pctConsolidated = total > 0 ? Math.round((consolidatedYards / total) * 100) : 0;

  // Top 5 owners by yard count in this state — owner = ultimate parent of operating company.
  // For v1 we approximate with the operating company itself, which is what readers expect on a
  // state list ("yards branded as X, Y, Z").
  const ownerCounts = new Map<string, { name: string; slug: string; count: number }>();
  for (const r of yardRows) {
    const key = r.company.id;
    const cur = ownerCounts.get(key);
    if (cur) cur.count += 1;
    else ownerCounts.set(key, { name: r.company.name, slug: r.company.slug, count: 1 });
  }
  const topOwners = [...ownerCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6">
        <h1 className="font-serif text-3xl sm:text-4xl">Tracked businesses in {resolved.name}</h1>
        <p className="mt-2 text-[var(--color-muted)]">
          {total.toLocaleString()} tracked · {pctConsolidated}% under consolidator ownership
        </p>
        {tradesPresent.length > 0 ? (
          <nav className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs text-[var(--color-muted)]">By trade:</span>
            {tradesPresent.map((t) => (
              <Link
                key={t}
                href={`/state/${state}/${t}`}
                className="rounded-full px-3 py-1 ring-1 ring-[var(--color-rule)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              >
                {TRADE_SHORT_LABELS[t]}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>

      {topOwners.length > 0 ? (
        <section className="mb-10">
          <h2 className="font-serif text-xl mb-3">Top operators in {resolved.name}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {topOwners.map((o) => (
              <li key={o.slug}>
                <Link
                  href={`/company/${o.slug}`}
                  className="flex justify-between border-b border-[var(--color-rule)] py-1.5 text-sm hover:text-[var(--color-accent)]"
                >
                  <span>{o.name}</span>
                  <span className="text-[var(--color-muted)]">{o.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="font-serif text-xl mb-3">All businesses</h2>
        {total === 0 ? (
          <p className="text-[var(--color-muted)]">
            No businesses tracked here yet. If you operate or know one,{" "}
            <Link href="/submit" className="underline">
              submit a tip
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {yardRows.map(({ location, company }) => (
              <LocationCard
                key={location.id}
                location={{ ...location, companyName: company.name }}
              />
            ))}
          </div>
        )}
      </section>

      <p className="mt-8 text-xs text-[var(--color-muted)]">
        Counts reflect businesses currently in the database — the dataset is incomplete by
        design, expanding as scrapers and submissions land. See the{" "}
        <Link href="/methodology" className="underline">
          methodology
        </Link>{" "}
        for details.
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
