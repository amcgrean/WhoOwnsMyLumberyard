"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { TradeChip } from "@/components/trade-chip";
import type { Trade } from "@/lib/db/schema";
import type { OwnershipBadgeKind } from "@/lib/constants";
import { OwnershipBadge } from "@/components/ownership-badge";

// One tracked business with coordinates. `kind` is its classified ownership
// badge (drives the pin color); `owner` is the immediate ownership parent and
// `franchise` the national brand it operates under, for the flyout line.
export type MapPoint = {
  slug: string;
  name: string;
  city: string;
  state: string;
  brand: string;
  owner: string | null;
  franchise?: string | null;
  kind: OwnershipBadgeKind;
  trade: Trade | null;
  lng: number;
  lat: number;
};

type FlyoutFeature = {
  slug: string;
  name: string;
  city: string;
  state: string;
  brand: string;
  owner: string | null;
  franchise: string | null;
  kind: OwnershipBadgeKind;
  trade: Trade | null;
};

// Default basemap: OpenFreeMap "liberty" vector style — 100% free, no API key,
// served via Cloudflare CDN. Falls back to a solid-background inline style if
// the style URL can't be reached, so business dots always render.
const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const STYLE_OVERRIDE = process.env.NEXT_PUBLIC_MAPLIBRE_TILES_URL;

const FALLBACK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#e8e6df" } }],
};

// Pin colors per ownership kind — hex equivalents of the --color-badge-*
// tokens (MapLibre paint can't read CSS variables).
export const KIND_COLORS: Record<OwnershipBadgeKind, string> = {
  independent: "#2f7a4b",
  coop: "#2c7f89",
  franchise: "#7c4fd4",
  private_equity: "#b8382c",
  public: "#2f62b0",
  family_mega: "#a5741b",
  unknown: "#8a8f98",
};

function toFeatureCollection(points: MapPoint[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: points.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: {
        s: p.slug,
        n: p.name,
        c: p.city,
        t: p.state,
        b: p.brand,
        o: p.owner,
        f: p.franchise ?? null,
        r: p.trade,
        k: p.kind,
      },
    })),
  };
}

