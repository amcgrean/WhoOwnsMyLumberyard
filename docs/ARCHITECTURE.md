# Architecture

How the system is laid out, what each piece does, and why we picked it.

---

## Stack at a glance

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser                                                         │
│  Next.js 16 RSC + small "use client" islands                     │
└──────────────────────────────────────────────────────────────────┘
                          │
                          │   HTTP
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  Vercel — Next.js server functions                               │
│  ─ /api/map    GeoJSON for the national map (ISR cached)         │
│  ─ /api/search FTS + ILIKE fallback                              │
│  ─ /api/submit POST handler, writes to `submissions` + Resend    │
│  ─ /api/og/*   Dynamic OG images (next/og)                       │
│  ─ Page handlers for /, /yard, /company, /owner, /state, etc.    │
└──────────────────────────────────────────────────────────────────┘
                          │
                          │   Drizzle (HTTP driver)
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  Neon Postgres                                                   │
│  ─ companies, locations, ownership_edges, acquisitions           │
│  ─ sources, claim_sources, people, submissions                   │
│  ─ FTS via to_tsvector + GIN indexes                             │
└──────────────────────────────────────────────────────────────────┘
```

---

## Why these choices

### Next.js App Router + RSC

- Most pages read from Postgres and render — **Server Components** keep the
  DB-touching code on the server, no client roundtrip.
- The few interactive pieces (search bar, map, submit form) are tiny
  `"use client"` islands with explicit boundaries.
- App Router gives us dynamic OG images via `next/og`, generated sitemap,
  and `generateStaticParams` for state pages — all without extra deps.
- Hosting on Vercel means we get edge + node runtimes, ISR, and Speed
  Insights with zero config.

### Drizzle ORM + Neon HTTP driver

- Drizzle's schema-as-types means component props get full DB types end-to-end.
- The Neon HTTP driver works in **both edge and node** runtimes — we can move
  any route between runtimes without rewriting DB code.
- Alternative was Prisma; rejected because of cold-start cost on serverless and
  worse type ergonomics in 2026.

### Tailwind v4 + shadcn/ui

- Editorial visual: neutral palette, Source Serif 4 for headlines, system sans
  for UI. Designed to feel closer to ProPublica/Bloomberg than a SaaS landing.
- shadcn primitives are vendored on demand (we only have what we use). No
  bundled component library cost.

### MapLibre GL JS

- WebGL-based, no API key required if you self-host or use free public tile
  CDNs (Carto, OSM).
- Vendor-neutral: open-source fork of mapbox-gl-js. We can swap to MapTiler,
  Protomaps, or Stadia by setting `NEXT_PUBLIC_MAPLIBRE_TILES_URL`.
- We default to **inline raster style with Carto's basemap CDN** — no
  external `style.json` fetch, no third-party sprite/glyph dependencies. See
  `docs/MAP_AND_SEARCH.md` for the long history of map fixes.

### Postgres FTS instead of Algolia / Meilisearch

- The dataset is ~3K yards + 157 companies. FTS handles this in single-digit
  ms. No reason to add another service.
- We use a `to_tsvector('english', …)` GIN index on companies and locations,
  and `websearch_to_tsquery` for parsing user input.
- ILIKE fallback when FTS comes up empty (e.g. for brand names with slashes
  that the english tokenizer doesn't split cleanly).

### Resend for submission emails

- Single-purpose, low-volume email. Cheaper than SES setup.
- Works on edge runtime if needed.

---

## Repo layout

```
/app
  /(marketing)/page.tsx                 — Homepage with stats + search
  /(marketing)/about/page.tsx
  /(marketing)/methodology/page.tsx
  /(marketing)/submit/page.tsx
  /(data)/yard/[slug]/page.tsx          — Yard detail w/ ownership chain
  /(data)/company/[slug]/page.tsx       — Company detail
  /(data)/owner/[slug]/page.tsx         — PE / public / family-office detail
  /(data)/state/[state]/page.tsx        — SEO state page
  /(data)/map/page.tsx                  — National map shell
  /(data)/search/page.tsx               — Search results
  /api/map/route.ts                     — GeoJSON FeatureCollection
  /api/search/route.ts                  — JSON results for client-side use
  /api/submit/route.ts                  — Correction submission (Resend)
  /api/og/[type]/[slug]/route.tsx       — Dynamic OG images
  /sitemap.ts                           — Machine-generated sitemap
  /robots.ts                            — robots.txt
  /not-found.tsx
  /layout.tsx                           — Root layout, fonts, header/footer
  /globals.css                          — Tailwind + design tokens

/components
  /map/national-map.tsx                 — Client island wrapping MapLibre
  /ownership-chain.tsx                  — Server-rendered chain visual
  /ownership-badge.tsx                  — Color-coded ownership pill
  /citation.tsx                         — Numbered superscripts + footnotes
  /location-card.tsx                    — Reusable yard card
  /search-bar.tsx                       — Client search input
  /submit-form.tsx                      — Correction form (RHF + Zod)
  /site-header.tsx, /site-footer.tsx    — Shared chrome
  /mobile-nav.tsx                       — Mobile drawer client island

/lib
  /db/schema.ts                         — Drizzle table defs (single source of truth)
  /db/index.ts                          — Drizzle client (Neon HTTP driver)
  /constants.ts                         — Site name, badge labels, US states
  /utils.ts                             — cn(), small helpers
  /slug.ts                              — slugify() + locationSlug()
  /search.ts                            — searchAll() (FTS + zip + ILIKE)
  /ownership-graph.ts                   — getOwnershipChain, classifyOwnership, ultimateOwner
  /queries/companies.ts                 — getCompanyBySlug, locations-for-company
  /queries/locations.ts                 — getLocationBySlug, getNearbyLocations (haversine)
  /queries/sources.ts                   — getCitedSources for footnote rendering

/scripts
  /seed/                                — Idempotent seed scripts (one per consolidator)
  /seed/_helpers.ts                     — upsertCompany, upsertEdge, etc.
  /seed/index.ts                        — Entry point: pnpm seed
  /scrapers/                            — One file per consolidator's locator
  /scrapers/_base.ts                    — Rate limiter, ScrapedLocation type, writeScrape
  /scrapers/TODO.md                     — Locator URLs for unbuilt scrapers
  /import-scraped.ts                    — Read a scrape JSON, upsert into DB
  /import-google-places.ts              — Places API enrichment
  /geocode-missing.ts                   — Geocoding API backfill
  /cleanup-uslbm-brands.ts              — One-off rename script

/drizzle                                — Generated migrations (do not hand-edit)
/data/sources.json                      — Curated list of primary source URLs
/data/scraped/                          — Per-consolidator JSON dumps (gitignored)
```

---

## Data flow: from scrape to page

1. **Scrape**: `pnpm scrape:<name>` hits the consolidator's locator and writes
   `data/scraped/<name>-YYYY-MM-DD.json`.
2. **Seed companies**: `pnpm seed` is idempotent and creates the parent
   consolidator + any pre-known sub-brand companies + ownership edges with
   sources. Re-run safely after every change.
3. **Import yards**: `pnpm import:scraped <file>` upserts each row. If a row
   carries `operatingCompanySlug` and the file declares `autoCreateChildrenOf`,
   the importer auto-creates new yard companies as children of the parent
   consolidator (with sourced edges).
4. **Geocode (if needed)**: `pnpm geocode:missing` fills in any null lat/lng
   via Google Geocoding API (10K free per month).
5. **Render**: pages query Drizzle in RSCs and stream HTML. The map fetches
   `/api/map` after hydration.

See `docs/SCRAPERS.md` for per-scraper details and `docs/OPERATIONS.md` for
the runbooks.

---

## Caching strategy

| Path | Strategy | Notes |
| --- | --- | --- |
| `/api/map` | `Cache-Control: public, s-maxage=600, swr=86400` + ISR | Edge serves stale while a background fetch refreshes |
| `/`, `/state/*`, `/yard/*`, `/company/*`, `/owner/*` | Next.js ISR `revalidate = 600` | Pages re-render every 10 minutes server-side |
| `/api/search`, `/api/submit` | Dynamic, no cache | Per-user query / writes |
| Static assets, OG images | Vercel default | OG images cached on the edge |

When the seed/import pipeline writes new yards, you can wait the 10 minutes
or push an empty commit to trigger a fresh deploy that invalidates the cache.

---

## Editorial conventions baked into code

- `companies.type` enum carves the world into seven bins. Pick one carefully
  when seeding new companies. See `docs/DATA_MODEL.md`.
- `ownership_edges.relationship` enum has 5 values:
  `owns | controls | member_of | franchise_of | subsidiary_of`. Use
  `member_of` for co-op relationships, `subsidiary_of` for owned operating
  brands, `controls` for PE majority stakes.
- `ownership_edges.verified` defaults `false`. Operator flips after re-reading
  each linked source. Don't set this from a scraper.
- Every `upsertEdge` / `upsertAcquisition` accepts a `sources: string[]` of
  URLs. Always pass them.
