import type { Metadata } from "next";
import { NationalMap } from "@/components/map/national-map";
import { BizRow } from "@/components/biz-row";
import { getMapTableRows } from "@/lib/queries/map-table";

export const metadata: Metadata = {
  title: "National map",
  description:
    "Every tracked lumberyard, plumber, electrician, and HVAC company, color-coded by ownership type. Click a marker to see the operating brand and ultimate owner.",
};

export default async function MapPage() {
  // Tolerant of a build that runs before a new migration (e.g. the `trade`
  // column) has been applied — degrade to an empty table rather than failing.
  let rows: Awaited<ReturnType<typeof getMapTableRows>> = [];
  try {
    rows = await getMapTableRows(500);
  } catch (err) {
    console.warn("[map] table read failed (likely no migrations yet)", err);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 pb-12">
      <section className="pt-4">
        <h1 className="m-0 font-serif text-[clamp(26px,4vw,38px)] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
          National map: who owns your trades
        </h1>
        <p className="mt-[10px] max-w-[62ch] text-sm leading-[1.55] text-muted">
          Each pin is a tracked business, colored by who owns it. Filter by
          trade, or show only businesses owned by a private-equity firm or
          consolidator.
        </p>
      </section>

      <NationalMap />

      <section className="mt-[30px]">
        <div className="flex flex-wrap items-baseline justify-between gap-[10px] border-b border-rule pb-[10px]">
          <h2 className="m-0 font-serif text-[20px] font-semibold text-ink">
            Results
          </h2>
          <span className="text-[13px] text-muted">
            Showing first {rows.length.toLocaleString()} geocoded businesses
            (A–Z by state/city/name)
          </span>
        </div>

        <div className="mt-[14px] flex flex-col gap-2">
          {rows.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-rule px-7 py-7 text-center text-[13.5px] text-muted">
              No businesses match these filters.
            </div>
          ) : (
            rows.map((row) => (
              <BizRow
                key={row.slug}
                href={`/yard/${row.slug}`}
                name={row.displayName}
                city={row.city}
                state={row.state}
                trade={row.trade}
                ownerLine={
                  row.ownerName
                    ? `Owned by ${row.ownerName}`
                    : row.companyName
                }
                badge={row.ownerName ? "private_equity" : "independent"}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
