# Sprint 8 — Router & Catalog Cutover (gradual & resilient) — Updated

**Goal**
Flip from pass-through to **router-driven routing** backed by the merged catalog with **progressive delivery** (feature flags + canary), resilient controls (timeouts, limited retries, circuit-breaker, outlier detection, local rate-limit), **instant fallback to Jungle**, and crisp **OTel** spans/metrics. Discovery/execute remain MCP-correct (`tools/list`, `tools/call`) over JSON-RPC. 

**What changed (merge)**

* **803 + 811 → 803** “Fallback & Rollback master switch”.

**Rule of engagement**
Do tickets **in order**. For each ticket: code → tests → run → fix until green → commit & push.

**Repo (new/updated files)**

```
/orchestrator
  /src
    catalog/{normalize.ts,merge.ts,cache.ts}
    router/{shadow.ts,policy.ts,live.ts}
    router/fallback.ts
    featureflags/flags.ts
    obs/{otel.ts,log.ts}
    server/{http.ts,proxy.ts,jungleClient.ts}
    config/{schema.ts,load.ts}
  /tests/sprint8
    flag_cutover.spec.ts
    live_router_select.spec.ts
    fallback_and_rollback.spec.ts      # merged
    timeout_retry_policy.spec.ts
    circuit_breaker_sim.spec.ts
    outlier_detection_sim.spec.ts
    local_ratelimit.spec.ts
    canary_header_split.spec.ts
    otel_semconv_labels.spec.ts
    readme_cutover_runbook.spec.ts
  /deploy/istio
    virtualservice-canary.yaml
  README.md (updated “Cutover & Rollback”)
```

---

## Ticket-801 — Feature flag: **live router** master switch

**Why**
Ship dark, flip later. `ORCH_LIVE_ROUTER_ENABLED=false` gates the live router. 

**Where**
`featureflags/flags.ts`, `config/{schema,load}.ts`, `server/http.ts`

**Implementation sketch**

* Zod boolean default false; `if (flags.liveRouter) liveRoute() else proxyToJungle()`.

**Tests**
`flag_cutover.spec.ts`: toggling flag changes handler path.

**Accept when**
Both paths reachable via the flag.

**LLM priming**
`Zod boolean().default(false)`, `feature flag`, `if (flags.liveRouter)`

---

## Ticket-802 — Live router module (uses catalog + policy)

**Why**
Actually select the upstream via catalog + policy.

**Where**
`router/live.ts`

**Implementation sketch**

* Build `canonicalId` from JSON-RPC method; pull cached catalog; `policy.selectTarget()`. Return `{target, reason}`.

**Tests**
`live_router_select.spec.ts`: table tests (exact/wildcard/fallback).

**Accept when**
Selection deterministic and matches policy.

**LLM priming**
`canonicalId(server, tool)`, `selectTarget`, `deterministic`

---

## Ticket-803 — **Fallback to Jungle & Rollback master switch**  *(merged)*

**Why**
If router errs or exhausts retries, **fallback to Jungle**; plus an emergency lever `ORCH_ROLLBACK_TO_JUNGLE=true` that **overrides everything** (flag/header) to force 100% Jungle. 

**Where**
`router/fallback.ts`, `featureflags/flags.ts`, `server/http.ts`

**Implementation sketch**

* In `http.ts`: if `flags.rollback` → `proxyToJungle()` with banner log.
* Else try live; on router error / retry-exhausted 5xx → `proxyToJungle()`; preserve JSON-RPC `id`.

**Tests**
`fallback_and_rollback.spec.ts`:

* Router failure → Jungle succeeds; `id` echoed.
* With rollback=true → all requests bypass live router (header ignored).

**Accept when**
Rollback overrides all; fallback path preserves invariants.

**LLM priming**
`short-circuit`, `try/catch`, `retry budget exhausted`, `id echo`

---

## Ticket-804 — Timeout & limited retries (router path)

**Why**
Bound latency; retry a little on safe errors (502/503) with jitter. Mirrors mesh behavior. 

**Where**
`router/live.ts` policy reference, `server/jungleClient.ts` if reused.

**Implementation sketch**

* Export `{timeoutMs, retryCodes:[502,503], maxRetries:2, backoff: exponential+jitter}`; enforce via `AbortController`.

**Tests**
`timeout_retry_policy.spec.ts`: stall → timeout; 502→502→200 succeeds.

**Accept when**
Policy matches behavior; JSON-RPC errors mapped (`-32000`).

**LLM priming**
`AbortController`, `exponential backoff + jitter`, `-32000 server error`

---

## Ticket-805 — Circuit-breaker (app-level simulation)

**Why**
Fail fast when in-flight > cap (Envoy-style CB mirrored in app). 

**Where**
Tiny middleware or guard in `live.ts`; config via `config/load.ts`.

**Implementation sketch**

