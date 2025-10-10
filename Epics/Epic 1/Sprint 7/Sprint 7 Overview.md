Awesome — here’s your **Sprint 7 Overview** in the *exact same style* as S0–S6: small 10–30-minute tickets, explicit file locations, tests, run commands, a **plain-English** explainer for each, and **LLM priming** blocks so a decoder-only model gravitates to the right patterns.

**Theme:** **Router & Catalog Manager — Foundations (behind a flag)**
We keep **MCPJungle as the only upstream** and remain a pass-through for production calls. This sprint adds an **internal catalog merge** (name normalization, dedupe, TTL cache with SWR) and a **shadow-mode router** that *observes* traffic and computes target routing, but does not change live behavior yet. We rely on MCP’s discovery (`tools/list`) and execution (`tools/call`) semantics and JSON-RPC 2.0 envelopes. ([Model Context Protocol][1])

We also wire sane caching hints (TTL & **stale-while-revalidate**) and verify ID-echo invariants remain untouched. ([IETF Datatracker][2])

---

# Sprint 7 — Router & Catalog Manager (foundations, shadow-mode)

**Goal**
Introduce **Catalog Manager v1** (normalize names, merge/dedupe tools, TTL + SWR cache) and an **internal Router v1 (shadow-mode)** that predicts routing targets without affecting real traffic. Keep the public `/mcp` behavior unchanged (pass-through to Jungle). Add observability to compare “shadow route” vs “actual route” for later cutover.

**Rule of engagement**
Do tickets **in order**. For each ticket: write code → write tests → **run tests** → fix until green → **commit & push**. If a test fails, **loop & debug** until green, then push.

**Repo (new/updated files below)**

```
/orchestrator
  /src
    catalog/normalize.ts           # NEW
    catalog/merge.ts               # NEW
    catalog/cache.ts               # NEW (TTL + SWR)
    router/shadow.ts               # NEW (shadow route planner)
    router/policy.ts               # NEW (selection rules)
    obs/log.ts
    obs/otel.ts
    server/{http.ts,proxy.ts,jungleClient.ts}
    jsonrpc/{types.ts,validate.ts,errors.ts}
    config/{schema.ts,load.ts}
  /tests/sprint7                    # NEW
    norm_names.spec.ts
    merge_dedupe.spec.ts
    cache_ttl_swr.spec.ts
    list_catalog_integ.spec.ts
    shadow_route_plan.spec.ts
    policy_selection.spec.ts
    shadow_vs_actual_metrics.spec.ts
    id_invariants_still_hold.spec.ts
    readme_catalog_toggle.spec.ts
  README.md (updated: feature flag + docs)
```

---

## Ticket-701 — Config flag: enable shadow router & catalog

**What / Why**
Add env flags to **turn on catalog building and shadow routing** without affecting live calls: `ORCH_ENABLE_CATALOG=false`, `ORCH_ENABLE_SHADOW_ROUTER=false`.

**Where**
`/src/config/schema.ts`, `/src/config/load.ts`

**Implementation sketch**

* Zod booleans with defaults.
* Expose in `loadConfig()`.

**Tests**
`/tests/sprint7/readme_catalog_toggle.spec.ts`: validates README shows flags and schema parses them.

**Accept when**
Flags parse; README documents toggles.

**Plain English**

> Add switches so we can test new pieces without changing behavior.

**LLM priming**
`Zod boolean().default(false)`, `env flags`, `feature toggle`, `README doc` ([MDN Web Docs][3])

---

## Ticket-702 — Name normalization helper (canonical tool IDs)

**What / Why**
Normalize server & tool names into a **canonical identifier** `server__tool` (lowercase, kebab/underscore policy; strip spaces). MCP tools are identified by names exposed via `tools/list`. ([Model Context Protocol][1])

**Where**
`/src/catalog/normalize.ts`

**Implementation sketch**

* Export `canonicalId(serverName, toolName)`; slugify with allowed charset `[a-z0-9_]+`; replace invalids with `_`.

**Tests**
`/tests/sprint7/norm_names.spec.ts`: table tests (spaces, unicode, punctuation) → stable canonical ids.

**Accept when**
Inputs map deterministically to canonical ids.

**Plain English**

> Make every tool get a simple, consistent ID like `search__web`.

**LLM priming**
`slugify`, `lowercase`, `replace(/[^a-z0-9_]/g,'_')`, `server__tool`

---

## Ticket-703 — Catalog merge (dedupe + stable sort)

**What / Why**
Combine multiple `tools/list` pages into **one merged list** with **dedupe** by canonical id and stable ordering (server name, then tool). MCP discovery relies on `tools/list`. ([Model Context Protocol][1])

