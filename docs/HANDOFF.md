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

The current active feature branch is **`claude/independent-yards-scrapers`**
(PR #15, open, ready for the operator to run on PC). Past feature work has
shipped on **`claude/build-lumberyard-database-qMI1I`**. Future agents
should use a new descriptive branch name per task and open PRs against
`main`.

---

## What just happened (most recent session, May 4 2026)

**Open PR #15 — independent-yards scrapers** ready for operator to run on PC:

- `scripts/scrapers/lmc.ts` — POSTs `dealer_locator.php` with a wide-radius
  zip query, returns ~1,715 LMC member dealers in one call (no coords —
  geocode after).
- `scripts/scrapers/do-it-best.ts` — public GraphQL `storeLocator`, returns
  3,274 stores; we filter `member_status` to Lumber + Home Center for ~1,392
  members with full coords/phone. Skips pure-hardware unless
  `--include-hardware` passed.
- Importer extension: `ScrapeOutput.autoCreateRelationship` (default
  `subsidiary_of`); co-op scrapers set it to `member_of` because membership
  doesn't transfer ownership. `ensureParentEdge()` is idempotent on
  `(parent, child, relationship)` so a yard that's a member of multiple
  co-ops gets one edge per co-op without duplicates.
- `scripts/scrapers/beacon.ts` (Codex's stub from PR #14) hardened with
  `ignoreHTTPSErrors`, scroll triggers, and search-input probes. Runs
  end-to-end without crashing but returns 0 rows from a headless browser —
  needs interactive headful debug on PC to surface the location XHR.

**Recently merged (already in `main`):**

- PR #13 — comprehensive map + search + nearby-yards bug fixes, mobile
  responsive pass, slim `/api/map` payload, `docs/` reference set.
- PR #14 (Codex) — yard table view below the national map (first 500
  geocoded yards, A-Z by state/city/name), Beacon scraper stub.

**Operator's next action:** run the LMC + DiB sequence in
`docs/INDEPENDENT_YARDS.md` on PC after merging PR #15. Expected outcome:
DB roughly doubles to ~5,500 locations with ~3,000 new `member_of` edges.

---

## Where the project is right now (pre-LMC/DiB import)

### Database state (Neon Postgres, `neondb`)

- **2,945 locations** across 49 states, **100% geocoded**
- **157 companies** — 5 large consolidators (BFS, US LBM, Carter, ABC,
  84 Lumber), 4 public companies (BFS, GMS, Boise, Beacon-shell, +Home
  Depot), 60+ auto-created legacy US LBM banners, 10 SRS sub-brands,
  56 GMS sub-brands, 5 Carter family brands, 6 co-ops
- **141 ownership edges**, all with `verified: false` pending operator review
- See `docs/DATA_MODEL.md` for schema details

### Tech stack

- **Next.js 16.2.4** (App Router, RSC by default), React 19, TypeScript strict
- **Drizzle ORM 0.38** + **Neon serverless HTTP driver** — runs on edge or node
- **Tailwind CSS v4** + shadcn/ui primitives + lucide-react icons
- **MapLibre GL JS 4.7** with inline-style raster tiles from Carto's CDN
- **Postgres FTS** + ILIKE fallback for search
- **React Hook Form + Zod** for forms
- **Resend** for correction-submission emails
- **Vercel Analytics + Speed Insights**
- **pnpm 10**, **Node 24** (`.nvmrc`), running on Vercel
- **Playwright** (Chromium) for the Beacon scraper only — install once with
  `pnpm exec playwright install chromium`
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
- Map with clustered markers (Carto raster default) + sortable table view.
- Ownership chain renders with citation superscripts.
- Submission form posts via Resend.
- Geocoder backfills missing lat/lng (Google Geocoding API, env var `MAPS_API`).
- 8 scrapers cover BFS, Carter family, US LBM, 84 Lumber, ABC, SRS, GMS,
  Boise Cascade. Two more (LMC, Do it Best) ready to run on PR #15.

### What's broken / deferred

These are kept on a "later passes" list rather than the active todo:

1. **Beacon Building Products** — `scripts/scrapers/beacon.ts` runs end-to-end
   without crashing but returns 0 rows from a headless browser. The
   `qxo.com/find-a-store` SPA needs an interactive trigger (zip-search
   submission) to surface the location XHR. Debug headful on PC
   (`headless: false` in chromium.launch + open DevTools Network); once the
   right XHR is identified, hand-craft the request. ~30-60 min of work.
2. **L&W Supply / ABC Supply Interiors** — locator markers don't expose ZIP.
   Either fetch each of the 276 detail pages or change `locations.zip` to
   nullable in the schema.
3. **Remaining consolidators** — Foundation BM, Kodiak BP, Foxworth-Galbraith
   standalone, Parr Lumber, Russin, Reeb, Holmes Lumber standalone. Locator
   URLs catalogued in `scripts/scrapers/TODO.md`.
4. **Other co-ops** — ENAP (DNS unreachable from sandbox; investigate from
   PC), LBM Advantage (Elementor widget gates the locator), NLBMDA
   (members-only). Notes in `docs/INDEPENDENT_YARDS.md`.
5. **Google Places enrichment** for true independents not in any co-op.
   Script ready (`scripts/import-google-places.ts`); haven't run a sweep yet.
6. **Verifying ownership edges.** Every edge currently has `verified: false`.
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
pnpm scrape:beacon      # Beacon (Playwright; needs interactive debug)

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

## Operator's stated next priorities (last conversation)

1. **Run the LMC + DiB sequence on PC** once PR #15 merges. Sequence in
   `docs/INDEPENDENT_YARDS.md`. Expected: ~3,000 new `member_of` ownership
   edges, ~2,500–2,800 new yard companies, ~5,500 total locations.
2. **Debug Beacon headful** to surface the location XHR (~30-60 min) — would
   add ~580 more locations.
3. **Investigate ENAP / LBM Advantage / NLBMDA on PC** for further co-op
   coverage where the sandbox couldn't reach them.
4. After all co-op coverage is exhausted, **run a Google Places sweep** for
   true-independent yards in target states. Stay under the 10K free monthly
   Geocoding/Places quota.

If unsure about a direction, ask the operator before doing anything that
spends Geocoding API budget or creates new top-level abstractions.
