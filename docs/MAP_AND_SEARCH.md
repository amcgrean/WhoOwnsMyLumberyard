# Map and search — what they do and why

These two features have had the most production bug iterations. This doc
captures the current state and why it's that way.

---

## Map

### Component: `components/map/national-map.tsx`

Client island mounted by `app/(data)/map/page.tsx`.

### Tile source

Default is an **inline `StyleSpecification`** that pulls raster tiles from
Carto's basemap CDN:

```ts
{
  version: 8,
  sources: {
    base: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#f0efe9" } },
    { id: "base", type: "raster", source: "base" },
  ],
}
```

**Why inline raster + Carto:**

- No external `style.json` round-trip, no third-party glyph/sprite fetch.
- `tile.openstreetmap.org` directly returns 403 to some production
  `*.vercel.app` referrers; Carto's basemap CDN explicitly serves any caller
  with no referrer block.
- Carto's CDN is the most-used tile CDN in analytics dashboards globally — it
  rarely fails.
- Operators can still opt into a richer **vector** style via
  `NEXT_PUBLIC_MAPLIBRE_TILES_URL`. The component watches for load failures on
  the override and falls back to the inline raster style after 6 seconds.

### Layers

Two layers in addition to the basemap:

1. `clusters` — `circle` layer keyed on `point_count`. Bigger / darker
   clusters mean more yards. **No symbol layer for cluster counts** — symbol
   layers require a `glyphs` URL, and our inline raster style doesn't have
   one. Color steps and radius steps express magnitude visually instead.
2. `yard` — `circle` layer for individual locations. Red (`#a23a2a`) when
   under consolidator ownership, green (`#3b6b51`) otherwise.

A "Filters" sidebar (collapsible drawer on mobile) toggles consolidator-only
view via `map.setFilter("yard", …)`.

### GeoJSON payload

`/api/map/route.ts` returns a `FeatureCollection` of every geocoded location.

- Property keys are intentionally short (`s/n/c/t/b/x`) to halve wire size.
  The component reads them via a tiny aliasing layer in the click handler.
- Cache headers: `public, max-age=300, s-maxage=600, stale-while-revalidate=86400`.
- ISR revalidates every 600 seconds (`export const revalidate = 600`).

### Client-side flow

```ts
useEffect(() => {
  const map = new maplibregl.Map({ container, style: OSM_RASTER_STYLE, … });
  // Watchdog: swap to fallback if a custom override style fails to load
  // Resize on next animation frame (Tailwind calc() can resolve a tick late)

  map.on("load", async () => {
    const data = await fetch("/api/map").then(r => r.json());
    map.addSource("yards", { type: "geojson", data, cluster: true, … });
    map.addLayer({ id: "clusters", type: "circle", … });
    map.addLayer({ id: "yard",     type: "circle", … });
    setLoading(false);
  });
}, []);
```

### Ten reasons the map can fail (and how it currently handles each)

| Symptom | Cause | What now happens |
| --- | --- | --- |
| Empty gray map | Style.json fetch hung | 6s watchdog → swap to inline OSM style |
| Empty gray map | Tile URL blocked by network | Carto rarely blocked; if it is, manual override via env var |
| Empty gray map | WebGL disabled in browser | Loading overlay stays; user sees no map. Acceptable. |
| Map area is 0px tall | Tailwind calc() resolved late | `requestAnimationFrame(() => map.resize())` after init |
| `addLayer` throws on cluster-count | Symbol layer needs `glyphs` | Layer removed; size encoded by circle radius |
| `/api/map` 500 | DB read failed | Try/catch in route handler returns empty `FeatureCollection` |
| Stale GeoJSON after data change | Cache | Push an empty commit to redeploy and bust the edge cache |
| Mobile filter panel overlaps map | Old layout | Now a button + drop-down sheet on `<sm` |
| 14000 markers eats CPU on phone | Too many features | Cluster radius 50px, max-zoom 12; client throttles fine at 3K |
| iOS Safari zoom on focus | Input < 16px | Search input now `text-base` (16px) on mobile |

### Adding a different basemap

Set `NEXT_PUBLIC_MAPLIBRE_TILES_URL` on Vercel to any of:

- MapTiler: `https://api.maptiler.com/maps/streets-v2/style.json?key=YOUR_KEY`
- Protomaps: a self-hosted PMTiles style URL
- Stadia: their style URL with your key
- OpenFreeMap: `https://tiles.openfreemap.org/styles/positron`
- Carto positron (vector): `https://basemaps.cartocdn.com/gl/positron-gl-style/style.json`

If the override fails to load, the inline raster fallback kicks in
automatically.

---

## Search

### Function: `lib/search.ts` → `searchAll(query, limit)`

Used by both `/search` (page) and `/api/search` (route).

### Three-tier matching

1. **Exact zip** (`/^\d{5}$/`):
   ```sql
   WHERE zip = $1
   ```
   Returns immediately if any rows match.

2. **Zip prefix fallback** (3-digit). When the exact 5-digit search returns
   0 results — the 3-digit prefix covers the same metro area:
   ```sql
   WHERE zip LIKE '503%'
   ORDER BY zip, city
   ```
   Also handles 3- or 4-digit numeric queries directly.

3. **Postgres full-text search**. `websearch_to_tsquery('english', q)` against
   tsvectors over (displayName, city, state, zip) for locations and (name,
   legalName, description) for companies. Results ordered by `ts_rank()`
   inlined directly in `ORDER BY` (not by alias — see "alias-in-orderby"
   pitfall below).

4. **ILIKE substring fallback**. When FTS returns 0 results — useful for
   brand names with slashes the english tokenizer doesn't split (e.g.
   `Gilcrest/Jewett`):
   ```sql
   WHERE displayName ILIKE '%q%' OR city ILIKE '%q%'
   ```

### Alias-in-orderby pitfall (recurring bug)

Drizzle quotes SELECT aliases as `"distanceMi"` or `"rank"`. A bare
`ORDER BY rank DESC` doesn't bind to the quoted alias in some Postgres
parser paths, raising `column "rank" does not exist`. **Always inline the
expression in ORDER BY** rather than referencing the alias:

```ts
// ❌ BROKEN
.select({ ..., rank: sql<number>`ts_rank(doc, query)` })
.orderBy(sql`rank DESC`)

// ✅ WORKS
const rank = sql<number>`ts_rank(doc, query)`
.select({ ..., rank })
.orderBy(sql`${rank} DESC`)
```

Same gotcha applies to the haversine query in `getNearbyLocations`. See
`docs/HANDOFF.md` "What to do if you find a bug".

### JS-number → int4 parameter pitfall

Drizzle parameterizes JS numbers as `int4`. If you pass a float (like 3958.8
for earth radius in miles), Postgres rejects it with `invalid input syntax
for type integer`. Either:

1. **Inline the literal** in the SQL string: `sql\`3958.8 * …\``.
2. **Cast every numeric parameter** to `::float8`: `${lat}::float8`.

Both are used in `lib/queries/locations.ts` for the haversine query.

### Result shape

```ts
type SearchResult =
  | { kind: "location"; id; slug; displayName; city; state; zip }
  | { kind: "company";  id; slug; name; type; description }
```

The page groups them under separate "Yards" and "Companies & owners" sections.
