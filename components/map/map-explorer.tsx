"use client";

import { useEffect, useMemo, useState } from "react";
import { ResultsMap, type MapPoint } from "@/components/map/results-map";
import { BizRow } from "@/components/biz-row";
import { TRADE_SHORT_LABELS, US_STATES, STATE_NAME_BY_CODE } from "@/lib/constants";
import type { Trade } from "@/lib/db/schema";

const TRADES = Object.keys(TRADE_SHORT_LABELS) as Trade[];
const DEFAULT_STATE = "IA";
const LIST_CAP = 400;

type Ownership = "all" | "local" | "consolidator";

type GeoFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    s: string;
    n: string;
    c: string;
    t: string;
    b: string;
    o: string | null;
    r: Trade | null;
  };
};

function parseFeatures(fc: { features?: GeoFeature[] }): MapPoint[] {
  return (fc.features ?? []).map((f) => ({
    slug: f.properties.s,
    name: f.properties.n,
    city: f.properties.c,
    state: f.properties.t,
    brand: f.properties.b,
    owner: f.properties.o,
    trade: f.properties.r,
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  }));
}

const OWNERSHIP_TABS: ReadonlyArray<{ value: Ownership; label: string }> = [
  { value: "all", label: "All" },
  { value: "local", label: "Local only" },
  { value: "consolidator", label: "Consolidator" },
];

/**
 * The map page's interactive explorer. Fetches one state's geocoded businesses
 * at a time (defaulting to Iowa — a small, fast payload), then filters by
 * trade, ownership, and a name/city query entirely client-side so those
 * controls feel instant. The map and the results list are driven by the exact
 * same filtered set.
 */
export function MapExplorer() {
  const [stateCode, setStateCode] = useState<string>(DEFAULT_STATE);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [ownership, setOwnership] = useState<Ownership>("all");
  const [query, setQuery] = useState("");
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // (Re)fetch whenever the state scope changes. This is a data-loading effect:
  // it genuinely owns loading/error/data state, so the setState calls here are
  // intentional (not derivable during render).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = stateCode ? `?state=${stateCode}` : "";
    fetch(`/api/map${qs}`)
      .then((res) => {
        if (!res.ok) throw new Error(`/api/map returned ${res.status}`);
        return res.json();
      })
      .then((fc) => {
        if (cancelled) return;
        setPoints(parseFeatures(fc));
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load map data");
        setPoints([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stateCode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return points.filter((p) => {
      if (trade && p.trade !== trade) return false;
      if (ownership === "local" && p.owner != null) return false;
      if (ownership === "consolidator" && p.owner == null) return false;
      if (q && !(`${p.name} ${p.city}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [points, trade, ownership, query]);

  const listRows = filtered.slice(0, LIST_CAP);
  const scopeLabel = stateCode ? STATE_NAME_BY_CODE[stateCode] ?? stateCode : "the U.S.";

  return (
    <div className="mt-[22px] grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      {/* ── Filters column ── */}
      <div className="flex w-full flex-col gap-4 lg:max-w-[320px]">
        <div className="rounded-[12px] border border-rule bg-paper p-4">
          {/* State */}
          <label
            htmlFor="map-state"
            className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted"
          >
            State
          </label>
          <select
            id="map-state"
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value)}
            className="mt-[8px] w-full rounded-[8px] border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:border-accent focus:outline-none"
          >
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
            <option value="">All states (slower)</option>
          </select>

          {/* Trade */}
          <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">
            Trade
          </div>
          <div className="mt-[10px] flex flex-wrap gap-[7px]">
            <FilterPill active={trade === null} onClick={() => setTrade(null)}>
              All
            </FilterPill>
            {TRADES.map((t) => (
              <FilterPill
                key={t}
                active={trade === t}
                onClick={() => setTrade((cur) => (cur === t ? null : t))}
              >
                {TRADE_SHORT_LABELS[t]}
              </FilterPill>
            ))}
          </div>

          {/* Ownership */}
          <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">
            Ownership
          </div>
          <div className="mt-[10px] inline-flex rounded-[8px] border border-rule bg-muted-bg p-[2px]">
            {OWNERSHIP_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setOwnership(tab.value)}
                className={
                  "rounded-[6px] px-3 py-[6px] text-[12.5px] font-semibold transition-colors " +
                  (ownership === tab.value
                    ? "bg-accent text-white"
                    : "text-muted hover:text-ink")
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Name / city filter */}
          <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">
            Find within results
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Business or city…"
            className="mt-[8px] w-full rounded-[8px] border border-rule bg-paper px-3 py-2 text-[14px] text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>

        {/* Legend */}
        <div className="rounded-[12px] border border-rule bg-paper p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">
            Legend
          </div>
          <div className="mt-[10px] flex flex-col gap-2">
            <LegendDot color="var(--color-badge-pe)" label="Consolidator / PE-owned" />
            <LegendDot color="var(--color-badge-independent)" label="Independent or unverified" />
          </div>
          <p className="mt-3 text-[12px] text-muted">
            {loading
              ? "Loading…"
              : `${filtered.length.toLocaleString()} of ${points.length.toLocaleString()} in ${scopeLabel}`}
          </p>
        </div>
      </div>

      {/* ── Map + results ── */}
      <div>
        <div className="relative">
          <ResultsMap points={filtered} className="h-[calc(100dvh-14rem)] min-h-[440px]" />
          {loading ? (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <div className="rounded-md border border-rule bg-paper px-4 py-2 text-sm shadow">
                Loading {scopeLabel}…
              </div>
            </div>
          ) : null}
          {error ? (
            <div className="absolute right-16 top-4 z-10 max-w-md rounded-md border border-[var(--color-badge-pe)]/30 bg-paper p-3 text-sm shadow">
              <p className="font-medium text-[var(--color-badge-pe)]">Map error</p>
              <p className="mt-1 text-muted">{error}</p>
            </div>
          ) : null}
        </div>

        <section className="mt-[24px]">
          <div className="flex flex-wrap items-baseline justify-between gap-[10px] border-b border-rule pb-[10px]">
            <h2 className="m-0 font-serif text-[20px] font-semibold text-ink">Results</h2>
            <span className="text-[13px] text-muted">
              {filtered.length.toLocaleString()} in {scopeLabel}
              {filtered.length > LIST_CAP ? ` · showing first ${LIST_CAP}` : ""}
            </span>
          </div>
          <div className="mt-[14px] flex flex-col gap-2">
            {listRows.length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-rule px-7 py-7 text-center text-[13.5px] text-muted">
                {loading ? "Loading businesses…" : "No businesses match these filters."}
              </div>
            ) : (
              listRows.map((p) => (
                <BizRow
                  key={p.slug}
                  href={`/yard/${p.slug}`}
                  name={p.name}
                  city={p.city}
                  state={p.state}
                  trade={p.trade}
                  ownerLine={p.owner ? `Owned by ${p.owner}` : p.brand}
                  badge={p.owner ? "private_equity" : "independent"}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors " +
        (active ? "bg-accent text-white" : "bg-muted-bg text-muted hover:text-ink")
      }
    >
      {children}
    </button>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-[9px] text-[13px] text-ink">
      <span
        className="h-[13px] w-[13px] rounded-full"
        style={{ background: color, boxShadow: `0 0 0 2px var(--color-paper), 0 0 0 3px ${color}` }}
      />
      {label}
    </div>
  );
}
