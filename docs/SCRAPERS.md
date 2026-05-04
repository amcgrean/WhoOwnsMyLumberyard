# Scrapers

Each scraper writes a JSON file into `data/scraped/` that is then consumed by
`scripts/import-scraped.ts`. They share a tiny framework in
`scripts/scrapers/_base.ts` and follow a small set of patterns.

---

## Patterns observed across consolidator locators

1. **Static directory + per-page parse.** A site lists every branch URL on a
   single page (or sitemap), and each detail page exposes structured fields.
   Parse with `cheerio`.
   - Examples: **BFS** (`/location/all-locations` + per-detail `data-lat`/`data-lng`),
     **SRS** (sitemap.xml + JSON-LD on each detail page).

2. **Public REST/GraphQL endpoint.** A WordPress / Umbraco / dotCMS site
   exposes the locator data as JSON, often via wp-json or admin-ajax.
   - Examples: **ABC Supply** (`wp-json/abcsupply-api/v1/locations`),
     **Carter Lumber** (`/api/content/_search` dotCMS),
     **84 Lumber** (`/umbraco/surface/StoreSupport/StoreSearch`),
     **Boise Cascade** (`wp-admin/admin-ajax.php?action=asl_load_stores`).

3. **WP Grid Builder paginated HTML.** The grid renders as HTML, paginated by
   query param.
   - Examples: **US LBM** (`/about/locations/?_pager=N` for N=1..24).

4. **Inline data via `__NEXT_DATA__`.** A Next.js SPA embeds the dataset as
   props in a `<script id="__NEXT_DATA__">` tag in the HTML.
   - Examples: **GMS Inc.** (`/find-a-yard` with Contentful entries).

5. **Dynamic JS chunks (deferred).** A modern Next.js / React SPA fetches data
   via XHR and stores it in JS chunks rather than embedding it.
   - **Beacon** (post-QXO redesign). Requires Playwright XHR sniff. See TODO.

---

## File-by-file

### `scripts/scrapers/_base.ts`

Shared utilities:

- `ScrapedLocation` — shape every scraper outputs
- `ScrapeOutput` — file-level wrapper with `consolidator`, optional
  `autoCreateChildrenOf` and `autoCreateSourceUrl`
- `RateLimiter` — minimum interval between requests
- `parseCliArgs()` — `--dry-run`, `--limit N`, `--interval MS`
- `writeScrape(slug, rows, opts, extra?)` — emits `data/scraped/<slug>-DATE.json`

### `builders-firstsource.ts`

Static directory at `bldr.com/location/all-locations`. For each leaf URL,
fetch the detail page and parse:

- `<h1>` → display name
- `.address a.placeLink` href has `/maps/place/STREET,CITY,STATE,ZIP/` —
  cleanest structured parse
- `.phone a[href^="tel:"]` → phone
- `data-lat` / `data-lng` → coords

606 URLs found, ~603 parsed. ~750 ms/req with custom UA.

### `carter-lumber.ts`

dotCMS REST endpoint:

```
POST https://www.carterlumber.com/api/content/_search
{ "query": "+contentType:Location", "sort": "modDate", "limit": -1 }
```

One call returns 225 records with full lat/lng/phone/address. The
`storeType1` enum on each record maps to one of five brand slugs (Carter
Lumber, Holmes, Kight, Kempsville, Townsend) — see `brandSlugFor()`.

### `us-lbm.ts`

WP Grid Builder pagination:

```
GET https://uslbm.com/about/locations/?_pager=N    (N=1..24)
```

