# Sprint 7 — Router & Catalog Manager (foundations, shadow-mode) — Updated

**Goal**
Introduce **Catalog Manager v1** (canonical names, merge/dedupe, TTL + SWR cache) and a **Router v1 (shadow-mode)** that predicts targets without touching live traffic. Public `/mcp` behavior remains a **pass-through** to Jungle. Add observability to compare “shadow route” vs “actual route” for later cutover. 

**What changed (merge)**

* **702 + 703 → 702** “Catalog core (canonical IDs + merge/dedupe)”.

**Rule of engagement**
Do tickets **in order**. For each ticket: write code → write tests → **run tests** → fix until green → **commit & push**.

**Repo (new/updated files)**

```
/orchestrator
  /src
    catalog/normalize.ts
    catalog/merge.ts
    catalog/cache.ts
    router/shadow.ts
    router/policy.ts
    obs/log.ts
    obs/otel.ts
    server/{http.ts,proxy.ts,jungleClient.ts}
    jsonrpc/{types.ts,validate.ts,errors.ts}
    config/{schema.ts,load.ts}
  /tests/sprint7
    norm_names.spec.ts
    merge_dedupe.spec.ts
    cache_ttl_swr.spec.ts
    list_catalog_integ.spec.ts
    shadow_route_plan.spec.ts
    policy_selection.spec.ts
    shadow_vs_actual_metrics.spec.ts
    id_invariants_still_hold.spec.ts
    readme_catalog_toggle.spec.ts
  README.md (feature flags + docs)
```

---

## Ticket-701 — Config flags for catalog & shadow router

**What / Why**
Feature toggles to enable catalog building and shadow routing without affecting live behavior:
`ORCH_ENABLE_CATALOG=false`, `ORCH_ENABLE_SHADOW_ROUTER=false`.

**Where**
`/src/config/{schema.ts,load.ts}` (Zod booleans), README update.

**Tests**
`readme_catalog_toggle.spec.ts` ensures flags are documented and parsed.

**Accept when**
Flags parse with defaults; README shows how to turn them on.

**LLM priming**
`z.boolean().default(false)`, `process.env`, `feature toggle`, `README section: "Router & Catalog (shadow)"`

---

## Ticket-702 — Catalog core: **canonical IDs + merge/dedupe**  *(merged)*

**What / Why**
Normalize names to `server__tool` and merge multiple `tools/list` sources into a stable, deduped catalog.

**Where**
`/src/catalog/normalize.ts`, `/src/catalog/merge.ts`

**Implementation sketch**

* `canonicalId(server, tool)`: lowercase, `[a-z0-9_]`, replace others with `_`.
* Merge inputs `{server, tools[]}` → output array of `{id,name,server,desc,schemaHash,sources[]}`; prefer first occurrence; **stable sort** (server then tool).

**Tests**

* `norm_names.spec.ts`: table tests (spaces/unicode/punct).
* `merge_dedupe.spec.ts`: duplicates collapse; order deterministic.

**Accept when**
IDs are deterministic; merged list has no dupes and stable ordering.

**Plain English**

> Give every tool a clean, consistent ID and stitch all menus into one without duplicates.

**LLM priming**
`slugify`, `Map by key`, `stable sort`, `schema hash`

---

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

## Ticket-705 — Shadow router: compute **predicted** target (no live changes)

**What / Why**
For each inbound call, compute a **predicted** route using the catalog. Do **not** alter real routing; just log/trace.

**Where**
`/src/router/shadow.ts` (pure planner), hook from `server/http.ts`.

**Tests**
`shadow_route_plan.spec.ts`: deterministic predictions; unknown → default `jungle`.

**Accept when**
Planner is pure and deterministic; wiring runs alongside proxy.

**Plain English**

> Quietly decide where we *would* send the call—without actually doing it.

**LLM priming**
`pure function`, `deterministic`, `shadow mode`, `catalog lookup`

---

## Ticket-706 — Router policy module (rule priority)

**What / Why**
Encapsulate rule priority: exact `server__tool` → server-only wildcard → fallback.

**Where**
`/src/router/policy.ts`

**Tests**
`policy_selection.spec.ts`: table-driven cases for exact/wildcard/fallback.

**Accept when**
Selection follows the priority table.

**Plain English**

> The rules for picking a server live in one tiny, testable place.

**LLM priming**
`table-driven tests`, `precedence`, `exact vs wildcard vs fallback`

---

## Ticket-707 — Metrics: **shadow vs actual** route comparison

**What / Why**
Counters comparing **predicted** (shadow) vs **actual** (always Jungle today) to prep for cutover analysis.

**Where**
`/src/obs/otel.ts` (Meter), wired from `server/http.ts`.

**Implementation sketch**

* Counter labels: `method`, `predicted`, `actual`, plus `match` boolean.

**Tests**
`shadow_vs_actual_metrics.spec.ts`: generate a few calls; assert counter deltas.

**Accept when**
Metrics show matches/mismatches as expected.

**Plain English**

> Track how often our plan agrees with reality.

**LLM priming**
`OpenTelemetry counter.add(1,{labels})`, `match vs mismatch`

---

## Ticket-708 — ID echo invariants still hold

**What / Why**
New modules must never touch JSON-RPC IDs. Re-assert string/number IDs are echoed exactly.

**Where**
Tests only: `/tests/sprint7/id_invariants_still_hold.spec.ts`

**Accept when**
IDs match exactly; shadow logs contain same IDs.

**Plain English**

> Even with the new parts, request IDs stay untouched.

**LLM priming**
`jsonrpc id echo`, `must not be null`, `string|number`

---

## Ticket-709 — Error envelopes remain spec-compliant

**What / Why**
Confirm JSON-RPC error codes & shapes are unchanged by new code paths.

**Where**
Extend sprint-4 mapping tests or add `/tests/sprint7/...` assertions.

**Implementation sketch**

* Drive non-JSON body and HTTP 5xx from Jungle; verify JSON-RPC mapping unchanged.

**Accept when**
`-32600/-32601/-32603` and `-32000…-32099` shapes match prior behavior.

**Plain English**

> Clients must keep seeing the exact error shapes they expect.

**LLM priming**
`error.data.status`, `envelope shape`, `prior contract tests`

---

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