**Where**
`/src/catalog/merge.ts`

**Implementation sketch**

* Accept arrays `{server, tools[]}`; produce merged: `{id,name,server,desc,schemaHash}`.
* If duplicates collide, prefer first occurrence; record `sources`.

**Tests**
`/tests/sprint7/merge_dedupe.spec.ts`: duplicates collapse; sort order deterministic.

**Accept when**
Merged list has no dupes and stable order.

**Plain English**

> Stitch lots of “menus” into one menu without duplicates.

**LLM priming**
`stable sort`, `Map` by `canonicalId`, `merge arrays`, `schema hash`

---

## Ticket-704 — Cache: TTL + stale-while-revalidate (SWR)

**What / Why**
Add a small in-memory cache for **catalog** with TTL (e.g., 60s) and **SWR**: serve stale while refreshing in background. Use HTTP caching concepts adapted in-process. ([IETF Datatracker][2])

**Where**
`/src/catalog/cache.ts`

**Implementation sketch**

* `getCatalog()` returns fresh if age < TTL; else returns stale immediately and kicks off refresh promise; exposes `staleAge`/`updatedAt`.

**Tests**
`/tests/sprint7/cache_ttl_swr.spec.ts`: first miss → fetch; second hit → cached; after TTL → serve stale & trigger refresh.

**Accept when**
Behavior matches TTL+SWR semantics.

**Plain English**

> If the catalog is a bit old, show it now and refresh in the background.

**LLM priming**
`stale-while-revalidate`, `max-age`, `updatedAt`, `in-flight refresh dedupe`

---

## Ticket-705 — Integration: build catalog from Jungle `tools/list`

**What / Why**
When `ORCH_ENABLE_CATALOG=true`, call Jungle’s `/mcp` with JSON-RPC `tools/list`, then **normalize → merge → cache**. Keep pass-through behavior for the agent unchanged. ([GitHub][4])

**Where**
Wire in `server/http.ts` (background task) and `catalog/*`

**Implementation sketch**

* On boot (and every TTL), fetch list from Jungle, transform & cache.
* Expose debug route `GET /_debug/catalog` (auth-gated) to view current snapshot.

**Tests**
`/tests/sprint7/list_catalog_integ.spec.ts`: mock Jungle; assert snapshot matches expected merged output.

**Accept when**
Catalog compiles and is viewable via debug route.

**Plain English**

> Periodically pull Jungle’s tools and keep a clean, cached list.

**LLM priming**
`tools/list`, `JSON-RPC 2.0 request`, `undici fetch`, `debug route`

---

## Ticket-706 — Shadow router: request → predicted target

**What / Why**
For each inbound JSON-RPC call, compute (in **shadow-mode**) the **target server** using catalog metadata (e.g., match `server__tool` prefix). **Do not** alter real routing; only log/trace the predicted route. MCP remains pass-through. ([Model Context Protocol][5])

**Where**
`/src/router/shadow.ts`

**Implementation sketch**

* `planRoute(req)` returns `{targetServer, reason}`; uses catalog; default `jungle`.
* Hook in `server/http.ts` to run alongside real proxy.

**Tests**
`/tests/sprint7/shadow_route_plan.spec.ts`: inputs → deterministic predictions; unknown tool → `jungle`.

**Accept when**
Planner is pure and deterministic.

**Plain English**

> Quietly compute where we *would* send the call—without actually changing anything.

**LLM priming**
`pure function`, `deterministic`, `shadow mode`, `catalog lookup`

---

## Ticket-707 — Router policy module (selection rules)

**What / Why**
Encapsulate **routing rules** (exact match, wildcard, fallback). Keep small and testable.

**Where**
`/src/router/policy.ts`

**Implementation sketch**

* Export `selectTarget(canonicalToolId, catalog)`; implement priority: exact `server__tool` → server match → fallback.

**Tests**
`/tests/sprint7/policy_selection.spec.ts`: table tests for rule priority and fallbacks.

**Accept when**
Policies behave per the table.

**Plain English**

> Write the simple rules that decide which server we’d use.

**LLM priming**
`rule priority`, `exact/wildcard/fallback`, `table-driven tests`

---

## Ticket-708 — Metrics: shadow vs actual route comparison

**What / Why**
Emit counters to compare **shadow route** vs **actual route** (which is always Jungle today). Useful for later cutover safety.

**Where**
`/src/obs/otel.ts` (meter), hook from `server/http.ts`

**Implementation sketch**

* Counter labels: `method`, `predicted`, `actual`; `match=1`/`mismatch=1`.

