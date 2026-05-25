# Map and search — what they do and why

These two features have had the most production bug iterations. This doc
captures the current state and why it's that way.

---

## Map

### Component: `components/map/national-map.tsx`

Client island mounted by `app/(data)/map/page.tsx`.

### Tile source

Default is **OpenFreeMap "liberty"** — a free, no-API-key vector style served
via Cloudflare CDN:

```ts
const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
```

**Why OpenFreeMap:**

- Free, no API key, served via Cloudflare — no IP blocking from Vercel's AWS.
- Complete `style.json` including tiles, glyphs and sprites.
- Our data layers are circle-only so no extra symbol layers are needed.

**Emergency fallback** — a minimal inline `StyleSpecification` with only a
`background` layer (`#e8e6df`). No external tile dependency. Used when the
primary style fails to load or times out after 8 s.

**Override** — operators can set `NEXT_PUBLIC_MAPLIBRE_TILES_URL` to any
MapLibre-compatible style.json URL. That URL is tried first; on failure the
code falls back through: operator override → OpenFreeMap → inline background.

**History:** The map went through three tile providers before settling on
OpenFreeMap. Carto raster was the original default but their CDN blocks
requests from Vercel's AWS IP ranges. Esri World_Light_Gray_Canvas was tried
next but the service was retired (404). OpenFreeMap has worked reliably.

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
  const map = new maplibregl.Map({ container, style: OPENFREEMAP_STYLE_URL, … });
  // Watchdog: if style hasn't loaded in 8 s, swap to inline fallback style
  // Resize on next animation frame (Tailwind calc() can resolve a tick late)

  // map.once("load") — fires exactly once for the initial style.
  // applyFallback registers its own map.once("load", addDataLayers) before
  // calling setStyle(FALLBACK_STYLE) so fallback loads re-attach layers cleanly.
  map.once("load", async () => {
    const data = await fetch("/api/map").then(r => r.json());
    addDataLayers(); // idempotent: getLayer/getSource guards before add
    setLoading(false);
  });
}, []);
```

### Critical pitfall: `map.on("load")` vs `map.once("load")`

**`map.on("load")` fires again after every `setStyle()` call.** If you use the
persistent form and your fallback logic calls `setStyle()`, a second `load`
fires. Any `addSource`/`addLayer` calls in that second invocation throw because
the source/layers already exist. MapLibre catches these as error events, not JS
exceptions — so try/catch doesn't help. The result: the canvas stays blank
with no visible error.

**Always use `map.once("load")` for the initial data-layer setup.** For
fallback style reloads, register a second `map.once("load", addDataLayers)`
*before* calling `setStyle()` so it runs once when the fallback is ready.

**Use `map.getLayer` / `map.getSource` guards** instead of try/catch when
cleaning up layers before re-adding. MapLibre fires error events for
removeLayer/removeSource on non-existing items — those events hit `map.on("error")`
and can confuse the style-loaded state checks.

### Ten reasons the map can fail (and how it currently handles each)

| Symptom | Cause | What now happens |
| --- | --- | --- |
| Empty gray map | Style.json fetch hung | 8 s watchdog → swap to inline background fallback |
| Empty gray map | Tile URL blocked by network | OpenFreeMap (Cloudflare CDN) not blocked from Vercel; if needed, set override env var |
| Empty gray map | WebGL disabled in browser | Loading overlay stays; user sees no map. Acceptable. |
| Map area is 0px tall | Tailwind calc() resolved late | `requestAnimationFrame(() => map.resize())` after init |
| `addLayer` throws on cluster-count | Symbol layer needs `glyphs` | Layer removed; size encoded by circle radius |
| `/api/map` 500 | DB read failed | Try/catch in route handler returns empty `FeatureCollection` |
| Stale GeoJSON after data change | Cache | Push an empty commit to redeploy and bust the edge cache |
| Mobile filter panel overlaps map | Old layout | Now a button + drop-down sheet on `<sm` |
| 14000 markers eats CPU on phone | Too many features | Cluster radius 50px, max-zoom 12; client throttles fine at 3K |
| iOS Safari zoom on focus | Input < 16px | Search input now `text-base` (16px) on mobile |

### Adding a different basemap

Set `NEXT_PUBLIC_MAPLIBRE_TILES_URL` on Vercel to any MapLibre-compatible
style.json URL:

- MapTiler: `https://api.maptiler.com/maps/streets-v2/style.json?key=YOUR_KEY`
- Protomaps: a self-hosted PMTiles style URL
- Stadia: their style URL with your key
- OpenFreeMap (alternate style): `https://tiles.openfreemap.org/styles/positron`

If the override fails to load within 8 s, the inline background fallback kicks
in automatically and yard dots still render.

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
