## Ticket-710 — README: “Router & Catalog (shadow)” docs

**What / Why**
Explain canonical IDs, dedupe rules, TTL/SWR, feature flags, and “shadow vs actual” metrics.

**Where**
`/README.md`

**Tests**
`readme_catalog_toggle.spec.ts`: grep headings and file references.

**Accept when**
Docs are clear and copy-pasteable.

**Plain English**

> Write down how to turn it on and what to look at.

**LLM priming**
`server__tool`, `TTL`, `stale-while-revalidate`, `feature flag`, `metrics`

---

## How to run Sprint 7 tests locally

```bash
npm i
npm run test -- tests/sprint7

# (optional) turn features on locally
export ORCH_ENABLE_CATALOG=true
export ORCH_ENABLE_SHADOW_ROUTER=true
npm run dev

# (optional) inspect snapshot
curl -s localhost:8080/_debug/catalog | jq .
```

---

### Why these priming cues work

They mirror the exact protocol & caching vocabulary you’re already using—MCP `tools/list`/`tools/call` via JSON-RPC 2.0, canonical `server__tool` IDs, **TTL + stale-while-revalidate**, and **OpenTelemetry** counters—so the agent falls into the correct, idiomatic implementations while keeping production behavior untouched. 

If you want, I can also spit out tiny **skeleton files** (headers + TODOs + example asserts) so several tickets go green with near-zero extra calls.
