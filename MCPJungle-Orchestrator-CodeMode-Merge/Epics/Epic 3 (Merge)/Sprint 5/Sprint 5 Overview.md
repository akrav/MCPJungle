# Sprint 5 — Routing Abstraction (Shared Jungle vs Per‑User Instance)

**Goal**  
Introduce a routing layer that decides which MCPJungle endpoint to use per request. Default to the shared multi‑tenant Jungle; optionally support per‑user endpoints (mapping only, no provisioning yet). Ensure both the `/mcp` relay and the Code Mode invoker use the same router.

**Rule of engagement**  
Do tickets in order. For each ticket: implement → write tests → run tests → fix until green → commit & push to `Orchestrator-CodeMode-Merge`. If tests fail, loop until green before pushing.

**What we will reuse**

* `src/server/upstream.ts` (extracted in Sprint 3) — central Undici client with retries, headers, session
* `src/server/http.ts` — current `/mcp` relay
* `src/codemode/invoker.ts` — Code Mode bridge to Jungle
* `src/config/{schema.ts,load.ts}` — env parsing
* `src/obs/log.ts` — structured logs

**Repo layout (S5 additions highlighted)**

```
/orchestrator
  /src
    /routing                                      # NEW in S5
      router.ts                                   # resolve endpoint per request
      store.ts                                    # in‑memory user→endpoint map (dev stub)
      types.ts                                    # small shared types
    /server/upstream.ts                           # reuse (updated to accept dynamic baseUrl)
    /server/http.ts                               # reuse (wire router)
    /codemode/invoker.ts                          # reuse (wire router)
  /tests/sprint5-routing                          # NEW in S5
    router_contract.spec.ts
    config_modes.spec.ts
    store_ttl.spec.ts
    relay_uses_router.spec.ts
    invoker_uses_router.spec.ts
    header_hygiene_after_routing.spec.ts
    fallback_shared_mode.spec.ts
    route_decision_logging.spec.ts
    e2e_two_users_two_endpoints.spec.ts
```

---

## Ticket-3501 — Router module contract

**What / Why**  
Create `router.ts` that exposes `resolveJungleEndpoint({ userId }: { userId?: string }): { baseUrl: string; mode: 'shared'|'per_user' }` using config + optional store mapping. Single source of truth for upstream selection.

**Where**  
`/orchestrator/src/routing/router.ts`

**Implementation sketch**

* Read `ROUTING_MODE` from config (`'shared'|'per_user'`, default `'shared'`).
* If `'shared'` or `!userId`, return `{ baseUrl: JUNGLE_URL, mode:'shared' }`.
* If `'per_user'`, consult store for `userId` → endpoint; if present, return that with `mode:'per_user'`.

**Tests**  
`router_contract.spec.ts`: table‑driven cases for no userId, shared mode, per_user with/without mapping.

**Accept when**  
Function returns correct `{ baseUrl, mode }` for all cases.

**LLM priming**  
`switch config mode`, `optional userId`, `single source of truth`

---

## Ticket-3502 — Config: routing flags and defaults

**What / Why**  
Add `ROUTING_MODE` env with allowed values `shared|per_user` (default `shared`). Validate and expose via `loadConfig()`.

**Where**  
`/orchestrator/src/config/{schema.ts,load.ts}`

**Implementation sketch**

* Zod enum for `routingMode` with default `'shared'`.
* Extend returned config type with `routingMode`.

**Tests**  
`config_modes.spec.ts`: invalid value → error; default applied when unset; per_user accepted.

**Accept when**  
Parsing and defaults behave as specified.

**LLM priming**  
`z.enum(['shared','per_user']).default('shared')`

---

## Ticket-3503 — In‑memory user→endpoint store with TTL (dev stub)

**What / Why**  
Provide `store.ts` with an in‑memory `Map<string,{ baseUrl:string, expiresAt:number }>` to simulate per‑user endpoints until provisioning (Sprint 6).

**Where**  
`/orchestrator/src/routing/store.ts`

**Implementation sketch**

* Functions: `get(userId)`, `set(userId, baseUrl, ttlMs)`, `delete(userId)`, `prune()`.
* Default TTL 30 minutes (configurable).

**Tests**  
`store_ttl.spec.ts`: set→get returns value; after advancing time, `get` returns undefined; `prune` removes expired.

**Accept when**  
TTL behavior correct; no leaks.

**LLM priming**  
`Date.now()`, `expiresAt`, `prune`, `Map`

---

## Ticket-3504 — Wire router into `/mcp` relay

