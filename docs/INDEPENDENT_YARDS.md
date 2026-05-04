# Independent yards — strategy + run book

The site so far covers ~2,945 **consolidated** yards. The editorial gap is the
opposite half: showing which yards on a contractor's street are still
genuinely independent. This doc covers the sources we tap for that gap, in
priority order, and how to run them.

---

## Strategy

Three tiers, ranked by signal-to-noise:

1. **Buying-group / co-op member directories** (highest quality)
   Every member of a co-op is a known independent — co-ops exist precisely
   so independent yards can aggregate purchasing power without giving up
   ownership. Dedupe is the only post-processing concern.

2. **Industry association directories** — NLBMDA, state LBM associations.
   Members are independent but rosters are often gated behind member logins.

3. **Google Places API** (broadest coverage, noisiest)
   Returns Home Depot / Lowe's / plumbing supply along with the long-tail
   independents we want. Needs a deny-list filter and operator audit.

We ship Tier 1 (LMC + Do it Best) first because they pay off immediately.
Tier 2 stays deferred until co-op coverage is exhausted. Tier 3 is held in
reserve for filling state-level gaps.

---

## What's implemented

### LMC — Lumbermens Merchandising Corporation

Source: `https://www.lmctogetherwebuild.com/find-dealer/` →
POST `https://www.lmctogetherwebuild.com/api/dealer_locator.php` with
`zip=<zip>&radius=<miles>`. A wide radius from any zip returns the entire
member universe in one HTML response.

- **Yields ~1,715 dealers** in one call
- Per-yard fields: name, street, city, state, zip, phone, website
- **No coordinates** — geocode after import via `pnpm geocode:missing`
- Scraper: `scripts/scrapers/lmc.ts`

### Do it Best

Source: `https://www.doitbest.com/find-a-store/` → public GraphQL endpoint
at `https://www.doitbest.com/api/graphql`. One `storeLocator` call with
`distance=5000` returns all 3,274 members.

- Filtered by `member_status` to **Lumber + Home Center** by default,
  yielding ~1,392 members. Pure-hardware members (1,710) are skipped
  unless `--include-hardware` is passed.
- Per-yard fields: name, street, city, state, zip, **phone, lat, lng**,
  member_microsite_id (used to construct a per-store URL).
- Scraper: `scripts/scrapers/do-it-best.ts`

### Combined potential

After dedup between the two co-ops (some yards are members of both),
realistic addition is **~2,500–2,800 unique independent yards** — roughly
doubling the current database.

---

## What's deferred

| Source | Why deferred | Hint for next time |
| --- | --- | --- |
| **ENAP** | DNS unreachable from the sandbox; investigate from PC | Try `https://www.enapinc.com/find-dealer` etc. |
| **LBM Advantage** | `/dealer-locator/` is gated behind an Elementor widget that does an internal AJAX call — needs the Elementor form submission with the right nonce / params | View source on the dealer-locator page on PC, capture the XHR in DevTools |
| **NLBMDA** | Member directory is members-only on memberclicks.net | Operator could pull a CSV from their member portal if they have NLBMDA membership |
| **Ace Hardware / True Value** | Locator returns thousands of stores but most are pure-hardware, not LBM | Skip unless we add a "lumber" filter chip to the search (Ace's "PRO" sub-brand might be a useful filter) |

---

## Run book — first independent-yards import

Run these commands in order. Smoke-tests are mandatory before full imports
because a bad scrape can pollute thousands of rows.

```bash
# 0. Pre-flight
git pull
pnpm install
pnpm typecheck && pnpm lint

# 1. Re-seed (idempotent, ensures coop companies exist)
pnpm seed

# 2. LMC smoke-test — should print ~1,715 dealer cards parsed
pnpm scrape:lmc --dry-run

# 3. LMC full scrape + import
pnpm scrape:lmc
pnpm import:scraped data/scraped/lmc-$(date +%Y-%m-%d).json

# 4. Audit before doing Do it Best (which overlaps)
pnpm db:studio
# Spot-check a few imported yards. Confirm:
#   - companies.type is "yard"
#   - ownership_edges has parent=lmc, relationship="member_of"
#   - claim_sources links the LMC find-dealer URL to the edge

# 5. Do it Best smoke-test — should print 1,392 kept
pnpm scrape:dib --dry-run --limit 50

# 6. Do it Best full scrape + import
pnpm scrape:dib
pnpm import:scraped data/scraped/do-it-best-$(date +%Y-%m-%d).json
# Members of both LMC and DiB will get a second member_of edge; the
# importer is idempotent on the (parent, child, relationship) triple.

# 7. Geocode any holes — LMC has no coords, DiB has them.
#    Expect roughly 1,700 new geocoder calls; ~17% of the 10K free monthly.
pnpm geocode:missing --max 100 --dry-run     # sample
pnpm geocode:missing --max 2500              # full

# 8. Trigger a fresh prod deploy so the homepage stats refresh
git commit --allow-empty -m "Trigger redeploy after independent-yard import"
git push
```

Expected end-state:
- ~5,500 total locations
- ~1,400+ new yard companies (one per LMC/DiB member)
- ~3,000+ new ownership edges (member_of, sourced to the directory URL)

---

## Beacon scraper — current state

`scripts/scrapers/beacon.ts` runs end-to-end without crashing but returns 0
rows from a headless run. The page is a Next.js SPA on `qxo.com/find-a-store`
that doesn't reveal location data without an interactive trigger.

To debug on PC:

```bash
# Run with a non-headless browser (edit the script: chromium.launch({ headless: false }))
# Open DevTools → Network in the spawned window
# Type a zip into the search input on the page
# Watch for the XHR that returns location-shaped JSON
# Note its URL pattern + request body shape
```

Once the trigger is identified, hand-craft a fetch to that endpoint and
return to the headless approach. ~30-60 minutes of iterative work.

---

## How `member_of` differs from `subsidiary_of` in this project

When a scraper auto-creates a yard company under a co-op parent, the
ownership edge uses `relationship: "member_of"` — not `subsidiary_of`. The
co-op doesn't *own* the member; the yard remains independently owned.

The `classifyOwnership()` helper in `lib/ownership-graph.ts` recognizes this
and renders the yard's badge as **"Co-op Member"** rather than
**"Independent"** or **"Owned by …"**. The badge color is purple (vs green
for fully independent / red for consolidator-owned).

Member yards can carry multiple `member_of` edges (e.g. an LMC member that
is also in Do it Best). The importer's `ensureParentEdge()` is idempotent on
the `(parent_id, child_id, relationship)` triple, so re-running an import
is safe and adds no duplicates.

---

## Caveats / known issues

1. **Slug collisions across coops.** Yards are slugged from
   `<name>-<city>-<state>` so an LMC member named "Doe Lumber" in Springfield
   IL and a DiB member named "Doe Lumber" in Springfield IL would collide
   on `doe-lumber-springfield-il`. They might be the same yard (and we
   want them to merge) or two different yards. Operator review in Drizzle
   Studio resolves it.

2. **LMC has no coordinates.** Run the geocoder afterward.

3. **Phone formatting** is normalized to `(XXX) XXX-XXXX` for both. Existing
   consolidator yards have varying formats — fine for v1, normalize later.

4. **Auto-created brand companies will lack a clean description.** They get
   a generic "Independently owned member of [coop]…" placeholder. Operator
   can rename / enrich in Drizzle Studio per priority yard.
