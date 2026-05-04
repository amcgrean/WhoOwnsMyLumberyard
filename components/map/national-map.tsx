"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";

type FlyoutFeature = {
  slug: string;
  name: string;
  city: string;
  state: string;
  companyName: string;
};

// Carto's positron basemap — free, OSM-derived, no API key, served from a CDN
// battle-tested by analytics dashboards. Override via
// NEXT_PUBLIC_MAPLIBRE_TILES_URL on Vercel to swap in MapTiler / Protomaps /
// OpenFreeMap / a self-hosted style.
const STYLE_URL =
  process.env.NEXT_PUBLIC_MAPLIBRE_TILES_URL ??
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

// Inline raster fallback — used only if the primary style.json fails to load.
// OSM tile usage policy permits low-traffic / editorial use.
const FALLBACK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export function NationalMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [flyout, setFlyout] = useState<FlyoutFeature | null>(null);
  const [filter, setFilter] = useState<{ consolidatedOnly: boolean }>({
    consolidatedOnly: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [-96.5, 39.5],
      zoom: 3.5,
      minZoom: 2,
      maxZoom: 14,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    // If the primary style fails to load (network block, CORS, 404), swap in
    // the inline OSM raster fallback once. Tile-by-tile errors are logged but
    // don't trigger a fallback — only a style-document failure does.
    let fallbackTriggered = false;
    map.on("error", (e) => {
      const err = e?.error as { message?: string; status?: number } | undefined;
      const msg = err?.message ?? "Tile load failed";
      console.warn("[map] non-fatal error", msg, err);
      const styleHasFailed =
        !fallbackTriggered &&
        ((typeof err?.status === "number" && (err.status === 0 || err.status >= 400)) ||
          /style\.json|sprite|glyphs/i.test(msg));
      if (styleHasFailed && !map.isStyleLoaded()) {
        fallbackTriggered = true;
        console.warn("[map] primary style failed; switching to OSM raster fallback");
        try {
          map.setStyle(FALLBACK_STYLE);
          setUsingFallback(true);
        } catch (swapErr) {
          console.error("[map] fallback swap failed", swapErr);
        }
      }
    });

    // Belt-and-suspenders: if neither `load` nor `error` fires within 8s, the
    // primary style is presumably stuck. Switch to the fallback proactively.
    const loadTimeout = window.setTimeout(() => {
      if (!fallbackTriggered && !map.isStyleLoaded()) {
        fallbackTriggered = true;
        console.warn("[map] style load timed out; switching to OSM raster fallback");
        try {
          map.setStyle(FALLBACK_STYLE);
          setUsingFallback(true);
        } catch (swapErr) {
          console.error("[map] fallback swap failed", swapErr);
        }
      }
    }, 8000);
    map.once("load", () => window.clearTimeout(loadTimeout));

    map.on("load", async () => {
      try {
        const res = await fetch("/api/map");
        if (!res.ok) throw new Error(`/api/map returned ${res.status}`);
        const data = (await res.json()) as GeoJSON.FeatureCollection;
        setCount(data.features?.length ?? 0);

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
            "circle-color": "#2d4a3a",
            "circle-radius": ["step", ["get", "point_count"], 14, 25, 18, 100, 24],
            "circle-opacity": 0.85,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#fff",
          },
        });

        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "yards",
          filter: ["has", "point_count"],
          layout: {
            "text-field": "{point_count_abbreviated}",
            "text-size": 11,
          },
          paint: { "text-color": "#fff" },
        });

        map.addLayer({
          id: "yard",
          type: "circle",
          source: "yards",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": 5,
            "circle-color": ["case", ["get", "x"], "#a23a2a", "#3b6b51"],
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 1,
          },
        });

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
          // Short property keys come from /api/map; expand them on click only.
          setFlyout({
            slug: String(p.s),
            name: String(p.n),
            city: String(p.c),
            state: String(p.t),
            companyName: String(p.b),
          });
        });

        map.on("mouseenter", "clusters", () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "clusters", () => (map.getCanvas().style.cursor = ""));
        map.on("mouseenter", "yard", () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "yard", () => (map.getCanvas().style.cursor = ""));
      } catch (e) {
        setError(`Failed to load map data: ${e instanceof Error ? e.message : "unknown error"}`);
      } finally {
        setLoading(false);
      }
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Apply filter via setFilter on the layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const yardFilter: maplibregl.FilterSpecification = filter.consolidatedOnly
      ? ["all", ["!", ["has", "point_count"]], ["==", ["get", "x"], true]]
      : ["!", ["has", "point_count"]];
    if (map.getLayer("yard")) map.setFilter("yard", yardFilter);
  }, [filter]);

  return (
    <div className="relative h-[calc(100vh-9rem)] w-full bg-[var(--color-muted-bg)]">
      <div ref={containerRef} className="absolute inset-0" />

      {loading ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-2 text-sm shadow">
            Loading map…
          </div>
        </div>
      ) : null}

      {/* Mobile: a single button at top-left toggles a centered sheet.
          Desktop: the panel is always visible at top-left. */}
      <button
        type="button"
        onClick={() => setFiltersOpen((v) => !v)}
        className="absolute top-4 left-4 z-10 sm:hidden rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-1.5 text-xs font-medium shadow-sm"
        aria-expanded={filtersOpen}
        aria-controls="map-filters"
      >
        {filtersOpen ? "Hide filters" : "Filters"}
      </button>

      <aside
        id="map-filters"
        className={
          "absolute z-10 rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] p-3 shadow-sm text-sm " +
          // Desktop: pinned top-left
          "sm:top-4 sm:left-4 sm:w-64 sm:max-w-[80vw] sm:block " +
          // Mobile: pinned below the toggle button, full-ish width
          (filtersOpen
            ? "top-14 left-4 right-4 sm:right-auto"
            : "hidden sm:block")
        }
      >
        <p className="font-serif text-base mb-2">Filters</p>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={filter.consolidatedOnly}
            onChange={(e) => setFilter((f) => ({ ...f, consolidatedOnly: e.target.checked }))}
          />
          <span>Consolidator-owned only</span>
        </label>
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          Red = under consolidator ownership · Green = independent or unverified
        </p>
        {count != null ? (
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Showing {count.toLocaleString()} yards
          </p>
        ) : null}
        {usingFallback ? (
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Using OSM raster fallback (primary tile provider unreachable).
          </p>
        ) : null}
      </aside>

      {error ? (
        <div className="absolute top-4 right-16 z-10 max-w-md rounded-md border border-[var(--color-badge-pe)]/30 bg-[var(--color-paper)] p-3 text-sm shadow">
          <p className="text-[var(--color-badge-pe)] font-medium">Map error</p>
          <p className="text-[var(--color-muted)] mt-1">{error}</p>
        </div>
      ) : null}

      {flyout ? (
        <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 w-[min(420px,90vw)] rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] p-4 shadow">
          <button
            type="button"
            className="absolute top-2 right-2 text-xs text-[var(--color-muted)]"
            onClick={() => setFlyout(null)}
            aria-label="Close"
          >
            ✕
          </button>
          <div className="font-serif text-lg">{flyout.name}</div>
          <div className="text-xs text-[var(--color-muted)] mt-1">
            {flyout.city}, {flyout.state} · {flyout.companyName}
          </div>
          <Link href={`/yard/${flyout.slug}`} className="mt-3 inline-block text-sm underline">
            See ownership chain →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