**What / Why**  
Update `server/http.ts` to call `resolveJungleEndpoint({ userId })` and use its `baseUrl` when posting upstream.

**Where**  
`/orchestrator/src/server/http.ts`

**Implementation sketch**

* Extract `userId` from `x-user-id` header (string only).
* Replace hardcoded `cfg.jungleUrl` with router’s `baseUrl` in both `initialize` and pass‑through paths.

**Tests**  
`relay_uses_router.spec.ts`: spy router; ensure called with expected userId; baseUrl used in fetch.

**Accept when**  
Existing relay tests remain green; new assertions pass.

**LLM priming**  
`x-user-id`, `baseUrl substitution`, `spy on module`

---

## Ticket-3505 — Wire router into Code Mode invoker

**What / Why**  
Update `codemode/invoker.ts` to resolve `baseUrl` per call using `userId` from the invocation context.

**Where**  
`/orchestrator/src/codemode/invoker.ts`

**Implementation sketch**

* Accept `{ userId, runId }` in invoker context (already present); call router and pass `baseUrl` to upstream client.

**Tests**  
`invoker_uses_router.spec.ts`: spy router; ensure `baseUrl` honored; logs include route decision.

**Accept when**  
Invoker path uses router; tests pass.

**LLM priming**  
`invoker context`, `resolve baseUrl`, `structured log`

---

## Ticket-3506 — Header hygiene remains intact after routing

**What / Why**  
Ensure `User-Agent`, `Forwarded`, optional `Authorization`, `x-user-id`, and session header logic are unchanged when using dynamic endpoints.

**Where**  
`/orchestrator/src/server/upstream.ts` and tests

**Tests**  
`header_hygiene_after_routing.spec.ts`: asserts headers match the relay’s contract regardless of routed `baseUrl`.

**Accept when**  
Headers identical to pre‑routing behavior.

**LLM priming**  
`header contract`, `unchanged semantics`, `route transparency`

---

## Ticket-3507 — Fallback to shared on missing per‑user mapping

**What / Why**  
If `ROUTING_MODE=per_user` but no mapping exists for `userId`, route to shared `JUNGLE_URL` and log a warning event.

**Where**  
`router.ts` and `log.ts` usage

**Implementation sketch**

* Return `{ baseUrl:JUNGLE_URL, mode:'shared' }` and `log('warn','route_fallback_shared',{ user_id })`.

**Tests**  
`fallback_shared_mode.spec.ts`: assert warning log with `user_id`; baseUrl equals shared.

**Accept when**  
Deterministic fallback with clear logs.

**LLM priming**  
`fallback`, `warn`, `deterministic`

---

## Ticket-3508 — Route decision logging & metrics

**What / Why**  
Log `{ mode, user_id, baseUrl }` and increment counters per mode to observe adoption.

**Where**  
`router.ts` + `obs/otel.ts`

**Implementation sketch**

* `log('info','route_decision',{ ... })`; `incCounter('route_mode_total',{ mode })`.

**Tests**  
`route_decision_logging.spec.ts`: assert log fields and counter increments.

**Accept when**  
Logs and metrics present and labeled.

**LLM priming**  
`incCounter`, `labels`, `structured logs`

---

## Ticket-3509 — E2E: two users routed to different endpoints (stub)

**What / Why**  
End‑to‑end: user A and user B resolve to different Jungle endpoints via the store; run a minimal Code Mode call per user (stub upstream) and verify separation.

**Where**  
Test only.

**Implementation sketch**

* Preload store with two endpoints; issue two invocations with different `x-user-id`; assert requests hit correct baseUrl and results are distinct.

**Tests**  
`e2e_two_users_two_endpoints.spec.ts`: order‑insensitive assertions on observed baseUrls.

**Accept when**  
E2E passes; no leakage between users.

**LLM priming**  
`preload store`, `baseUrl assertions`, `no leakage`

---

## How to run Sprint 5 tests locally

```bash
# Install deps
npm i

# Run only Sprint 5 (routing) tests
npm run test -- tests/sprint5-routing

# After tests pass, push to the feature branch
git checkout -B Orchestrator-CodeMode-Merge
git add -A && git commit -m "Epic3 S5: routing abstraction (shared vs per_user)"
git push -u origin Orchestrator-CodeMode-Merge
```

---

### Notes

* This sprint adds routing only. Provisioning per‑user Jungle instances (containers/Pods) is Sprint 6.
* Keep the router pure and dependency‑light so it can be reused by both the `/mcp` relay and Code Mode invoker without duplication.
* Default remains `shared` for simplicity; feature‑flag `per_user` for early adopters.