Each card has an inline modal with the data. Per-row brand identity comes
from the **first external https link** inside the modal (e.g. `meeks.com` →
Meek's Lumber). Hostname → `(name, slug)` lookup is curated in `KNOWN_BRANDS`
for the top ~50 banners; unknowns fall back to a slugified domain stem and
should be cleaned up after import.

The city-line parser is intentionally tolerant — US LBM data is messy
(`"TEXAS 79915"`, `"NJ 8232"` with dropped leading zero, `"OK, Seminole"`
with reversed order). See `parseCityLine()` for the rules.

### `eighty-four-lumber.ts`

One Umbraco surface controller call:

```
GET https://www.84lumber.com/umbraco/surface/StoreSupport/StoreSearch
    ?radius=3000&storeId=null&latitude=39.8&longitude=-98.6
```

Returns a JSON-encoded string (double-encoded JSON) of every retail store
with full lat/lng/phone/address/division. We filter to `IsRetailStore=true`
+ `Status=Published` and normalize the inconsistent `Division` field
(typos, mixed case) into a `region:southeast`/`region:central`/etc tag in
the services array.

### `abc-supply.ts`

Public WP REST route:

```
GET https://www.abcsupply.com/wp-json/abcsupply-api/v1/locations
```

718 records — 694 US (`storefront=abc`), 24 Canadian (`storefront=cbc`). We
filter to US ABC-branded only for v1.

ABC's site rejects most non-browser UAs on the page paths but the wp-json
route is permissive. We still send a realistic browser UA.

### `srs-distribution.ts`

Sitemap-driven:

1. Fetch `https://www.srsdistribution.com/sitemap.xml` (one giant inline
   sitemap, all branches in one file).
2. Filter to `/en/markets/our-brands/<brand-slug>/<branch-slug>/` URLs.
3. For each (449 of them), fetch and parse JSON-LD:
   - `PostalAddress` → street/city/state/zip
   - `GeoCoordinates` → lat/lng
   - `telephone`

The brand slug from the URL maps to a hand-curated `BRAND_NAMES` table; the
importer auto-creates 10 SRS sub-brand companies on first run.

### `gms.ts`

Hits `https://gms.com/find-a-yard` (4.5MB HTML). Extracts
`__NEXT_DATA__.props.pageProps.companies` — 73 Contentful `company` entries,
each with a `locations` array. Each location carries `street1`, `city`,
`region.fields.name`, `postalCode`, `phone`, `coordinates {lat, lon}`.

Brand identity comes directly from `company.fields.name` — no hostname
heuristics. `region.fields.name` is filtered to US 2-letter codes (Canadian
provinces are dropped silently). 56 distinct US sub-brands result.

### `boise-cascade.ts`

Awesome Store Locator admin-ajax:

```
POST https://www.bc.com/wp-admin/admin-ajax.php
action=asl_load_stores&load_all=1
```

Returns 158 entries that mix BC-owned facilities with independent dealer
locations. We filter to BC-owned only by title:

- `title.startsWith("Boise Cascade")` → BMD distribution branches
- `title.endsWith(" EWP")` → Engineered Wood Products plants

Some sites appear under multiple ASL category sets, so we dedupe by
`(street, city, state)`. Result: 52 unique facilities across 39 states.

---

## Adding a new scraper

1. **Investigate first.** Try, in order:
   1. `curl /sitemap.xml` — a static branch list often lives there
   2. `curl /<their locator path>` — look for `application/ld+json`,
      `__NEXT_DATA__`, `window.<X> = …`, or any obvious endpoint
   3. View-source on the locator page and grep for `wp-json`, `/api/`,
      `admin-ajax.php`, `_pager=`, `wpgmza`, `searchstores`, `findstores`,
      `branchsearch`
   4. If nothing — Playwright XHR sniff is the last resort. **Defer** to
      the next agent.
2. **Pick a pattern from the list above** and copy a similar scraper as a
   starting point.
3. **Write to the same `ScrapedLocation` shape.** The importer will pick it
   up automatically.
4. **Wire `pnpm scrape:<slug>`** into `package.json` scripts.
5. **Smoke-test with `--dry-run --limit 5`**.
6. **Run full**, then `pnpm import:scraped data/scraped/<slug>-<date>.json`.
7. **If the consolidator has multiple owned brands**, set
   `autoCreateChildrenOf: "<parent-slug>"` and per-row
   `operatingCompanyName/Slug/Website` so the importer auto-creates them
   parented to the consolidator.

---

## When in doubt — what to defer

If a locator requires Playwright (DOM scraping, Google Maps API key
extraction, multi-step search) or a paid API key, **defer it**. Add a row
in `scripts/scrapers/TODO.md` with the locator URL and a 1-line note about
why it's hard. The next agent can pick it up.

The active scrapers cover ~3K yards across the largest consolidators and
public companies in the LBM industry. There are diminishing returns on
brittle scrapers for smaller players — a small Playwright pass once a
quarter is fine.
