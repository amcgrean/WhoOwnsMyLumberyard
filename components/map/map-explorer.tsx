"use client";

import { useEffect, useMemo, useState } from "react";
import { ResultsMap, KIND_COLORS, type MapPoint } from "@/components/map/results-map";
import { BizRow } from "@/components/biz-row";
import {
  TRADE_SHORT_LABELS,
  US_STATES,
  STATE_NAME_BY_CODE,
  OWNERSHIP_BADGE_LABELS,
  type OwnershipBadgeKind,
} from "@/lib/constants";
import { isChainOwned, isLocallyOwned } from "@/lib/ownership-kind";
import type { Trade } from "@/lib/db/schema";

const TRADES = Object.keys(TRADE_SHORT_LABELS) as Trade[];
const DEFAULT_STATE = "IA";
const PAGE = 100;

type Ownership = "all" | "local" | "chain" | "franchise";

type GeoFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    s: string;
    n: string;
    c: string;
    t: string;
    b: string;
    o: string | null;
    f: string | null;
    r: Trade | null;
    k: OwnershipBadgeKind | null;
  };
};

function parseFeatures(fc: { features?: GeoFeature[] }): MapPoint[] {
  return (fc.features ?? [])
    .map((f) => ({
      slug: f.properties.s,
      name: f.properties.n,
      city: f.properties.c,
      state: f.properties.t,
      brand: f.properties.b,
      owner: f.properties.o,
      franchise: f.properties.f ?? null,
      kind: f.properties.k ?? "unknown",
      trade: f.properties.r,
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    }))
    .sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name));
}

const OWNERSHIP_TABS: ReadonlyArray<{ value: Ownership; label: string }> = [
  { value: "all", label: "All" },
  { value: "local", label: "Locally owned" },
  { value: "chain", label: "Chain-owned" },
  { value: "franchise", label: "Franchise" },
];

// Legend order — most important signal first.
const LEGEND_KINDS: OwnershipBadgeKind[] = [
  "private_equity",
  "public",
  "family_mega",
  "franchise",
  "independent",
  "coop",
  "unknown",
];

function ownerLine(p: MapPoint): string {
  if (p.franchise) return `Franchise of ${p.franchise}`;
  if (p.owner) return `Owned by ${p.owner}`;
  if (p.kind === "unknown") return "Ownership not yet verified";
  return p.brand === p.name ? "Locally owned" : p.brand;
}

function matchesOwnership(kind: OwnershipBadgeKind, o: Ownership): boolean {
  if (o === "local") return isLocallyOwned(kind);
  if (o === "chain") return isChainOwned(kind);
  if (o === "franchise") return kind === "franchise";
  return true;
}

/**
 * The map page's interactive explorer. Fetches one state's geocoded businesses
 * at a time (defaulting to Iowa — a small, fast payload), then filters by
 * trade, ownership, and a name/city query entirely client-side so those
 * controls feel instant. The map and the results list share the same filtered
 * set, and the filters are mirrored into the URL so a view can be shared.
 */
