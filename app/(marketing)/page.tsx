import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, locations, ownershipEdges } from "@/lib/db/schema";
import { SearchBar } from "@/components/search-bar";
import { SITE_TAGLINE } from "@/lib/constants";

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
      .innerJoin(ownershipEdges, sql`${ownershipEdges.childId} = ${locations.companyId} AND ${ownershipEdges.endDate} IS NULL`);
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

export default async function HomePage() {
  const stats = await getStats();
  return (
    <div>
      <section className="mx-auto max-w-3xl px-4 pt-16 pb-10 text-center">
        <h1 className="font-serif text-4xl sm:text-5xl tracking-tight">
          Who owns my lumberyard?
        </h1>
        <p className="mt-4 text-[var(--color-muted)] text-lg">{SITE_TAGLINE}</p>
        <p className="mt-2 text-[var(--color-muted)] max-w-xl mx-auto text-sm">
          Search any lumberyard or building-materials dealer in the United States and trace
          the ownership chain — from the brand on the sign to the ultimate owner.
        </p>
        <div className="mt-8">
          <SearchBar />
        </div>
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          Try a zip code, a business name, or a city.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-4 grid gap-4 sm:grid-cols-3 mb-12">
        <Stat label="Yards tracked" value={stats.totalYards.toLocaleString()} />
        <Stat label="Under consolidator ownership" value={`${stats.pctConsolidated}%`} />
        <Stat label="Distinct PE & family-office owners" value={stats.peFirms.toLocaleString()} />
      </section>

      <section className="mx-auto max-w-5xl px-4 mb-16">
        <h2 className="font-serif text-2xl mb-4">Featured</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FeatureCard
            href="/map"
            title="National map"
            blurb="Every tracked yard, color-coded by ownership type."
          />
          <FeatureCard
            href="/methodology"
            title="Methodology"
            blurb="How ownership is verified, what 'verified' means, what's still missing."
          />
          <FeatureCard
            href="/about"
            title="About"
            blurb="Who runs this site, why it exists, and how to contribute."
          />
          <FeatureCard
            href="/submit"
            title="Submit a tip"
            blurb="Know an ownership detail we don't? Send a source-backed correction."
          />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-rule)] p-5">
      <div className="font-serif text-3xl">{value}</div>
      <div className="mt-1 text-sm text-[var(--color-muted)]">{label}</div>
    </div>
  );
}

function FeatureCard({ href, title, blurb }: { href: string; title: string; blurb: string }) {
  return (
    <Link
      href={href}
      className="block rounded-md border border-[var(--color-rule)] p-5 hover:border-[var(--color-accent)] transition-colors"
    >
      <div className="font-serif text-lg">{title}</div>
      <div className="mt-1 text-sm text-[var(--color-muted)]">{blurb}</div>
    </Link>
  );
}
