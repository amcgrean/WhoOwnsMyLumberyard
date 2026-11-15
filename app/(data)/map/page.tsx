import type { Metadata } from "next";
import { MapExplorer } from "@/components/map/map-explorer";
import { STATE_NAME_BY_CODE, TRADE_SHORT_LABELS } from "@/lib/constants";
import type { Trade } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Map",
  description:
    "Every tracked lumberyard, plumber, electrician, and HVAC company, color-coded by who owns it. Filter by state, trade, and ownership; click a pin for the ownership chain and sources.",
};

type SearchParams = Promise<{ state?: string; trade?: string }>;

export default async function MapPage({ searchParams }: { searchParams: SearchParams }) {
  const { state, trade } = await searchParams;
  // ?state=XX (two-letter) or ?state=all; default Iowa.
  const s = state?.toUpperCase();
  const initialState = s === "ALL" ? "" : s && STATE_NAME_BY_CODE[s] ? s : undefined;
  const initialTrade = trade && trade in TRADE_SHORT_LABELS ? (trade as Trade) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-14 pt-4">
      <section className="pt-4">
        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">
          Interactive map
        </div>
        <h1 className="mt-2 font-serif text-[clamp(28px,4vw,40px)] font-semibold leading-[1.08] tracking-[-0.02em] text-ink">
          Who owns the trades near you
        </h1>
        <p className="mt-3 max-w-[64ch] text-[15px] leading-[1.6] text-muted">
          Every pin is a tracked business, colored by who ultimately owns it. Pick
          a state, narrow by trade, or show only the locally-owned shops — then
          tap a pin for the full ownership chain and its sources.
        </p>
      </section>

      <MapExplorer initialState={initialState} initialTrade={initialTrade} />
    </div>
  );
}
