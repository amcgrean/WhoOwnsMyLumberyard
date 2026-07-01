import type { Metadata } from "next";
import Link from "next/link";
import { NationalMap } from "@/components/map/national-map";
import { getMapTableRows } from "@/lib/queries/map-table";

export const metadata: Metadata = {
  title: "National map",
  description:
    "Every tracked lumberyard, plumber, electrician, and HVAC company, color-coded by ownership type. Click a marker to see the operating brand and ultimate owner.",
};

export default async function MapPage() {
  const rows = await getMapTableRows(500);

  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-2">
        <h1 className="font-serif text-2xl">National map</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Click a cluster to zoom in. Click a marker for the ownership chain.
        </p>
      </div>
      <NationalMap />

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-xl">Businesses table view</h2>
          <p className="text-xs text-[var(--color-muted)]">
            Showing first {rows.length.toLocaleString()} geocoded businesses (A–Z by state/city/name).
          </p>
        </div>

        <div className="mt-3 overflow-x-auto rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--color-muted-bg)] text-xs uppercase tracking-wide text-[var(--color-muted)]">
              <tr>
                <th className="px-3 py-2">Business</th>
                <th className="px-3 py-2">Operating company</th>
                <th className="px-3 py-2">City</th>
                <th className="px-3 py-2">State</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.slug} className="border-t border-[var(--color-rule)]">
                  <td className="px-3 py-2">
                    <Link href={`/yard/${row.slug}`} className="underline">
                      {row.displayName}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{row.companyName}</td>
                  <td className="px-3 py-2">{row.city}</td>
                  <td className="px-3 py-2">{row.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
