# Who Owns My Trades

A public, journalism-grade database that maps who owns the local trade and building-materials businesses people rely on — lumberyards, plumbers, electricians, and HVAC companies. Search any business by zip code, name, or city and see the full ownership chain — from the brand on the sign up to the ultimate owner (a public company, a private-equity firm, a co-op, or an independent operator).

Lumber and building-materials dealers are tracked nationally. The residential-trades expansion (plumbing, electrical, HVAC) starts in **Iowa** and widens to other states over time. The site began as "Who Owns My Lumberyard"; the GitHub repo and email-sending domain still carry the original name.

The site is a public reference resource. Every ownership claim is linked to a public source.

## Tech stack

- Next.js 15 (App Router, React Server Components, TypeScript)
- Tailwind CSS v4
- Drizzle ORM + Neon Postgres (`drizzle-kit` for migrations)
- shadcn/ui primitives, lucide-react icons
- MapLibre GL JS (Protomaps or MapTiler tiles)
- Postgres full-text search (no Algolia / Meilisearch in v1)
- React Hook Form + Zod
- Resend for correction emails
- Vercel Analytics + Speed Insights
- pnpm, Node 22 LTS (see `.nvmrc`)

## Local setup

```bash
# Prereqs: pnpm 10+, Node 22+
nvm use            # picks up .nvmrc
pnpm install

# Create a Neon project — https://console.neon.tech
# Grab two connection strings: pooled (runtime) and direct (migrations).
cp .env.example .env.local
# Fill in DATABASE_URL and DATABASE_URL_UNPOOLED at minimum.

# Generate and apply the initial migration to your Neon database
pnpm db:generate
pnpm db:migrate

# Seed the top consolidators (idempotent — safe to re-run)
pnpm seed

# Start the dev server
pnpm dev
```

A first run lands data for: Builders FirstSource (+ BMC), US LBM (with Bain / Platinum / Kelso ownership history), ABC Supply (+ L&W + Hendricks), Beacon, SRS Distribution (+ Home Depot acquisition), and the major LBM co-ops.

Yards are **not** seeded by default — use the scraper or the Google Places importer (below) to populate locations.

## Deployment (Vercel)

1. Connect the repo to a new Vercel project.
2. Configure the environment variables from `.env.example`. At minimum, set both Neon connection strings, `NEXT_PUBLIC_SITE_URL`, and (for tiles) `NEXT_PUBLIC_MAPLIBRE_TILES_URL`.
3. The first deploy will fail if migrations have not been run against the production Neon branch — run `pnpm db:migrate` locally with the production `DATABASE_URL_UNPOOLED` exported once before deploying, or wire migrations into your build step.
4. Re-running `pnpm seed` against the production database is safe; the helpers are idempotent.

## Adding a consolidator

1. Create `scripts/seed/<slug>.ts`. Use `scripts/seed/builders-firstsource.ts` or `scripts/seed/us-lbm.ts` as a template.
2. Above each `upsertEdge` call, add a `// SOURCE: <url>` comment with the canonical primary source backing that ownership claim.
3. Pass the source URLs into `upsertEdge`'s `sources: [...]` field so they're stored in the database and surfaced as `[1]` superscript citations on the rendered pages.
4. Wire the new seed function into `scripts/seed/index.ts`.
5. Mark new ownership edges with `verified: false` (the default). Flip individual edges to `verified: true` only after re-reading each source and confirming it supports the specific claim.

## Trades (plumbing / electrical / HVAC)

Companies and locations carry an optional `trade` (`lumber | plumbing | electrical | hvac`). Set it on operating brands and their locations; leave it null on pure ownership entities (PE firms, holding companies, co-ops). The pre-expansion dataset is backfilled to `lumber` by migration `0001`.

The residential-trades seeds are:

