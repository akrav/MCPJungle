## Ticket-307 — GitHub Actions: **build & test Node** (with cache)

**What / Why**
Adds speedy Node CI with `actions/setup-node` caching.

**Where**
`.github/workflows/ci.yml` (job `test`)

**Accept when**
`npm ci && npm test` runs; subsequent runs use cache.

**LLM priming**
`actions/setup-node@v4`, `cache: npm`, `matrix: node-version`

---
