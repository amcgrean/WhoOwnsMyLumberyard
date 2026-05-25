# Handoff prompt — next agent

This doc is the **system prompt** for the next Claude Code agent picking up
**Who Owns My Lumberyard**. Read this first, then dive into the rest of
`docs/` for depth.

---

## Project in one paragraph

**WhoOwnsMyLumberyard** is a public, journalism-grade database that maps the
ownership of every consolidated U.S. lumberyard / building-materials dealer.
Search any yard by zip / business / city → see the full ownership chain from
the brand on the sign up to the ultimate owner (a public company, PE firm,
co-op, family office, or independent operator). Every ownership claim links
to a public source URL. The site does not editorialize.

The site lives at **`who-owns-my-lumberyard.vercel.app`** and the repo is
**`amcgrean/WhoOwnsMyLumberyard`**. Default branch is `main`.

All recent feature branches have been merged. Future agents should use a new
descriptive branch name per task (`claude/<short-task-slug>`) and open PRs
against `main`.

---

## What just happened (most recent sessions, May 2026)

**PRs #17–21 — map fixes + Beacon scraper rewrite (all merged to `main`):**

- **PR #17** — fixed `ultimateOwner` skipping `member_of` edges (co-op
  members were showing wrong ownership badge).
- **PR #18** — rewrote `scripts/scrapers/beacon.ts` from a Playwright stub
  (0 rows headlessly) to a direct REST grid sweep against Beacon's internal
  API (`beacon-ng.becn.com/v1/store-location`). ~539 unique US locations.
  Also attempted Esri basemap for the map (retired service, also blank).
- **PR #19** — switched map basemap to OpenFreeMap "liberty" vector style
  (free, no API key, Cloudflare CDN — no IP blocking from Vercel).
- **PRs #20–21** — fixed the blank map canvas. Root cause: `map.on("load")`
  is a persistent listener that fires again after `setStyle()`. When the
  fallback style swapped in, a second `load` fired, `addSource("yards")`
  threw (source already existed), error was caught silently, canvas stayed
  blank. Fix: `map.once("load")` for initial load; `applyFallback` registers
  its own `map.once("load", addDataLayers)` before calling `setStyle()`;
  `addDataLayers` uses `getLayer`/`getSource` guards instead of try/catch.
  Added verbose `[map]` console logging for future diagnosis.

**LMC + Do it Best co-op import (already done, in `main`):**

- ~1,715 LMC member dealers + ~1,392 Do it Best lumber members imported.
- DB now at ~**5,972 locations** (up from 2,945 before).
- `member_of` edges (not `subsidiary_of`) — co-op membership ≠ ownership.

---

## Where the project is right now

### Database state (Neon Postgres, `neondb`)

- **~5,972 locations** across all 50 states; majority geocoded
- **Companies** — 5 large consolidators (BFS, US LBM, Carter, ABC, 84 Lumber),
  Beacon Building Products (QXO), GMS Inc., Boise Cascade, 60+ US LBM legacy
  banners, 10 SRS sub-brands, 56 GMS sub-brands, 5 Carter family brands,
  Beacon sub-brands (Heartland etc.), LMC + Do it Best co-ops + ~3,000+
  co-op member companies
- **Ownership edges** — `subsidiary_of` for consolidator-owned; `member_of`
  for co-op members. All with `verified: false` pending operator review.
- See `docs/DATA_MODEL.md` for schema details

### Tech stack

- **Next.js 16.2.4** (App Router, RSC by default), React 19, TypeScript strict
- **Drizzle ORM 0.38** + **Neon serverless HTTP driver** — runs on edge or node
- **Tailwind CSS v4** + shadcn/ui primitives + lucide-react icons
- **MapLibre GL JS 4.7** — default basemap is **OpenFreeMap "liberty"** (free
  vector tiles, no API key, Cloudflare CDN)
- **Postgres FTS** + ILIKE fallback for search
- **React Hook Form + Zod** for forms
- **Resend** for correction-submission emails
- **Vercel Analytics + Speed Insights**
- **pnpm 10**, **Node 24** (`.nvmrc`), running on Vercel
- See `docs/ARCHITECTURE.md` for why each piece was chosen and how they fit

### Pages live

