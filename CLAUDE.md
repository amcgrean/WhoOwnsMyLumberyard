# Working in this repo (agent notes)

## ⛔ Do NOT run paid Google APIs without explicit, per-run approval

The operator pays Google per call. **Never** run these unless the user explicitly
asks for that specific run, in that message:

- `pnpm import:places` — `scripts/import-google-places.ts` (Places API Text Search — **paid**)
- `scripts/enrich-imported.ts` — falls back to Place Details for older rows (**paid**)
- `scripts/backfill-place-detail.ts` — Place Details per business (**paid**)
- `pnpm geocode:missing` — `scripts/geocode-missing.ts` (Geocoding API — **paid**)

Any script that reads `MAPS_API` / `GOOGLE_PLACES_API_KEY` or hits
`places.googleapis.com` / `maps.googleapis.com` is paid. Assume paid unless
proven otherwise, and confirm cost + get an explicit "yes, run it" first.
"Keep expanding" / "get more data" is **not** blanket approval to spend on the
Google APIs — ask each time.

**Free** and fine to run without asking: the DB (Neon), `pnpm import:osm`
(`scripts/import-overpass.ts` — OpenStreetMap/Overpass, no key, ODbL open data),
`scripts/scrape-websites.ts` (plain HTTP fetches of business homepages — no
Google API), `enrich-imported.ts` (no longer calls Place Details), typecheck/
lint/build, and the seed scripts.

The app's map is powered by MapLibre + OpenFreeMap (OSM) tiles, **not** Google —
the Google `MAPS_API` key is only ever used by the paid import/geocode scripts,
so turning that key off does not affect the running app.

## Ownership modeling reminders

- `member_of` edges are **co-op membership, not ownership**. Exclude them from any
  "owned / consolidated" computation (map dots, ownership tags, "% consolidated").
  Co-op members (LMC, Do it Best, Nexstar, etc.) are independently owned.
- Bulk Google-Places imports land under the `unverified-independent` company, then
  `enrich-imported.ts` promotes each to its own Independent company. "Independent"
  means *no PE owner on the public record* — not individually hand-verified.
