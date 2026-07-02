import type { Metadata } from "next";
import { MapExplorer } from "@/components/map/map-explorer";

export const metadata: Metadata = {
  title: "Map",
  description:
    "Every tracked lumberyard, plumber, electrician, and HVAC company, color-coded by ownership. Filter by state, trade, and ownership; click a pin for the operating brand and ultimate owner.",
};

export default function MapPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-4">
      <section className="pt-4">
        <h1 className="m-0 font-serif text-[clamp(26px,4vw,38px)] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
          Map: who owns your trades
        </h1>
        <p className="mt-[10px] max-w-[62ch] text-sm leading-[1.55] text-muted">
          Each pin is a tracked business, colored by who owns it. Pick a state
          (Iowa to start), filter by trade, or show only locally-owned
          businesses or those rolled up by a consolidator or private-equity
          firm.
        </p>
      </section>

      <MapExplorer />
    </div>
  );
}
