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

const STYLE_URL =
  process.env.NEXT_PUBLIC_MAPLIBRE_TILES_URL ??
  "https://demotiles.maplibre.org/style.json";

export function NationalMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [flyout, setFlyout] = useState<FlyoutFeature | null>(null);
  const [filter, setFilter] = useState<{ consolidatedOnly: boolean }>({
    consolidatedOnly: false,
  });

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

    map.on("load", async () => {
      const res = await fetch("/api/map");
      const data = await res.json();
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
          "circle-color": [
            "case",
            ["get", "consolidated"],
            "#a23a2a",
            "#3b6b51",
          ],
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
        setFlyout({
          slug: String(p.slug),
          name: String(p.name),
          city: String(p.city),
          state: String(p.state),
          companyName: String(p.companyName),
        });
      });

      map.on("mouseenter", "clusters", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "clusters", () => (map.getCanvas().style.cursor = ""));
      map.on("mouseenter", "yard", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "yard", () => (map.getCanvas().style.cursor = ""));
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
      ? ["all", ["!", ["has", "point_count"]], ["==", ["get", "consolidated"], true]]
      : ["!", ["has", "point_count"]];
    if (map.getLayer("yard")) map.setFilter("yard", yardFilter);
  }, [filter]);

  return (
    <div className="relative h-[calc(100vh-9rem)] w-full">
      <div ref={containerRef} className="absolute inset-0" />

      <aside className="absolute top-4 left-4 z-10 w-64 max-w-[80vw] rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] p-3 shadow-sm text-sm">
        <p className="font-serif text-base mb-2">Filters</p>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={filter.consolidatedOnly}
            onChange={(e) =>
              setFilter((f) => ({ ...f, consolidatedOnly: e.target.checked }))
            }
          />
          <span>Consolidator-owned only</span>
        </label>
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          Red dots = under consolidator ownership · Green = independent or unverified
        </p>
      </aside>

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
          <Link
            href={`/yard/${flyout.slug}`}
            className="mt-3 inline-block text-sm underline"
          >
            See ownership chain →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