export function MapExplorer({
  initialState,
  initialTrade,
}: {
  initialState?: string;
  initialTrade?: Trade | null;
}) {
  const [stateCode, setStateCode] = useState<string>(initialState ?? DEFAULT_STATE);
  const [trade, setTrade] = useState<Trade | null>(initialTrade ?? null);
  const [ownership, setOwnership] = useState<Ownership>("all");
  const [query, setQuery] = useState("");
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);

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
        if (!cancelled) setPoints(parseFeatures(fc));
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

  // Reset pagination whenever the filtered set changes.
  useEffect(() => {
    setShown(PAGE);
  }, [stateCode, trade, ownership, query]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Mirror filters into the URL (replaceState: no history spam) so the
  // current view is linkable.
  useEffect(() => {
    const u = new URL(window.location.href);
    if (stateCode && stateCode !== DEFAULT_STATE) u.searchParams.set("state", stateCode);
    else if (!stateCode) u.searchParams.set("state", "all");
    else u.searchParams.delete("state");
    if (trade) u.searchParams.set("trade", trade);
    else u.searchParams.delete("trade");
    window.history.replaceState(null, "", u.toString());
  }, [stateCode, trade]);

  // Trade + text filter first; the legend counts reflect this set, then the
  // ownership tab narrows it further.
  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return points.filter((p) => {
      if (trade && p.trade !== trade) return false;
      if (q && !`${p.name} ${p.city}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [points, trade, query]);

  const filtered = useMemo(
    () => scoped.filter((p) => matchesOwnership(p.kind, ownership)),
    [scoped, ownership]
  );

  const kindCounts = useMemo(() => {
    const m = new Map<OwnershipBadgeKind, number>();
    for (const p of scoped) m.set(p.kind, (m.get(p.kind) ?? 0) + 1);
    return m;
  }, [scoped]);

  const listRows = filtered.slice(0, shown);
  const scopeLabel = stateCode ? (STATE_NAME_BY_CODE[stateCode] ?? stateCode) : "the U.S.";

  return (
    <div className="mt-6 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
      {/* ── Filters column ── */}
      <div className="flex w-full flex-col gap-4 lg:sticky lg:top-[76px]">
        <div className="rounded-[12px] border border-rule bg-paper p-4">
          <FieldLabel htmlFor="map-state">State</FieldLabel>
          <select
            id="map-state"
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value)}
            className="mt-2 w-full rounded-[8px] border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
            <option value="">All states (slower)</option>
          </select>

          <FieldLabel className="mt-4">Trade</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-1.5">
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

          <FieldLabel className="mt-4">Ownership</FieldLabel>
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-[9px] border border-rule bg-muted-bg p-[3px]">
            {OWNERSHIP_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                aria-pressed={ownership === tab.value}
                onClick={() => setOwnership(tab.value)}
                className={
                  "rounded-[6px] px-2 py-[6px] text-[12.5px] font-semibold transition-colors " +
                  (ownership === tab.value
                    ? "bg-paper text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                    : "text-muted hover:text-ink")
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          <FieldLabel htmlFor="map-find" className="mt-4">
            Find within results
          </FieldLabel>
          <input
            id="map-find"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Business or city…"
            className="mt-2 w-full rounded-[8px] border border-rule bg-paper px-3 py-2 text-[14px] text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>

        {/* Legend with live counts */}
        <div className="rounded-[12px] border border-rule bg-paper p-4">
          <FieldLabel>Who owns them</FieldLabel>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {LEGEND_KINDS.filter((k) => (kindCounts.get(k) ?? 0) > 0 || k === "independent" || k === "private_equity").map(
              (k) => (
                <li key={k} className="flex items-center gap-2.5 text-[13px] text-ink">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: KIND_COLORS[k], boxShadow: `0 0 0 2px var(--color-paper), 0 0 0 3px ${KIND_COLORS[k]}` }}
                  />
                  <span className="flex-1">{OWNERSHIP_BADGE_LABELS[k]}</span>
                  <span className="tabular-nums text-muted">
                    {loading ? "—" : (kindCounts.get(k) ?? 0).toLocaleString()}
                  </span>
                </li>
              )
            )}
          </ul>
          <p className="mt-3 border-t border-rule pt-2.5 text-[12px] leading-snug text-muted">
            {loading
              ? `Loading ${scopeLabel}…`
              : `${scoped.length.toLocaleString()} businesses in ${scopeLabel}${trade ? ` · ${TRADE_SHORT_LABELS[trade]}` : ""}`}
          </p>
        </div>
      </div>

      {/* ── Map + results ── */}
      <div className="min-w-0">
        <div className="relative">
          <ResultsMap points={filtered} className="h-[min(640px,calc(100dvh-12rem))] min-h-[380px]" />
          {loading ? (
            <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
              <div className="flex items-center gap-2 rounded-full border border-rule bg-paper px-4 py-2 text-sm text-muted shadow">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
                Loading {scopeLabel}…
              </div>
            </div>
          ) : null}
          {error ? (
            <div role="alert" className="absolute right-14 top-3 z-10 max-w-md rounded-md border border-[var(--color-badge-pe)]/30 bg-paper p-3 text-sm shadow">
              <p className="font-medium text-[var(--color-badge-pe)]">Couldn&rsquo;t load the map data</p>
              <p className="mt-1 text-muted">{error}</p>
            </div>
          ) : null}
        </div>

        <section className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2.5 border-b border-rule pb-2.5">
            <h2 className="m-0 font-serif text-[20px] font-semibold text-ink">Results</h2>
            <span className="text-[13px] text-muted">
              {filtered.length.toLocaleString()} in {scopeLabel}
            </span>
          </div>
          <div className="mt-3.5 flex flex-col gap-2">
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
                  ownerLine={ownerLine(p)}
                  badge={p.kind}
                />
              ))
            )}
          </div>
          {filtered.length > shown ? (
            <div className="mt-4 flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE)}
                className="rounded-full border border-rule bg-paper px-5 py-2 text-[13.5px] font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
              >
                Show {Math.min(PAGE, filtered.length - shown).toLocaleString()} more
              </button>
              <span className="text-[12px] text-muted">
                Showing {shown.toLocaleString()} of {filtered.length.toLocaleString()}
              </span>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function FieldLabel({
  children,
  htmlFor,
  className = "",
}: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  const cls = `block text-[11px] font-semibold uppercase tracking-[0.07em] text-muted ${className}`;
  return htmlFor ? (
    <label htmlFor={htmlFor} className={cls}>
      {children}
    </label>
  ) : (
    <div className={cls}>{children}</div>
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
      aria-pressed={active}
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