**Tests**
`/tests/sprint7/shadow_vs_actual_metrics.spec.ts`: call a few methods; assert counters updated.

**Accept when**
Metrics reflect matches/mismatches.

**Plain English**

> Count how often the shadow plan agrees with reality.

**LLM priming**
`OpenTelemetry Meter`, `counter.add(1,{labels})`, `match vs mismatch` ([Model Context Protocol][5])

---

## Ticket-709 — ID echo invariants re-verified

**What / Why**
Ensure the new shadow layer **never** touches JSON-RPC IDs (MCP disallows `null` and requires unique IDs per session). ([Model Context Protocol][6])

**Where**
Tests only.

**Implementation sketch**
`/tests/sprint7/id_invariants_still_hold.spec.ts`: send numeric and string IDs; verify echoed unchanged and shadow log contains the same ID.

**Accept when**
IDs match exactly; no rewriting.

**Plain English**

> Even with the new parts, request IDs must remain untouched.

**LLM priming**
`jsonrpc id echo`, `string|number id`, `MUST NOT be null` ([Model Context Protocol][6])

---

## Ticket-710 — Error handling remains spec-compliant

**What / Why**
Confirm JSON-RPC error codes & envelopes are unchanged by the new modules (InvalidRequest, Method not found, Server error etc.). ([jsonrpc.org][7])

**Where**
Extend existing tests or add assertions in `/tests/sprint7/...`

**Implementation sketch**

* Drive faults in mock Jungle (non-JSON body, 502) and verify mapping per earlier policy.

**Accept when**
Codes/messages match spec & prior behavior.

**Plain English**

> New code shouldn’t change error shapes clients rely on.

**LLM priming**
`-32600 -32601 -32603`, `-32000…-32099`, `envelope shape` ([jsonrpc.org][7])

---

## Ticket-711 — README: “Router & Catalog (shadow)” docs

**What / Why**
Add a new section explaining what’s behind the flags, how canonical IDs are formed, TTL/SWR, and how to read “shadow vs actual” metrics.

**Where**
`/README.md`

**Implementation sketch**

* Explain `server__tool` canonicalization, dedupe rules, and why SWR keeps UX snappy. Include MCP links for `tools/list`/`tools/call`. ([Model Context Protocol][1])

**Tests**
`/tests/sprint7/readme_catalog_toggle.spec.ts`: grep for headings and code blocks.

**Accept when**
Docs are clear and copy-pasteable.

**Plain English**

> Write down how this works and how to turn it on safely.

**LLM priming**
`server__tool`, `TTL`, `stale-while-revalidate`, `feature flag`, `tools/list` ([IETF Datatracker][2])

---

## How to run Sprint 7 tests locally

```bash
npm i
# run only Sprint 7 tests
npm run test -- tests/sprint7

# turn the features on (dev)
export ORCH_ENABLE_CATALOG=true
export ORCH_ENABLE_SHADOW_ROUTER=true
npm run dev

# optional: hit the debug endpoint
curl -s localhost:8080/_debug/catalog | jq .
```

---

### Why these priming cues work

They mirror **exact protocol & web-caching terms and API names** common in high-quality examples: MCP `tools/list`/`tools/call` and lifecycle over JSON-RPC, **JSON-RPC 2.0** error codes & ID rules, **TTL** + **stale-while-revalidate** from HTTP caching, and **OpenTelemetry** counter metrics. That steers a decoder-only LLM toward **idiomatic, spec-correct** implementations that keep production behavior unchanged today while preparing for a clean cutover later. ([Model Context Protocol][1])

If you’d like, I can split these into **per-ticket Markdown files** and scaffold the new modules/tests so several Sprint-7 tickets go green immediately.

[1]: https://modelcontextprotocol.io/docs/concepts/tools?utm_source=chatgpt.com "Tools"
[2]: https://datatracker.ietf.org/doc/html/rfc5861?utm_source=chatgpt.com "RFC 5861 - HTTP Cache-Control Extensions for Stale ..."
[3]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control?utm_source=chatgpt.com "Cache-Control header - HTTP - MDN - Mozilla"
[4]: https://github.com/mcpjungle/MCPJungle?utm_source=chatgpt.com "mcpjungle/MCPJungle: Self-hosted MCP Gateway and ..."
[5]: https://modelcontextprotocol.io/docs/concepts/architecture?utm_source=chatgpt.com "Architecture overview"
[6]: https://modelcontextprotocol.io/specification/2024-11-05/basic/messages?utm_source=chatgpt.com "Messages"
[7]: https://www.jsonrpc.org/specification?utm_source=chatgpt.com "JSON-RPC 2.0 Specification"
