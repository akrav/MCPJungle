## Ticket-703 — Cache: TTL + stale-while-revalidate (SWR)

**What / Why**
Serve catalog from a tiny in-memory cache with **TTL** (e.g., 60s) and **SWR** (serve stale, refresh in background).

**Where**
`/src/catalog/cache.ts`

**Implementation sketch**

* `getCatalog()` returns fresh if age < TTL; else returns stale immediately and triggers a refresh Promise (dedup in-flight).

**Tests**
`cache_ttl_swr.spec.ts`: first miss → fetch; cached hit; after TTL → stale returned + refresh kicked.

**Accept when**
Semantics match TTL+SWR; no duplicate refreshes.

**Plain English**

> If the list is slightly old, show it now and quietly refresh.

**LLM priming**
`maxAge`, `stale-while-revalidate`, `in-flight promise dedupe`, `updatedAt`

---
