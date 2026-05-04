# Data model

Schema reference, ownership-graph semantics, and how citations flow.

Source of truth is `lib/db/schema.ts`. Re-read that file when in doubt.

---

## Tables

### `companies`

Every operating entity in the database — yards, consolidators, PE firms,
public companies, co-ops, holding companies, family offices.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | `gen_random_uuid()` |
| `slug` | text unique | URL identifier (`/company/<slug>`, `/owner/<slug>`) |
| `name` | text | Display name |
| `legal_name` | text | Optional formal name |
| `type` | enum `company_type` | See below |
| `founded_year` | integer | Optional |
| `headquarters_city` / `headquarters_state` | text | Optional |
| `website` | text | Brand or corporate site |
| `ticker` | text | For public companies |
| `description` | text | Editorial summary |
| `notes` | text | Operator notes (often legacy-brand bullet list) |
| `logo_url` | text | Sourced + attributed |
| `status` | enum `active` / `acquired` / `defunct` | Defaults `active` |
| `created_at`, `updated_at` | timestamptz | |

`company_type` values:

| Value | Meaning |
| --- | --- |
| `yard` | Individual location's brand on the sign (e.g. "Higginbotham Brothers") |
| `consolidator` | Multi-location operator built mostly through acquisition |
| `pe_firm` | Private-equity sponsor (Bain, Platinum, Kelso, …) |
| `public_company` | Trades on a U.S. exchange (BFS, GMS, Boise, BECN-shell, HD) |
| `coop` | Member-owned buying group (LMC, Do it Best, ENAP, etc.) |
| `holding_company` | Non-operating intermediate entity in an ownership chain |
| `family_office` | Family holding entity (Hendricks Holding, Hardy Family) |

### `locations`

Physical yards / stores. One location belongs to exactly one operating company
(the brand on the sign).

| Column | Notes |
| --- | --- |
| `slug` | unique; `{name-kebab}-{city-kebab}-{state}` |
| `company_id` | FK → `companies.id` (the brand on the sign) |
| `display_name` | What appears on the sign |
| `address_line_1`, `address_line_2`, `city`, `state`, `zip` | |
| `lat`, `lng` | numeric(9,6); 100% populated currently |
| `phone` | |
| `google_place_id` | unique; only set by the Places importer |
| `services` | text[] (lumber, millwork, truss, install, …) |
| `status` | `open` / `closed` / `unknown` |
| `source_url` | Canonical URL the row was scraped from |

Indexes: state+city, zip, slug, google_place_id, GIN on tsvector for FTS.

### `ownership_edges`

Directed graph: `parent_id` owns `child_id`. Multiple edges per pair are
valid (e.g. historical edge with `end_date` set + current edge with `end_date IS NULL`).

| Column | Notes |
| --- | --- |
| `parent_id` | FK → `companies.id` |
| `child_id` | FK → `companies.id` |
| `stake_pct` | numeric(5,2); optional |
| `relationship` | enum: `owns / controls / member_of / franchise_of / subsidiary_of` |
| `start_date`, `end_date` | date; null end = current |
| `note` | Sentence describing the relationship |
| `verified` | bool, default false. Flip per-edge after re-reading sources. |

Constraints: `parent_id <> child_id` (CHECK). Indexed on (child_id, end_date)
for the upward chain walk.

### `acquisitions`

Discrete deal events. Separate from edges so we can track historical context
even when the company structure has flattened.

| Column | Notes |
| --- | --- |
| `slug` | unique; e.g. `home-depot-srs-2024` |
| `acquirer_id`, `target_id` | FK → companies |
| `announced_date`, `closed_date` | |
| `deal_value_usd` | bigint |
| `summary` | Sentence-length editorial summary |

### `sources`

Every citable URL. Deduped on URL.

| Column | Notes |
| --- | --- |
| `url` | unique |
| `archive_url` | web.archive.org snapshot when available |
| `title`, `publication`, `published_date`, `accessed_date` | |

### `claim_sources`

