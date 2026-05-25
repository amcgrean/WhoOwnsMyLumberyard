# Operations runbook

Concrete commands, in the order you'd run them.

---

## First-time setup

```bash
git clone https://github.com/amcgrean/WhoOwnsMyLumberyard.git
cd WhoOwnsMyLumberyard
nvm use                    # picks up .nvmrc → Node 24
pnpm install
cp .env.example .env.local
# Fill in DATABASE_URL, DATABASE_URL_UNPOOLED, MAPS_API at minimum
pnpm db:migrate            # apply schema to your Neon branch
pnpm seed                  # populate companies + ownership edges
pnpm dev
```

---

## Environment variables

Live in `.env.local` (never committed) and Vercel project settings.

| Var | Where set | Used by |
| --- | --- | --- |
| `DATABASE_URL` | Vercel + .env.local | Drizzle runtime |
| `DATABASE_URL_UNPOOLED` | .env.local | drizzle-kit migrations |
| `MAPS_API` | Vercel + .env.local | Geocoder + Places sweep |
| `RESEND_API_KEY`, `ADMIN_EMAIL` | Vercel | Submission emails |
| `NEXT_PUBLIC_SITE_URL` | Vercel | Sitemap, OG, canonical |
| `NEXT_PUBLIC_MAPLIBRE_TILES_URL` | Vercel (optional) | Override default basemap |

**Key hygiene**: the `MAPS_API` key was shared in chat once. Restrict it in
Google Cloud Console to Geocoding + Places APIs only, restrict by HTTP
referrer or IP. Rotate when convenient.

---

## Pre-commit checks

Both must pass before pushing:

```bash
pnpm typecheck             # tsc --noEmit
pnpm lint                  # eslint .
```

CI re-runs these on every PR via `.github/workflows/ci.yml`.

---

## Adding a consolidator (full path)

1. **Seed the parent company + ownership history.**
   - Create `scripts/seed/<slug>.ts` modeled on `scripts/seed/builders-firstsource.ts`.
   - Add `// SOURCE:` comments above each fact + pass URLs into `upsertEdge`.
   - All edges land with `verified: false`.
   - Wire into `scripts/seed/index.ts`.
   - `pnpm seed` (idempotent — safe to re-run).

2. **Build the scraper.** See `docs/SCRAPERS.md`.

3. **Smoke-test.**
   ```bash
   pnpm scrape:<slug> --dry-run --limit 5
   ```

4. **Full run + import.**
   ```bash
   pnpm scrape:<slug>
   pnpm import:scraped data/scraped/<slug>-YYYY-MM-DD.json
   ```

5. **Geocode any holes.**
   ```bash
   pnpm geocode:missing --max 1000
   ```

6. **Verify.**
   ```bash
   # Quick verify — writes a one-off TS file in scripts/, runs it, removes it.
   # Adapt as needed:
   pnpm exec tsx --env-file=.env.local <(echo '
     import { config } from "dotenv";
     config({ path: ".env.local" });
     import { db } from "@/lib/db";
     import { sql } from "drizzle-orm";
     import { locations } from "@/lib/db/schema";
     const [r] = await db.select({ n: sql<number>`cast(count(*) as int)` }).from(locations);
     console.log("locations:", r.n);
   ')
   ```

7. **Commit + push + PR.**

---

## Geocoding

`scripts/geocode-missing.ts` backfills any `locations` row with null lat/lng
via Google Maps Geocoding API.

```bash
pnpm geocode:missing --dry-run --max 5     # smoke test (no DB writes)
pnpm geocode:missing --max 500             # cap at 500 calls
pnpm geocode:missing                       # default cap = 1000 calls
```

- Uses `MAPS_API` env var.
- Tags rows with `geocode:rooftop` / `geocode:partial` etc. in the services
  array so you can audit precision later.
- Aborts on 5 consecutive failures with no successes (likely quota or key
  misconfiguration).
- Stay under 10K calls per calendar month to remain in the free tier.

---

## Cleanup runbooks

### Rename auto-created brand companies

Some scrapers auto-create yard-typed companies based on hostnames. The names
are heuristic. To clean them up:

```bash
pnpm exec tsx --env-file=.env.local scripts/cleanup-uslbm-brands.ts
```

Idempotent. Add new entries to the `RENAMES` array and re-run.

To audit auto-created companies that still have hostname-derived names, look
for companies whose `description` matches `%Auto-created from scraped store-locator%`.

### Re-running seeds is always safe

The upsert helpers in `scripts/seed/_helpers.ts` key on slug. Re-run any time
you change a seed file:

```bash
pnpm seed
```

---

## Database admin

```bash
pnpm db:studio             # Drizzle Studio — browse/edit DB in a web UI
pnpm db:generate           # generate a migration after schema.ts changes
pnpm db:migrate            # apply pending migrations
pnpm db:check              # validate generated migrations
```

To **flip an ownership edge to verified**: open Drizzle Studio, navigate to
`ownership_edges`, find the row, set `verified = true`. Or via SQL:

```sql
UPDATE ownership_edges SET verified = true WHERE id = '...';
```

Production Neon URL is in Vercel env vars and `.env.local`. The same URL
serves both reads and migrations.

---

## Vercel deploys

- Pushing to any `claude/…` branch → preview deployment via Vercel PR check
- Merging a PR to `main` → production deployment
- Vercel reads env vars from project settings. To change them, use the Vercel
  dashboard or `vercel env`.
- The site is auth-walled in production via Vercel Deployment Protection —
  external testing requires SSO. Disable in Project → Settings → Deployment
  Protection if you want public access.

---

## Common failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| `column "<alias>" does not exist` | Drizzle alias quoted, ORDER BY unquoted | Inline expression in ORDER BY |
| `invalid input syntax for type integer: "3.14"` | JS float passed as int4 param | Cast to `::float8` or inline literal |
| Map canvas blank | Style/tile fetch failing | Check `[map]` console logs (verbose logging added in PR #21); default is OpenFreeMap vector style |
| `Vulnerable version of Next.js detected` on Vercel | Next < 16.x | Bump `next` and `eslint-config-next` |
| Search 500 | Likely the alias bug above; check runtime logs |
| Seed fails on a fresh DB | Migration not applied | `pnpm db:migrate` first |
| `dotenv` doesn't load in tsx scripts | ESM hoisting | Use `--env-file=.env.local` (Node 22+) |
| Map filter panel overlaps content on mobile | Old layout | Use the toggle pattern in `national-map.tsx` |

When in doubt, check Vercel runtime logs:

```bash
# Via the Vercel MCP server's get_runtime_logs tool, filter by level=error
# and the path or query you suspect.
```

---

## Trigger a fresh production deploy without a code change

If you've imported new data and want it to surface immediately rather than
waiting on ISR:

```bash
git commit --allow-empty -m "Trigger redeploy"
git push
```

Or push any tiny commit. Vercel's webhook redeploys on every push.
