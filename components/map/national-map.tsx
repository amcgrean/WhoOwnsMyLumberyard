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

// Default basemap: OpenFreeMap "liberty" vector style.
//   - 100 % free, no API key, served via Cloudflare CDN (no IP blocking)
//   - Complete style JSON including tiles, glyphs and sprites
//   - Our data layers are circle-only so we don't add any extra symbol layers
//
// Emergency fallback: a plain inline style with only a background-colour layer.
// Tiles are not needed; the fallback guarantees the map can always initialise
// and yard-dot layers still render on top of the solid background.
//
// Operators can set NEXT_PUBLIC_MAPLIBRE_TILES_URL to any MapLibre-compatible
// style.json URL (MapTiler, Protomaps, Stadia, a self-hosted style, etc.).
// That URL is tried first; on failure the code falls back through:
//   operator override → OpenFreeMap → solid-background inline style
const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

// Minimal inline style — no external tile dependency.  Used as the last-resort
// fallback so the map can always render and show yard-dot data.
const FALLBACK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#e8e6df" } },
  ],
};

const STYLE_OVERRIDE = process.env.NEXT_PUBLIC_MAPLIBRE_TILES_URL;

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

    // Priority: operator override → OpenFreeMap → (watchdog falls back to FALLBACK_STYLE)
    const initialStyle: string = STYLE_OVERRIDE ?? OPENFREEMAP_STYLE_URL;

    console.log("[map] initialising, style =", initialStyle);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: initialStyle,
      center: [-96.5, 39.5],
      zoom: 3.5,
      minZoom: 2,
      maxZoom: 14,
    });
    mapRef.current = map;

    // Cache fetched GeoJSON so fallback style re-loads don't re-fetch.
    let cachedData: GeoJSON.FeatureCollection | null = null;
    // Click/hover handlers only need to be attached once per map instance.
    let handlersAttached = false;

    // Re-add yard layers on top of whatever style is currently loaded.
    // Uses getLayer/getSource guards so no MapLibre error events are fired
    // when the layers/source don't yet exist.
    const addDataLayers = () => {
      console.log("[map] addDataLayers — cachedData features:", cachedData?.features?.length ?? "null");
      if (!cachedData) return;
      if (map.getLayer("yard")) map.removeLayer("yard");
      if (map.getLayer("clusters")) map.removeLayer("clusters");
      if (map.getSource("yards")) map.removeSource("yards");
      console.log("[map] adding source + layers");

      map.addSource("yards", {
        type: "geojson",
        data: cachedData,
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 50,
      });

      // Cluster bubbles — bigger cluster → bigger / darker circle.
      // Circle-only layers need no glyphs URL in the style.
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "yards",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#3b6b51", // 1-9   small
            10,
            "#2d4a3a", // 10-49 mid
            50,
            "#1f3527", // 50+   large
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
          "circle-radius": 5,
          "circle-color": ["case", ["get", "x"], "#a23a2a", "#3b6b51"],
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1,
        },
      });

      if (!handlersAttached) {
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
            companyName: String(p.b),
          });
        });

        map.on("mouseenter", "clusters", () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "clusters", () => (map.getCanvas().style.cursor = ""));
        map.on("mouseenter", "yard", () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "yard", () => (map.getCanvas().style.cursor = ""));
      }
      console.log("[map] addDataLayers done — layers in style:", map.getStyle()?.layers?.map((l) => l.id));
    };

    // If the style URL fails to load fall back to the solid-background inline
    // style.  Use map.once("load") so the fallback style's load event re-adds
    // the data layers cleanly without a persistent listener in the mix.
    let fallbackTriggered = false;
    const applyFallback = (reason: string) => {
      if (fallbackTriggered) return;
      fallbackTriggered = true;
      console.warn(`[map] ${reason} — switching to inline fallback style`);
      try {
        map.once("load", () => {
          console.log("[map] fallback style loaded — re-adding data layers");
          addDataLayers();
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
      const loaded = map.isStyleLoaded();
      console.warn("[map] error event — isStyleLoaded:", loaded, "| msg:", msg, "| status:", err?.status);
      // Tile-level 404s / network hiccups after the style has loaded are
      // non-fatal — log them but don't trigger the fallback.
      if (loaded) return;
      // Style-level failure (bad HTTP, missing sprite/glyph, etc.)
      const styleHasFailed =
        (typeof err?.status === "number" && (err.status === 0 || err.status >= 400)) ||
        /style\.json|sprite|glyphs/i.test(msg);
      console.warn("[map] styleHasFailed:", styleHasFailed);
      if (styleHasFailed) applyFallback(`style error: ${msg}`);
    });

    // Watchdog: if the style hasn't loaded within 8 s, apply the fallback.
    const loadTimeout = window.setTimeout(() => {
      console.warn("[map] watchdog fired — isStyleLoaded:", map.isStyleLoaded());
      if (!map.isStyleLoaded()) applyFallback("style load timed out after 8 s");
    }, 8000);

    // Use once() — the initial style load fires this exactly once.
    // The fallback path registers its own once("load") before calling setStyle.
    map.once("load", async () => {
      window.clearTimeout(loadTimeout);
      console.log("[map] initial load event fired");
      try {
        console.log("[map] fetching /api/map");
        const res = await fetch("/api/map");
        console.log("[map] /api/map status:", res.status);
        if (!res.ok) throw new Error(`/api/map returned ${res.status}`);
        cachedData = (await res.json()) as GeoJSON.FeatureCollection;
        console.log("[map] data received — features:", cachedData.features?.length);
        setCount(cachedData.features?.length ?? 0);
        addDataLayers();
      } catch (e) {
        console.error("[map] load error:", e);
        setError(`Failed to load map data: ${e instanceof Error ? e.message : "unknown error"}`);
      } finally {
        setLoading(false);
      }
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    // Ensure the canvas re-measures once it's actually laid out — Tailwind's
    // calc() height sometimes resolves a tick after the Map() constructor runs.
    const resizeRaf = window.requestAnimationFrame(() => map.resize());
    const onWinResize = () => map.resize();
    window.addEventListener("resize", onWinResize);

    return () => {
      window.cancelAnimationFrame(resizeRaf);
      window.removeEventListener("resize", onWinResize);
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
    <div className="relative h-[calc(100dvh-8rem)] min-h-[480px] w-full bg-[var(--color-muted-bg)]">
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
            Showing {count.toLocaleString()} businesses
          </p>
        ) : null}
        {usingFallback ? (
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Basemap unavailable — showing business data on plain background.
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
