# Scraper TODOs

The reference scraper for Builders FirstSource lives in `builders-firstsource.ts`.
Use it as a template (see `_base.ts` for shared helpers).

Pattern: each scraper exposes a CLI with `--dry-run`, `--limit N`, `--interval MS`.
Outputs land in `data/scraped/{slug}-YYYY-MM-DD.json` and are imported via
`pnpm import:scraped <file>`.

## Implemented (do not re-implement)

These scrapers are live in `scripts/scrapers/` and wired into `package.json`:

| Slug | Script | Notes |
| --- | --- | --- |
| `builders-firstsource` | `builders-firstsource.ts` | ~603 locations |
| `carter-lumber` | `carter-lumber.ts` | 225 locations, 5 brands |
| `us-lbm` | `us-lbm.ts` | ~580 locations, 60+ banners |
| `eighty-four-lumber` | `eighty-four-lumber.ts` | ~300 locations |
| `abc-supply` | `abc-supply.ts` | ~694 US locations |
| `srs-distribution` | `srs-distribution.ts` | ~449 locations, 10 sub-brands |
| `gms` | `gms.ts` | ~73 companies, 56 sub-brands |
| `boise-cascade` | `boise-cascade.ts` | 52 facilities |
| `beacon` | `beacon.ts` | ~539 locations, REST grid sweep |
| `lmc` | `lmc.ts` | ~1,715 co-op members (`member_of`) |
| `do-it-best` | `do-it-best.ts` | ~1,392 lumber members (`member_of`) |

## Deferred — stubs to implement

Public store-locator URLs for the remaining consolidators:

| Slug | Locator URL | Notes |
| --- | --- | --- |
| `lw-supply` | https://www.lwsupply.com/locations | ZIP not exposed in markers; may need detail-page fetch for each of ~276 locations |
| `foundation-bm` | https://www.fbmsales.com/locations/ | |
| `kodiak-bp` | https://www.kodiakbp.com/locations | |
| `parr-lumber` | https://www.parr.com/locations/ | |
| `russin-lumber` | https://www.russin.com/locations | |
| `foxworth-galbraith` | https://www.foxworth-galbraith.com/locations/ | |
| `holmes-lumber` | https://www.holmeslumber.com/locations/ | (Carter family brand — may already be covered by carter-lumber.ts) |
| `national-lumber` | https://www.national-lumber.com/locations/ | |
| `hamilton-bs` | https://www.hamiltonbuildingsupply.com/locations/ | |
| `reeb-millwork` | https://www.reeb.com/locations | |

## Deferred — co-ops (access issues)

| Slug | Notes |
| --- | --- |
| `enap` | DNS unreachable from sandbox; investigate from PC |
| `lbm-advantage` | Elementor widget gates the locator |
| `nlbmda` | Members-only directory |

Implementation hints:
- Try JSON-LD `LocalBusiness` first; many corporate locators include it.
- If a site uses a JS map widget, sniff the network requests in DevTools — the
  marker payload is often a JSON endpoint that bypasses HTML scraping.
- Rate-limit to 1 req/sec (default) and identify with a custom user-agent.
- Write `verified: false` semantics: scraped locations land as Unverified
  Independent until the operator reassigns to the correct operating company.