| Route | What it does |
| --- | --- |
| `/` | Homepage with live stats + search |
| `/yard/[slug]` | Yard detail with `OwnershipChain` + sources + nearby yards |
| `/company/[slug]` | Operating-brand / consolidator detail |
| `/owner/[slug]` | PE / public / family-office detail with aggregate stats |
| `/state/[state]` | State landing page; SEO play |
| `/map` | National MapLibre map + sortable yard table view |
| `/search?q=…` | Combined search results |
| `/about`, `/methodology`, `/submit` | Editorial pages |
| `/api/map`, `/api/search`, `/api/submit`, `/api/og/[type]/[slug]` | API + OG |
| `/sitemap.xml`, `/robots.txt`, `/not-found` | Standard infra |

### What's working

- Whole site builds, deploys, renders.
- Search (FTS + ILIKE fallback + zip prefix fallback).
- Map with clustered markers (OpenFreeMap vector default) + sortable table view.
- Ownership chain renders with citation superscripts.
- Submission form posts via Resend.
- Geocoder backfills missing lat/lng (Google Geocoding API, env var `MAPS_API`).
- 11 scrapers: BFS, Carter family, US LBM, 84 Lumber, ABC, SRS, GMS,
  Boise Cascade, Beacon, LMC (co-op), Do it Best (co-op).

### What's broken / deferred

These are kept on a "later passes" list rather than the active todo:

1. **Map blank canvas (under investigation)** — PR #21 added verbose `[map]`
   console logging. The map shows "Showing 5,972 yards" but the canvas stays
   blank. Need a screenshot of DevTools console from the preview to diagnose
   further.
2. **L&W Supply / ABC Supply Interiors** — locator markers don't expose ZIP.
   Either fetch each of the 276 detail pages or change `locations.zip` to
   nullable in the schema.
3. **Remaining consolidators** — Foundation BM, Kodiak BP, Foxworth-Galbraith,
   Parr Lumber, Russin, Reeb, Holmes standalone. URLs in `scripts/scrapers/TODO.md`.
4. **Other co-ops** — ENAP (DNS unreachable from sandbox), LBM Advantage
   (Elementor widget), NLBMDA (members-only). Notes in `docs/INDEPENDENT_YARDS.md`.
5. **Google Places enrichment** for true independents not in any co-op.
   Script ready (`scripts/import-google-places.ts`); no sweep run yet.
6. **Verifying ownership edges.** Every edge has `verified: false`.
   Operator should re-read each linked source and flip individually.
7. **Roll-up by ultimate owner** on state pages (so US LBM legacy banners
   count toward "US LBM" in state leaderboards rather than fragmenting).
8. **Comparison pages** ("BFS vs US LBM"), newsletter, advanced map filters
   (year acquired, deal size).

---

## Editorial guardrails — read before writing data code

- **Every ownership claim must have a source URL.** The schema enforces this
  through `claim_sources`. The UI surfaces sources as numbered superscripts.
- **Never editorialize.** Stick to "X owns Y, here is the press release." No
  adjectives like "predatory" or "extractive." The data tells the story.
- **Do not invent facts.** Where an ownership detail is uncertain, leave the
  row out of the seed and note it as a TODO. Accuracy outranks completeness.
- **Idempotent seeds.** Seed scripts must be safe to re-run. Use upsert
  semantics keyed on slug. The `_helpers.ts` upsert functions take care of this.
- **Sources are first-class.** Pass URLs into `upsertEdge`, `upsertAcquisition`,
  and `linkSource`. Don't just put them in code comments.
- **`member_of` ≠ `subsidiary_of`.** Co-op membership doesn't transfer
  ownership. Co-op scrapers must use `autoCreateRelationship: "member_of"`.
  `classifyOwnership()` already renders these as the purple "Co-op Member"
  badge.

---

## Working agreements with the operator

- **The operator works in the LBM industry at an independent yard.** This is
  disclosed on `/about`. Stay neutral in code comments and copy.
- **Open a feature branch and PR against `main`.** Don't push to `main`
  directly. Branch names: `claude/<short-task-slug>` is the convention.
- **Vercel auto-deploys** on PR merge. Production URL is auth-walled —
  external testing is limited to the operator's browser session.
- **Use `MAPS_API` (not `GOOGLE_PLACES_API_KEY`) for the env var name.** Both
  work via fallback, but `MAPS_API` matches what's set in Vercel.
- **Stay under the 10K free monthly Geocoding API quota.** The `geocode:missing`
  script caps with `--max`. Roughly: do not run more than ~9K addresses per
  calendar month without checking with the operator.
- **Smoke-test scrapers with `--dry-run --limit 5`** before any full run.

---

## How to make changes

### A typical session looks like this