- `scripts/seed/national-home-services.ts` — the major national PE-backed HVAC/plumbing/electrical roll-ups (Apex, Wrench, Sila, Champions/Blackstone, Authority Brands, etc.) and their PE sponsors, so ultimate owners resolve as trade locations are added state by state.
- `scripts/seed/iowa-home-services.ts` — PE-owned Iowa brands and their chains (TurnPoint→Schaal/Bell Brothers/Green's, PremiStar→Mechanical Service Inc., ARS→Aksarben, Burton).
- `scripts/seed/iowa-independents.ts` — notable locally-owned Iowa shops (Golden Rule, Dalton, Baker Group).

They follow the same source-cited pattern as the consolidator seeds above and set `trade` on every operating brand. Trade coverage is Iowa-first; add other states as new seed files over time. New trade locations are seeded without coordinates — run `pnpm geocode:missing` to place them on the map. Ownership can be cross-checked against the [Iowa Secretary of State business-entity search](https://sos.iowa.gov/search/business/search.aspx).

## Adding a source URL

Sources live in the `sources` table, deduped by URL. The seed helpers (`upsertEdge`, `upsertAcquisition`, `linkSource`) call `upsertSource` automatically. If you discover a new authoritative URL outside the seed flow, add it via SQL:

```sql
insert into sources (url, title, publication, published_date)
values ('https://...', 'Title', 'Publication', '2024-01-01')
on conflict (url) do update set title = excluded.title;
```

For full citation context, also insert into `claim_sources` linking the source to the specific company / edge / acquisition / location it backs.

## Scrapers

The reference scraper for Builders FirstSource is in `scripts/scrapers/builders-firstsource.ts`. It uses Playwright + the `_base.ts` framework (rate-limited, dry-run, limit). Output JSON lands in `data/scraped/<slug>-YYYY-MM-DD.json`. Import with:

```bash
pnpm scrape:bfs --limit 10 --dry-run    # smoke test
pnpm scrape:bfs                         # full run
pnpm import:scraped data/scraped/builders-firstsource-2026-05-02.json
```

Stubs and store-locator URLs for the remaining 17 consolidators are listed in `scripts/scrapers/TODO.md`.

## Google Places enrichment

```bash
# Discover yards in a state and stage them as 'Unverified Independent'
pnpm import:places --state IA --query "lumber yard"
pnpm import:places --state IA --query "building materials"
```

The operator then reviews the staged rows and reassigns each one's `company_id` to the correct operating brand.

## How submissions are reviewed

Submissions land in the `submissions` table with `status = 'pending'`. The operator reviews them in Drizzle Studio (`pnpm db:studio`) or via SQL. A source-backed submission is reviewed promptly; one without a source is queued and used as a lead. Approved tips become an `INSERT` or `UPDATE` to the underlying tables.

## Data accuracy

If you spot something wrong, use [/submit](/submit). Include a public source URL — every claim on this site is linked to a public document. Corrections without a source are not rejected; they are queued and used as leads.

## Disclosure

The site operator works in the LBM industry at an independent yard. That is a relevant disclosure: the operator has a professional interest in the independent side of the industry. The site addresses this by sourcing every claim, by leaving Drizzle migrations and seed code public, and by accepting source-backed corrections.

## License

- Source code: **MIT** — see `LICENSE`.
- Compiled ownership data published on whoownsmytrades.com (excluding raw upstream sources): **CC&nbsp;BY-SA&nbsp;4.0**. Attribution: "Who Owns My Trades, [URL]".

## Status & deferred work

Built in the first pass:

- Repo scaffold, Drizzle schema + migrations, Neon wiring
- All page templates: home, yard, company, owner, state, map, search, about, methodology, submit
- Server-rendered `OwnershipChain` component with citation-numbered superscripts
- Postgres full-text search across companies and locations
- MapLibre national map with cluster + filter
- Submission API + Resend notifications
- Sitemap, robots.txt, dynamic OG images, JSON-LD on yard pages
- Seed scripts for the top 5 consolidators with primary-source URLs
- Reference Playwright scraper for Builders FirstSource + import pipeline
- GitHub Actions CI: typecheck, lint, Drizzle schema check

Deferred to later passes:

- Remaining 15 consolidator seeds and scrapers (see `scripts/scrapers/TODO.md`)
- Nationwide Google Places import
- Co-op member-yard mappings (manual data entry; full rosters not public)
- Admin UI for submission review (v1: SQL or Drizzle Studio)
- Newsletter signup
- Advanced map filters (year acquired, deal size)
- Comparison pages ("Builders FirstSource vs US LBM")