function boundsOf(points: MapPoint[]): maplibregl.LngLatBoundsLike | null {
  if (points.length === 0) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (p.lng < minX) minX = p.lng;
    if (p.lng > maxX) maxX = p.lng;
    if (p.lat < minY) minY = p.lat;
    if (p.lat > maxY) maxY = p.lat;
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

/**
 * Presentational MapLibre map: renders `points` as clustered, ownership-colored
 * pins with a click flyout, and auto-fits the viewport to the points whenever
 * they change. Does no data fetching — the caller owns the data + filters.
 */
export function ResultsMap({
  points,
  className,
}: {
  points: MapPoint[];
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pointsRef = useRef<MapPoint[]>(points);
  const readyRef = useRef(false);
  const [flyout, setFlyout] = useState<FlyoutFeature | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  // Add/replace the data source + layers on top of whatever style is loaded.
  const syncData = (map: MapLibreMap, fit: boolean) => {
    const data = toFeatureCollection(pointsRef.current);
    const existing = map.getSource("yards") as GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
    } else {
      map.addSource("yards", {
        type: "geojson",
        data,
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 50,
        // Count chain-owned businesses inside each cluster so a cluster that
        // hides PE/public/chain-owned pins doesn't read as "all independent".
        clusterProperties: {
          owned: [
            "+",
            ["case", ["in", ["get", "k"], ["literal", ["private_equity", "public", "family_mega"]]], 1, 0],
          ],
        },
      });
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "yards",
        filter: ["has", "point_count"],
        paint: {
          // Neutral fill — the cluster itself says nothing about ownership…
          "circle-color": "#3f4a52",
          "circle-radius": ["step", ["get", "point_count"], 15, 10, 19, 50, 25, 200, 31],
          "circle-opacity": 0.88,
          // …but a red ring flags that it contains chain-owned businesses.
          "circle-stroke-width": ["case", [">", ["get", "owned"], 0], 3.5, 2],
          "circle-stroke-color": ["case", [">", ["get", "owned"], 0], KIND_COLORS.private_equity, "#ffffff"],
        },
      });
      // Count labels need glyphs; the inline fallback style has none, so only
      // add them when the basemap provides a glyph server.
      if (map.getStyle()?.glyphs) {
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "yards",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-font": ["Noto Sans Bold"],
            "text-size": 12,
            "text-allow-overlap": true,
          },
          paint: { "text-color": "#ffffff" },
        });
      }
      map.addLayer({
        id: "yard",
        type: "circle",
        source: "yards",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 6,
          "circle-color": [
            "match",
            ["get", "k"],
            ...Object.entries(KIND_COLORS).flat(),
            KIND_COLORS.unknown,
          ] as unknown as maplibregl.ExpressionSpecification,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.5,
        },
      });
    }
    if (fit) fitToPoints(map);
  };

  const fitToPoints = (map: MapLibreMap) => {
    const b = boundsOf(pointsRef.current);
    if (!b) return;
    const single = pointsRef.current.length === 1;
    map.fitBounds(b, {
      padding: 56,
      maxZoom: single ? 12 : 11,
      duration: 500,
    });
  };

  // Init the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    pointsRef.current = points;
    const initialStyle: string = STYLE_OVERRIDE ?? OPENFREEMAP_STYLE_URL;
    const initialBounds = boundsOf(pointsRef.current);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: initialStyle,
      center: [-93.5, 42], // Iowa-ish default before data fits
      zoom: 6,
      minZoom: 2,
      maxZoom: 14,
    });
    mapRef.current = map;

    let handlersAttached = false;
    const attachHandlers = () => {
      if (handlersAttached) return;
      handlersAttached = true;

      map.on("click", "clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = features[0]?.properties?.cluster_id;
        if (clusterId == null) return;
        const source = map.getSource("yards") as GeoJSONSource;
        source.getClusterExpansionZoom(Number(clusterId)).then((zoom) => {
          map.easeTo({
            center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number],
            zoom,
          });
        });
      });

      map.on("click", "yard", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, unknown>;
        setFlyout({
          slug: String(p.s),
          name: String(p.n),
          city: String(p.c),
          state: String(p.t),
          brand: String(p.b),
          owner: p.o == null ? null : String(p.o),
          franchise: p.f == null ? null : String(p.f),
          kind: (p.k as OwnershipBadgeKind) ?? "unknown",
          trade: (p.r as Trade | null) ?? null,
        });
      });

      for (const layer of ["clusters", "yard"] as const) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
    };

    let fallbackTriggered = false;
    const applyFallback = (reason: string) => {
      if (fallbackTriggered) return;
      fallbackTriggered = true;
      console.warn(`[map] ${reason} — switching to inline fallback style`);
      try {
        map.once("load", () => {
          syncData(map, Boolean(initialBounds));
          attachHandlers();
          readyRef.current = true;
        });
        map.setStyle(FALLBACK_STYLE);
        setUsingFallback(true);
      } catch (swapErr) {
        console.error("[map] fallback swap failed", swapErr);
      }
    };

    map.on("error", (e) => {
      const err = e?.error as { message?: string; status?: number } | undefined;
      const msg = err?.message ?? "(unknown)";
      if (map.isStyleLoaded()) return; // tile-level 404s are non-fatal
      const styleHasFailed =
        (typeof err?.status === "number" && (err.status === 0 || err.status >= 400)) ||
        /style\.json|sprite|glyphs/i.test(msg);
      if (styleHasFailed) applyFallback(`style error: ${msg}`);
    });

    const loadTimeout = window.setTimeout(() => {
      if (!map.isStyleLoaded()) applyFallback("style load timed out after 8 s");
    }, 8000);

    map.once("load", () => {
      window.clearTimeout(loadTimeout);
      syncData(map, Boolean(initialBounds));
      attachHandlers();
      readyRef.current = true;
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    const resizeRaf = window.requestAnimationFrame(() => map.resize());
    const onWinResize = () => map.resize();
    window.addEventListener("resize", onWinResize);
    // Re-measure whenever the container itself changes size (layout shifts,
    // fonts loading, grid reflow) — not just on window resize.
    const ro = new ResizeObserver(() => map.resize());
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      window.cancelAnimationFrame(resizeRaf);
      window.removeEventListener("resize", onWinResize);
      ro.disconnect();
      window.clearTimeout(loadTimeout);
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push new points + refit whenever the data changes.
  useEffect(() => {
    pointsRef.current = points;
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    setFlyout(null);
    syncData(map, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  return (
    <div
      className={
        "relative w-full overflow-hidden rounded-[14px] border border-rule bg-[var(--color-muted-bg)] " +
        (className ?? "")
      }
    >
      {/* Inline positioning on purpose: maplibre-gl.css sets
          `.maplibregl-map { position: relative }` on this element, and since
          Tailwind v4 utilities live in a CSS layer, that unlayered rule beats
          `absolute inset-0` — collapsing the map to 0px tall (invisible).
          Inline styles win over both. */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {points.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="rounded-md border border-rule bg-paper px-4 py-2 text-sm text-muted shadow">
            No mapped businesses for these filters.
          </div>
        </div>
      ) : null}

      {usingFallback ? (
        <div className="absolute left-3 top-3 z-10 rounded-md border border-rule bg-paper px-2.5 py-1.5 text-[11px] text-muted shadow">
          Basemap unavailable — showing business data on a plain background.
        </div>
      ) : null}

      {flyout ? (
        <div className="absolute bottom-4 left-1/2 z-10 w-[min(420px,calc(100%-2rem))] -translate-x-1/2 rounded-[12px] border border-rule bg-paper p-4 shadow-[0_12px_32px_-12px_rgba(30,30,20,0.35)]">
          <button
            type="button"
            className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full text-muted transition-colors hover:bg-muted-bg hover:text-ink"
            onClick={() => setFlyout(null)}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          <div className="pr-8 font-serif text-[17px] font-semibold leading-snug text-ink">{flyout.name}</div>
          <div className="mt-1 text-[12.5px] text-muted">
            {flyout.city}, {flyout.state}
            {flyout.franchise
              ? ` · Franchise of ${flyout.franchise}`
              : flyout.owner
                ? ` · Owned by ${flyout.owner}`
                : ""}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <OwnershipBadge kind={flyout.kind} size="sm" />
            <TradeChip trade={flyout.trade} />
          </div>
          <Link
            href={`/yard/${flyout.slug}`}
            className="mt-3 inline-flex items-center gap-1 text-[13.5px] font-semibold text-accent hover:underline hover:underline-offset-2"
          >
            See the ownership chain &rarr;
          </Link>
        </div>
      ) : null}
    </div>
  );
}