1. `git checkout main && git pull`
2. `git checkout -B claude/<short-task-slug>`
3. `pnpm install` if you haven't recently
4. Make changes
5. `pnpm typecheck` and `pnpm lint` — both must pass
6. If touching the schema: `pnpm db:generate` to create a new migration; do
   NOT hand-edit the generated SQL. Apply with `pnpm db:migrate` against the
   production Neon URL.
7. If touching scraping or imports: smoke-test with `--dry-run --limit 5`
   before a full run.
8. `git commit -m "…"` and `git push -u origin <branch>`
9. Open a PR via the GitHub MCP — don't draft, set ready for review.

### Common scripts

```bash
pnpm dev                                 # local dev
pnpm typecheck && pnpm lint              # pre-commit checks
pnpm seed                                # idempotent re-seed of consolidators

# Scrapers (consolidators):
pnpm scrape:bfs         # Builders FirstSource
pnpm scrape:carter      # Carter Lumber + family of brands
pnpm scrape:uslbm       # US LBM (auto-creates 60+ legacy banners)
pnpm scrape:84          # 84 Lumber
pnpm scrape:abc         # ABC Supply
pnpm scrape:srs         # SRS Distribution + sub-brands
pnpm scrape:gms         # GMS Inc. + 56 sub-brands
pnpm scrape:boise       # Boise Cascade
pnpm scrape:beacon      # Beacon Building Products (~539 locations, REST grid sweep)

# Scrapers (co-ops, member_of edges):
pnpm scrape:lmc         # LMC member dealers
pnpm scrape:dib         # Do it Best (lumber + home-center, default)

pnpm import:scraped <path-to-json>       # import a scrape file
pnpm geocode:missing --max 100 --dry-run # sample, then drop --dry-run
pnpm db:studio                           # browse the DB
```

---

## Pointers

- `docs/README.md` — index of these docs in recommended read order
- `docs/ARCHITECTURE.md` — why the stack is what it is, how files fit
- `docs/DATA_MODEL.md` — schema, ownership graph, citation flow
- `docs/SCRAPERS.md` — patterns each scraper uses, gotchas
- `docs/OPERATIONS.md` — run-books for seed, scrape, geocode, deploy
- `docs/MAP_AND_SEARCH.md` — the two features with the most production-bug
  iterations; details the recurring pitfalls
- `docs/INDEPENDENT_YARDS.md` — strategy + run book for the LMC/DiB phase
- `scripts/scrapers/TODO.md` — locator URLs for the deferred consolidators
- `data/sources.json` — curated set of canonical primary-source URLs

---

## What to do if you find a bug

The codebase has had four classes of bugs that recurred. Look for them first
when something breaks:

1. **Drizzle alias-in-orderBy.** Inline expressions in `ORDER BY` rather than
   referencing the SELECT alias — Postgres + Drizzle's identifier quoting
   make alias resolution unreliable. See `lib/search.ts` and
   `lib/queries/locations.ts` for the pattern.
2. **Drizzle parameterizes JS numbers as int4.** If you pass a float (like
   3958.8 for earth radius in miles) it gets rejected. Inline the float in
   the SQL string and cast lat/lng parameters to `::float8`.
3. **MapLibre style requirements.** Symbol layers (text labels) require a
   `glyphs` URL in the style. The default inline raster style doesn't include
   one — don't add symbol layers or use HTML markers instead.
4. **ESM hoisting.** Top-level `import "dotenv/config"` runs *after*
   transitive imports of modules that read `process.env`. We use
   `--env-file=.env.local` (Node 22+) to side-step this for tsx scripts.

---

## Operator's stated next priorities

1. **Diagnose blank map canvas.** PR #21 merged with verbose `[map]` console
   logging. Load the preview (or production), open DevTools Console, share the
   `[map]` log output. The logging covers: style URL, `load` event firing,
   fetch status, feature count, `addDataLayers` call, and final layer list.
2. **Run Beacon full scrape + import** once the map is confirmed working:
   ```bash
   pnpm scrape:beacon
   pnpm import:scraped data/scraped/beacon-<date>.json
   pnpm geocode:missing --max 500
   ```
3. **Investigate ENAP / LBM Advantage / NLBMDA on PC** for further co-op
   coverage where the sandbox couldn't reach them.
4. After co-op coverage is exhausted, **run a Google Places sweep** for
   true-independent yards in target states. Stay under 10K free monthly quota.

If unsure about a direction, ask the operator before anything that
spends Geocoding API budget or creates new top-level abstractions.
