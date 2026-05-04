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
**`amcgrean/WhoOwnsMyLumberyard`**. Default branch is `main`; feature work
goes on `claude/build-lumberyard-database-qMI1I` and merges via PRs.

---

## Where the project is right now

### Database state (Neon Postgres, `neondb`)

- **2,945 locations** across 49 states, **100% geocoded**
- **157 companies** — 5 large consolidators (BFS, US LBM, Carter, ABC, 84 Lumber),
  3 public companies (BFS, GMS, Boise, Beacon-shell), 60+ auto-created legacy
  US LBM banners, 10 SRS sub-brands, 56 GMS sub-brands, 5 Carter family brands
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
- See `docs/ARCHITECTURE.md` for why each piece was chosen and how they fit

### Pages live

| Route | What it does |
| --- | --- |
| `/` | Homepage with live stats + search |
| `/yard/[slug]` | Yard detail with `OwnershipChain` + sources + nearby yards |
| `/company/[slug]` | Operating-brand / consolidator detail |
| `/owner/[slug]` | PE / public / family-office detail with aggregate stats |
| `/state/[state]` | State landing page; SEO play |
| `/map` | National MapLibre map with cluster + filter |
| `/search?q=…` | Combined search results |
| `/about`, `/methodology`, `/submit` | Editorial pages |
| `/api/map`, `/api/search`, `/api/submit`, `/api/og/[type]/[slug]` | API + OG |
| `/sitemap.xml`, `/robots.txt`, `/not-found` | Standard infra |

### What's working

- Whole site builds, deploys, renders.
- Search (FTS + ILIKE fallback + zip prefix fallback).
- Map with clustered markers, all 2,945 yards visible.
- Ownership chain renders with citation superscripts.
- Submission form posts via Resend.
- Geocoder backfills missing lat/lng.
- 7 scrapers cover BFS, Carter family, US LBM, 84 Lumber, ABC, SRS, GMS, Boise Cascade.

### What's broken / deferred

These are kept on a "later passes" list rather than the active todo:

1. **Beacon Building Products** — post-QXO acquisition (April 2025) the
   `becn.com` locator redirects to `qxo.com/find-a-store`, which is a Next.js
   SPA whose data lives behind dynamic JS chunks rather than a stable static
   API. Needs Playwright + XHR sniff or `/_next/data` introspection.
2. **L&W Supply / ABC Supply Interiors** — locator markers don't expose ZIP.
   Either fetch each of the 276 detail pages or change `locations.zip` to
   nullable in the schema.
3. **Remaining consolidators** — Foundation BM, Kodiak BP, Foxworth-Galbraith
   standalone, Parr Lumber, Russin, Reeb, Holmes Lumber standalone. Locator
   URLs catalogued in `scripts/scrapers/TODO.md`.
4. **Google Places enrichment** for independent yards. Script is in
   `scripts/import-google-places.ts`, env var is wired (`MAPS_API`), but no
   sweep has been run yet.
5. **Verifying ownership edges.** Every edge currently has `verified: false`.
   Operator should re-read each linked source and flip individually.
6. **Roll-up by ultimate owner** on state pages (so US LBM legacy banners count
   toward "US LBM" in state leaderboards rather than fragmenting).
7. **Comparison pages** ("BFS vs US LBM"), newsletter, advanced map filters
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

---

## Working agreements with the operator

- **The operator works in the LBM industry at an independent yard.** This is
  disclosed on `/about`. Stay neutral in code comments and copy.
- **Push to `claude/build-lumberyard-database-qMI1I`, open a PR against `main`.**
  Don't push to `main` directly.
- **Vercel auto-deploys** on PR merge. Production URL is auth-walled —
  external testing is limited to the operator's browser session.
- **Use `MAPS_API` (not `GOOGLE_PLACES_API_KEY`) for the env var name.** Both
  work via fallback, but `MAPS_API` matches what's set in Vercel.
- **Stay under the 10K free monthly Geocoding API quota.** The `geocode:missing`
  script caps with `--max`. Roughly: do not run more than ~9K addresses per
  calendar month without checking with the operator.

---

## How to make changes

### A typical session looks like this

1. `git checkout claude/build-lumberyard-database-qMI1I && git pull`
2. `pnpm install` if you haven't recently
3. Make changes
4. `pnpm typecheck` and `pnpm lint` — both must pass
5. If touching the schema: `pnpm db:generate` to create a new migration; do
   NOT hand-edit the generated SQL. Apply with `pnpm db:migrate` against the
   production Neon URL.
6. If touching scraping or imports: smoke-test with `--dry-run --limit 5`
   before a full run.
7. `git commit -m "…"` and `git push`
8. Open a PR via the GitHub MCP — don't draft, set ready for review.

### Common scripts

```bash
pnpm dev                                 # local dev
pnpm typecheck && pnpm lint              # pre-commit checks
pnpm seed                                # idempotent re-seed of consolidators
pnpm scrape:<consolidator>               # one of bfs / carter / uslbm / 84 / abc / srs / gms / boise
pnpm import:scraped <path-to-json>       # import a scrape file
pnpm geocode:missing --max 100 --dry-run # sample, then drop --dry-run
pnpm db:studio                           # browse the DB
```

---

## Pointers

- `docs/ARCHITECTURE.md` — why the stack is what it is, how files fit
- `docs/DATA_MODEL.md` — schema, ownership graph, citation flow
- `docs/SCRAPERS.md` — patterns each scraper uses, gotchas
- `docs/OPERATIONS.md` — run-books for seed, scrape, geocode, deploy
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

1. Verify the map renders cleanly in production after the latest fixes.
2. Continue chipping away at deferred consolidators — Beacon would be the
   biggest win (~580 branches).
3. Geocoded budget remaining: ~9.5K calls for the month.
4. Mobile + desktop UX continues to matter; operator visits on both.

If unsure about a direction, ask the operator before doing anything that
spends Geocoding API budget or creates new top-level abstractions.
