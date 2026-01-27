## Ticket-704 — Integration: build catalog from Jungle `tools/list`

**What / Why**
When `ORCH_ENABLE_CATALOG=true`, fetch Jungle’s `tools/list` on boot and per-TTL, then **normalize → merge → cache**. Public proxying stays unchanged.

**Where**
Hook in `server/http.ts` (background task) + `catalog/*`; add auth-gated `GET /_debug/catalog`.

**Tests**
`list_catalog_integ.spec.ts`: mock Jungle; snapshot output matches expected merged catalog.

**Accept when**
Catalog builds and is viewable at `/_debug/catalog`.

**Plain English**

> Periodically pull Jungle’s tools and keep a clean, cached snapshot.

**LLM priming**
`JSON-RPC 2.0 request`, `tools/list`, `undici fetch`, `debug route`

---