* Semaphore (e.g., 100 in-flight). Over cap → fast JSON-RPC `-32000` with `data.reason="circuit_open"`.

**Tests**
`circuit_breaker_sim.spec.ts`: flood → rejects after cap, then recover.

**Accept when**
Cap respected; service recovers.

**LLM priming**
`semaphore`, `inflight counter`, `shed load`

---

## Ticket-806 — Outlier detection (simulation hook)

**Why**
Temporarily ban a flaky target (Envoy outlier analogue). 

**Where**
`router/live.ts` or `router/policy.ts` (banlist with TTL)

**Implementation sketch**

* Sliding window error counter per target; threshold → ban for N sec; route elsewhere.

**Tests**
`outlier_detection_sim.spec.ts`: force errors → ban engages → expires.

**Accept when**
Redirect occurs during ban; ban later lifts.

**LLM priming**
`sliding window`, `banlist TTL`, `redirect to fallback`

---

## Ticket-807 — Local rate-limit (per-process)

**Why**
Token-bucket limiter at `/mcp` to protect the app in addition to edge limiter. 

**Where**
`server/http.ts`; config via `config/load.ts`.

**Implementation sketch**

* Bucket {capacity B, refill r/s}; when empty → JSON-RPC 429 with `Retry-After`.

**Tests**
`local_ratelimit.spec.ts`: exceed → 429; recovers after refill.

**Accept when**
Bursts are throttled; normal traffic unaffected.

**LLM priming**
`token bucket`, `Retry-After`, `status 429`

---

## Ticket-808 — Canary header split (developer shaper)

**Why**
Force router path with `x-orch-canary: 1` regardless of flag; logs `canary=true`. Complements mesh %. 

**Where**
`server/http.ts`

**Implementation sketch**

* If header present → `liveRoute()`; attach label `orch.canary=true`.

**Tests**
`canary_header_split.spec.ts`: header forces live; without header → flag decides.

**Accept when**
Header deterministically forces canary path.

**LLM priming**
`req.headers['x-orch-canary']`, `canary`, `percent rollout`

---

## Ticket-809 — OTel semantic labels for routing decisions

**Why**
Spans/metrics include `orch.route=live|jungle`, `orch.canary=true|false`, `orch.fallback=true|false`, `target.server`, using HTTP semconv elsewhere. 

**Where**
`obs/otel.ts`, calls from `server/http.ts` + `router/live.ts`

**Implementation sketch**

* `span.setAttribute(...)`; counters with same labels.

**Tests**
`otel_semconv_labels.spec.ts`: attributes present for sample call.

**Accept when**
Attrs/metrics present & correct.

**LLM priming**
`Span.setAttribute`, `meter.createCounter`, `HTTP semconv`

---

## Ticket-810 — Mesh canary: **Istio VirtualService** example (docs + YAML)

**Why**
Ready-to-edit example for 10%→25%→50%→100% traffic shifting between v1 (pass-through) and v2 (router). 

**Where**
`deploy/istio/virtualservice-canary.yaml`, README section

**Implementation sketch**

* Two subsets or services; weighted routes; short instructions.

**Tests**
`readme_cutover_runbook.spec.ts`: README references file & steps.

**Accept when**
YAML validates; doc explains how to adjust weights.

**LLM priming**
`VirtualService http route weight`, `subset v1/v2`, `kubectl apply`

---

## Ticket-811 — README: **Cutover & Runbook** (copy-pasteable)

**Why**
A single doc: enable header canary → 10% mesh → observe OTel metrics → ramp → 100% → disable flag. Include **rollback** steps (set `ORCH_ROLLBACK_TO_JUNGLE=true`). 

**Where**
`README.md`

**Implementation sketch**

* Sections: Preconditions, Canary Steps, Observe (dashboards/metrics), Rollback, Verification (MCP contract checks).

**Tests**
`readme_cutover_runbook.spec.ts`: grep headings and key commands.

**Accept when**
Doc is clear and actionable.

**LLM priming**
`progressive delivery`, `traffic shifting`, `observability gates`, `rollback switch`

---

## How to run Sprint 8 tests locally

```bash
npm i
npm run test -- tests/sprint8

# Dev canary via header (single request)
curl -s -H 'x-orch-canary: 1' -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  http://localhost:8080/mcp | jq .

# Flip live router on (dev)
export ORCH_LIVE_ROUTER_ENABLED=true
npm run dev
```

---

### Why these priming cues work

They align with your source sprint theme: **feature flags & canary**, **Istio/Envoy** resilience patterns (timeouts, retries, circuit breakers, outlier detection, local rate limit), **Jungle fallback**, and **OpenTelemetry** semconv—so an LLM sticks to **idiomatic, production-safe** implementations with minimal back-and-forth. 

If helpful, I can also emit tiny skeletons (files + TODO assertions) to make several tickets go green with near-zero extra calls.
