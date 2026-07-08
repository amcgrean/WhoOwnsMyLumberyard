"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { TradeChip } from "@/components/trade-chip";
import type { Trade } from "@/lib/db/schema";

// One tracked business with coordinates. `owner` is the ultimate ownership
// parent (null ⇒ not owned); `franchise` is the national brand this is a
// franchisee of (null ⇒ not a franchise). Together they drive the pin color.
export type MapPoint = {
  slug: string;
  name: string;
  city: string;
  state: string;
  brand: string;
  owner: string | null;
  franchise?: string | null;
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

const PE_COLOR = "#a23a2a";
const INDIE_COLOR = "#3b6b51";
const FRANCHISE_COLOR = "#7c4fd4";

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
        x: p.owner != null,
        fr: p.franchise != null,
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
      });
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "yards",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#3b6b51",
            10,
            "#2d4a3a",
            50,
            "#1f3527",
          ],
          "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 50, 24, 200, 30],
          "circle-opacity": 0.9,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        },
      });
      map.addLayer({
        id: "yard",
        type: "circle",
        source: "yards",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 6,
          "circle-color": [
            "case",
            ["get", "fr"],
            FRANCHISE_COLOR,
            ["get", "x"],
            PE_COLOR,
            INDIE_COLOR,
          ],
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

    return () => {
      window.cancelAnimationFrame(resizeRaf);
      window.removeEventListener("resize", onWinResize);
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
      <div ref={containerRef} className="absolute inset-0" />

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
        <div className="absolute bottom-4 left-1/2 z-10 w-[min(420px,90vw)] -translate-x-1/2 rounded-[12px] border border-rule bg-paper p-4 shadow">
          <button
            type="button"
            className="absolute right-2 top-2 text-xs text-muted"
            onClick={() => setFlyout(null)}
            aria-label="Close"
          >
            ✕
          </button>
          <div className="flex items-start justify-between gap-2">
            <div className="font-serif text-lg text-ink">{flyout.name}</div>
            <TradeChip trade={flyout.trade} className="mt-1 shrink-0" />
          </div>
          <div className="mt-1 text-xs text-muted">
            {flyout.city}, {flyout.state} ·{" "}
            {flyout.franchise
              ? `Franchise of ${flyout.franchise}`
              : flyout.owner
                ? `Owned by ${flyout.owner}`
                : flyout.brand}
          </div>
          <Link
            href={`/yard/${flyout.slug}`}
            className="mt-3 inline-block text-sm text-accent underline underline-offset-2"
          >
            See ownership chain →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
