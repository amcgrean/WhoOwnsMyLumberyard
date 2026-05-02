import type { Metadata } from "next";
import { NationalMap } from "@/components/map/national-map";

export const metadata: Metadata = {
  title: "National map",
  description:
    "Every tracked U.S. lumberyard, color-coded by ownership type. Click a marker to see the operating brand and ultimate owner.",
};

export default function MapPage() {
  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-2">
        <h1 className="font-serif text-2xl">National map</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Click a cluster to zoom in. Click a marker for the ownership chain.
        </p>
      </div>
      <NationalMap />
    </div>
  );
}
