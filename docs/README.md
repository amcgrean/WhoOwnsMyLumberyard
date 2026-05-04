# Docs

Reference docs for **Who Owns My Lumberyard**. Read them in this order:

1. **[HANDOFF.md](./HANDOFF.md)** — start here. Project state, working
   agreements, common gotchas, what's deferred. Written for the next agent
   picking up the work.
2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** — stack rationale, repo layout,
   data flow, caching strategy.
3. **[DATA_MODEL.md](./DATA_MODEL.md)** — schema reference, ownership-graph
   semantics, citation flow.
4. **[SCRAPERS.md](./SCRAPERS.md)** — patterns each scraper uses, file-by-file
   notes, how to add a new one.
5. **[OPERATIONS.md](./OPERATIONS.md)** — concrete commands for setup,
   seed/scrape/import/geocode/deploy.
6. **[MAP_AND_SEARCH.md](./MAP_AND_SEARCH.md)** — deep dives on the two
   features that have had the most production-bug iterations.

Source of truth for code is the code itself. These docs explain the **why**
behind the parts that aren't self-evident.