Polymorphic join: source → claim. Subject types are `ownership_edge`,
`acquisition`, `company`, `location`. There's a unique constraint on
(source_id, subject_type, subject_id) so re-running a seed doesn't duplicate.

### `submissions`

Inbound corrections from `/submit`.

| Column | Notes |
| --- | --- |
| `submitter_email`, `claim`, `source_url` | required |
| `status` | enum: `pending / approved / rejected / merged` |
| `reviewer_note` | operator's notes |

### `people`

Founders, family owners, and key execs — only when story-relevant.

---

## Ownership graph

`lib/ownership-graph.ts` exposes:

```ts
getOwnershipChain(companyId, asOf?): OwnershipNode[]
```

Walks `ownership_edges` upward from a starting company, following edges where
`end_date IS NULL OR end_date > asOf`. Cap depth = 10 (cycle guard). Returns
nodes ordered from the starting company up to the ultimate owner.

```ts
getOwnedCompanies(ownerId): { company, edge }[]
```

The inverse — every direct child of a parent. Used on PE / consolidator pages.

```ts
classifyOwnership(chain): OwnershipBadgeKind
```

Looks at the chain and returns one of:
`independent | private_equity | public | coop | family_mega | unknown`.
Rules in order:

1. Any node up the chain is `public_company` → **public**.
2. Any node is `pe_firm` → **private_equity**.
3. Any edge has `member_of` or any node is `coop` → **coop**.
4. Any node is `family_office` → **family_mega**.
5. `consolidator` at the top of a multi-step chain → **family_mega**.
6. chain length 1 + starting node is `yard` → **independent**.
7. else → **unknown**.

---

## Citation flow

When a page renders a claim, it should also surface the source.

```
1. Insert source URLs:           upsertSource({ url, title?, publication?, … })
2. Link source to subject:       linkSource({ url, … }, subjectType, subjectId, quote?)
3. On the page (RSC):
   - Pull all relevant sources:  getCitedSources([{ subjectType, subjectId }, ...])
   - Pass into a CitationRegistry
   - Each time you make a claim: registry.cite(sourceId1, sourceId2)
                                  → returns [N1, N2] → render <CitationMarker numbers={…}/>
   - At the bottom of the page: <SourcesList sources={registry.cited()} />
```

`CitationRegistry` numbers sources in **order of first appearance on the
page**, not in some pre-ordained order — so the [1] superscript always points
at the correct entry in the footer list.

See `app/(data)/yard/[slug]/page.tsx` for a complete example.

---

## Slug conventions

`lib/slug.ts` exports:

```ts
slugify("US LBM")              → "us-lbm"
slugify("Gilcrest/Jewett")     → "gilcrest-jewett"
slugify("84 Lumber")           → "84-lumber"
slugify("ABC Cape Lumber")     → "abc-cape-lumber"

locationSlug({ name: "Spenard Builders Supply", city: "Anchorage", state: "AK" })
  → "spenard-builders-supply-anchorage-ak"
```

Unicode-normalize → strip combining marks → replace `&` → kebab → strip
edges → cap at 80 chars. Globally unique (one location row per slug).

---

## Search documents

Two materialized "documents" live as inline expressions in `lib/search.ts`:

- `locDoc` — `to_tsvector('english', displayName + city + state + zip)`
- `compDoc` — `to_tsvector('english', name + legalName + description)`

Both have GIN indexes (`companies_search_vector_idx`,
`locations_search_vector_idx`). Don't query the `search_vector` text columns
directly — they're placeholders for a future stored generated column.

---

## Adding a new table

1. Add the table def to `lib/db/schema.ts`.
2. Run `pnpm db:generate` — drizzle-kit writes a new SQL migration in
   `/drizzle`.
3. Inspect the generated SQL. **Do not hand-edit.**
4. Run `pnpm db:migrate` against the production Neon URL.
5. Update any types or queries that consume the new shape.

Schema changes go in their own commit, separate from feature changes that
depend on them.
