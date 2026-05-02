# Scraper TODOs

The reference scraper for Builders FirstSource lives in `builders-firstsource.ts`.
Use it as a template (see `_base.ts` for shared helpers).

Pattern: each scraper exposes a CLI with `--dry-run`, `--limit N`, `--interval MS`.
Outputs land in `data/scraped/{slug}-YYYY-MM-DD.json` and are imported via
`pnpm import:scraped <file>`.

Stubs to implement, with the public store-locator URL each starts from:

| Slug | Locator URL |
| --- | --- |
| `us-lbm` | https://www.uslbm.com/our-locations/ |
| `abc-supply` | https://www.abcsupply.com/locations/ |
| `lw-supply` | https://www.lwsupply.com/locations |
| `beacon` | https://www.becn.com/locations |
| `srs-distribution` | https://www.srsdistribution.com/branches/ |
| `foundation-bm` | https://www.fbmsales.com/locations/ |
| `kodiak-bp` | https://www.kodiakbp.com/locations |
| `gms` | https://gms.com/locations/ |
| `carter-lumber` | https://www.carterlumber.com/locations |
| `84-lumber` | https://www.84lumber.com/store-locator/ |
| `boise-cascade` | https://www.bc.com/our-locations/ |
| `parr-lumber` | https://www.parr.com/locations/ |
| `russin-lumber` | https://www.russin.com/locations |
| `foxworth-galbraith` | https://www.foxworth-galbraith.com/locations/ |
| `holmes-lumber` | https://www.holmeslumber.com/locations/ |
| `national-lumber` | https://www.national-lumber.com/locations/ |
| `hamilton-bs` | https://www.hamiltonbuildingsupply.com/locations/ |
| `reeb-millwork` | https://www.reeb.com/locations |

Implementation hints:
- Try JSON-LD `LocalBusiness` first; many corporate locators include it.
- If a site uses a JS map widget, sniff the network requests in DevTools — the
  marker payload is often a JSON endpoint that bypasses HTML scraping.
- Rate-limit to 1 req/sec (default) and identify with a custom user-agent.
- Write `verified: false` semantics: scraped locations land as Unverified
  Independent until the operator reassigns to the correct operating company.
