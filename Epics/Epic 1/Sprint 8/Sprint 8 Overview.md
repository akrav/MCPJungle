**Theme:** **Router & Catalog — Cutover with Safety Nets**
We turn on the Router + Catalog for real traffic via **progressive delivery** (feature flags + canary), bake in **resiliency controls** (timeouts, retries, circuit breakers, outlier detection, rate-limit), wire **fallback-to-Jungle** on error, and keep **observability** crisp with OTel span/metric conventions. Discovery/execute remain MCP-correct (`tools/list`, `tools/call`) over JSON-RPC. ([Model Context Protocol][1])

Key references we align to (and prime the LLM with):

* **Progressive delivery & feature flags** (decouple deploy from release). ([Octopus Deploy][2])
* **Istio traffic shifting/canary** (gradual % rollouts) and **timeouts/retries**. ([Istio][3])
* **Envoy** circuit breakers & outlier detection; **local rate limit**. ([Envoy Proxy][4])
* **OpenTelemetry** HTTP span/metric semantic conventions. ([OpenTelemetry][5])
* **MCP** concepts (tools, lifecycle). ([Model Context Protocol][6])

---

# Sprint 8 — Router & Catalog Cutover (gradual & resilient)

**Goal**
Move from “pass-through only” to **router-driven routing** backed by the **merged catalog**, but do it safely: feature-flagged, canaried, with hard limits and clear rollback. If anything smells off, **instant fallback to Jungle**.

**Rule of engagement**
Do tickets **in order**. For each ticket: write code → write tests → **run tests** → fix until green → **commit & push**. If a test fails, **loop & debug** until green, then push.

**Repo (new/updated files below)**

```
/orchestrator
  /src
    catalog/{normalize.ts,merge.ts,cache.ts}
    router/{shadow.ts,policy.ts,live.ts}         # NEW live router
    router/fallback.ts                           # NEW Jungle fallback
    featureflags/flags.ts                        # NEW
    obs/{otel.ts,log.ts}
    server/{http.ts,proxy.ts,jungleClient.ts}
    config/{schema.ts,load.ts}
  /tests/sprint8
    flag_cutover.spec.ts
    live_router_select.spec.ts
    fallback_to_jungle.spec.ts
    timeout_retry_policy.spec.ts
    circuit_breaker_sim.spec.ts
    outlier_detection_sim.spec.ts
    local_ratelimit.spec.ts
    canary_header_split.spec.ts
    otel_semconv_labels.spec.ts
    rollback_switch.spec.ts
    readme_cutover_runbook.spec.ts
  /deploy/istio
    virtualservice-canary.yaml                    # NEW (example)
  README.md (updated “Cutover & Rollback”)
```

---

## Ticket-801 — Feature flag: **live router** master switch

**What / Why**
Add `ORCH_LIVE_ROUTER_ENABLED=false`. When `true`, requests are routed by `router/live.ts`; when `false`, pass-through to Jungle. Feature flags let us **ship dark and flip on later**. ([Octopus Deploy][2])

**Where**
`/src/featureflags/flags.ts`, `/src/config/{schema,load}.ts`, `/src/server/http.ts`

**Implementation sketch**

* Zod boolean default false; conditionally call `liveRoute()` vs `proxyToJungle()`.

**Tests**
`/tests/sprint8/flag_cutover.spec.ts`: toggle flag → assert handler path changes.

**Accept when**
Both paths are reachable via the flag.

**Plain English**

> One switch turns the real router on or off.

**LLM priming**
`feature flag`, `Zod boolean().default(false)`, `if (flags.liveRouter)` ([Octopus Deploy][2])

---

## Ticket-802 — Live router module (uses catalog + policy)

**What / Why**
Implement `router/live.ts` that uses `policy.selectTarget(canonicalToolId, catalog)` to pick an upstream. If no match, route to Jungle.

**Where**
`/src/router/live.ts`

**Implementation sketch**

* Build canonical id from request; pull cached catalog; call policy; return `{target, reason}`.

**Tests**
`/tests/sprint8/live_router_select.spec.ts`: table tests for exact / wildcard / fallback.

**Accept when**
Selection is deterministic and matches policy tables.

**Plain English**

> The router actually picks where a call goes.

**LLM priming**
`canonicalId`, `selectTarget`, `deterministic pure function`

---

## Ticket-803 — Jungle **fallback** on router error

**What / Why**
If the live router throws or upstream 5xx persists after retries, **fall back to Jungle** pass-through and surface a JSON-RPC error only if Jungle also fails.

**Where**
`/src/router/fallback.ts`, wire in `server/http.ts`

**Implementation sketch**

* Try live route; on routing error or retry-exhausted 5xx, call `proxyToJungle()` with original envelope.

**Tests**
`/tests/sprint8/fallback_to_jungle.spec.ts`: simulate router failure → expect Jungle succeeds; original `id` echoed.

**Accept when**
Fallback path is exercised and preserves JSON-RPC invariants.

**Plain English**

> If the new path stumbles, we quietly use the old path.

**LLM priming**
`try/catch`, `retry budget exhausted`, `graceful fallback`

---

## Ticket-804 — Timeout & retry policy (router path)

**What / Why**
Apply **timeouts** and **limited retries** on router path (match earlier MVP rules) with explicit policy object. Mesh policies often mirror this (Istio has timeouts/retries). ([Istio][7])

**Where**
`/src/router/live.ts` (policy reference), `/src/server/jungleClient.ts` (if reused)

**Implementation sketch**

* Export `{timeoutMs, retryCodes:[502,503], maxRetries:2, backoff:exponential+jitter}`; enforce via AbortController.

**Tests**
`/tests/sprint8/timeout_retry_policy.spec.ts`: stalls → timeout error; 502→502→200 path succeeds.

**Accept when**
Policy behaves as specified, errors mapped JSON-RPC.

**Plain English**

> Don’t wait forever; retry a little on safe errors.

**LLM priming**
`AbortController`, `exponential backoff + jitter`, `-32000 server error` ([Istio][7])

---

## Ticket-805 — Circuit-breaker simulation (app level)

**What / Why**
Simulate **circuit-breaker** behavior in tests (cap pending requests; shed load). Envoy does this at proxy; we mimic minimal app-side guard. ([Envoy Proxy][8])

**Where**
Guard in `live.ts` or a tiny middleware; config in `config/load.ts`.

**Implementation sketch**

* Semaphore cap (e.g., 100 in-flight); when exceeded → fast JSON-RPC error `-32000` with `data.reason='circuit_open'`.

**Tests**
`/tests/sprint8/circuit_breaker_sim.spec.ts`: flood requests → observe rejects after cap.

**Accept when**
Reaching the cap returns fast, then recovers.

**Plain English**

> If things are overwhelmed, fail fast instead of hanging.

**LLM priming**
`semaphore`, `inflight counter`, `circuit open`, `shed load` ([Envoy Proxy][8])

---

## Ticket-806 — Outlier detection (simulation hook)

**What / Why**
Track upstream error rates; temporarily **ban** a bad target (shadowed to logs/metrics). Mirrors Envoy **outlier detection** concept. ([Envoy Proxy][4])

**Where**
`/src/router/live.ts` or `router/policy.ts` (banlist with TTL)

**Implementation sketch**

* Sliding window error counter per target; if threshold crossed → add to banlist for N seconds and route to fallback.

**Tests**
`/tests/sprint8/outlier_detection_sim.spec.ts`: force target errors → ban kicks in → requests redirected.

**Accept when**
Ban engages and later expires.

**Plain English**

> If one upstream starts failing a lot, stop sending it traffic for a bit.

**LLM priming**
`sliding window`, `error threshold`, `banlist TTL`, `redirect to fallback` ([Envoy Proxy][4])

---

## Ticket-807 — Local rate-limit (per-process safety)

**What / Why**
Add a simple **token bucket** limiter at `/mcp` in addition to edge limiter. Envoy has a local rate-limit filter; this is our app-level mirror. ([Envoy Proxy][9])

**Where**
`/src/server/http.ts` (middleware), config in `config/load.ts`.

**Implementation sketch**

* Bucket: capacity `B`, refill `r/s`; on empty → `429` JSON-RPC error.

**Tests**
`/tests/sprint8/local_ratelimit.spec.ts`: exceed limit → 429; recovers after refill.

**Accept when**
Bursts are throttled; normal traffic unaffected.

**Plain English**

> Put a small speed bump inside the app to protect it.

**LLM priming**
`token bucket`, `refill interval`, `status 429`, `Retry-After` ([Envoy Proxy][9])

---

## Ticket-808 — Canary header split (app-level shaper)

**What / Why**
Add **header-based** traffic shaping for canary (e.g., `x-orch-canary: 1`) to force router path even when the global flag is off. Complements mesh canary %. Istio/Argo handle canary at mesh; this is developer toggle. ([Istio][3])

**Where**
`/src/server/http.ts`

**Implementation sketch**

* If header present → `liveRoute()` regardless of flag; log label `canary=header`.

**Tests**
`/tests/sprint8/canary_header_split.spec.ts`: with header → routed by live; without → flag decides.

**Accept when**
Header reliably forces canary path.

**Plain English**

> Let engineers pin a request to the new path for testing.

**LLM priming**
`if (req.headers['x-orch-canary']) routeLive()`, `percent rollout`, `canary` ([Istio][3])

---

## Ticket-809 — OTel semantic labels for routing decisions

**What / Why**
Tag spans/metrics with **standard HTTP semconv** + custom attrs: `orch.route=live|jungle`, `orch.canary=true|false`, `orch.fallback=true|false`, `target.server`. Use OTel HTTP span & metric conventions for the rest. ([OpenTelemetry][5])

**Where**
`/src/obs/otel.ts`, calls from `server/http.ts` and `router/live.ts`

**Implementation sketch**

* `span.setAttribute('orch.route','live')`, etc.; counters with same labels.

**Tests**
`/tests/sprint8/otel_semconv_labels.spec.ts`: ensure attributes exist on a sample call.

**Accept when**
Spans/metrics hold route/canary/fallback labels.

**Plain English**

> Traces and metrics say clearly which path each call took.

**LLM priming**
`Span.setAttribute`, `Semantic Conventions HTTP`, `meter.createCounter` ([OpenTelemetry][10])

---

## Ticket-810 — Mesh canary: example **VirtualService** (docs + YAML)

**What / Why**
Provide a ready-to-edit **Istio VirtualService** example that shifts traffic (10% → 25% → 50% → 100%) between `orch-v1` (pass-through) and `orch-v2` (router). Traffic shifting is the standard canary pattern. ([Istio][3])

**Where**
`/deploy/istio/virtualservice-canary.yaml`, README section

**Implementation sketch**

* Two subsets or two services; weighted routes; short instructions.

**Tests**
`/tests/sprint8/readme_cutover_runbook.spec.ts`: README references the file and explains steps.

**Accept when**
YAML validates and doc explains how to apply & adjust weights.

**Plain English**

> Show exactly how to roll traffic over slowly at the mesh layer.

**LLM priming**
`VirtualService http route weight`, `subset v1/v2`, `kubectl apply` ([Istio][3])

---

## Ticket-811 — Rollback switch (single env var or config map)

**What / Why**
Document and implement a **single switch** to force 100% Jungle path: `ORCH_ROLLBACK_TO_JUNGLE=true` overrides everything, for fast incident recovery.

**Where**
`/src/featureflags/flags.ts`, `server/http.ts`, README

**Implementation sketch**

* If rollback=true → always `proxyToJungle()`; log a clear banner.

**Tests**
`/tests/sprint8/rollback_switch.spec.ts`: with var set → all requests bypass live router.

**Accept when**
Rollback overrides header and live flags.

**Plain English**

> One emergency lever sends all traffic back to the safe path.

**LLM priming**
`config precedence`, `short-circuit`, `emergency rollback`

---

## Ticket-812 — README: Cutover & Runbook (copy-paste)

**What / Why**
Write a step-by-step **cutover guide**: enable header canary → 10% mesh → watch OTel metrics → increase → 100% → disable flag. Include rollback steps.

**Where**
`/README.md`

**Implementation sketch**

* Sections: Preconditions, Canary Steps, Observe (dashboards/metrics), Rollback, Verification (MCP contract checks still pass).

**Tests**
`/tests/sprint8/readme_cutover_runbook.spec.ts`: grep headings and key commands.

**Accept when**
Doc is clear, short, and actionable.

**Plain English**

> A single doc that shows how to turn it on safely—and off if needed.

**LLM priming**
`progressive delivery`, `feature flag`, `traffic shifting`, `observability gates` ([Octopus Deploy][2])

---

## How to run Sprint 8 tests locally

```bash
npm i
# run only Sprint 8 tests
npm run test -- tests/sprint8

# flip live router on (dev)
export ORCH_LIVE_ROUTER_ENABLED=true
npm run dev

# force canary via header for a single request
curl -s -H 'x-orch-canary: 1' -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  http://localhost:8080/mcp | jq .
```

---

### Why these priming cues work

They mirror **canonical terms & APIs** from widely used systems: progressive delivery with **feature flags** and **traffic shifting** (Istio), mesh-level **timeouts/retries**, **circuit breakers/outlier detection** patterns from Envoy, **local rate limit** safety, and **OpenTelemetry** span/metric labels that ops tools expect. That steers a decoder-only LLM toward **idiomatic, production-safe** implementations for a gradual, observable cutover. ([Octopus Deploy][2])

If you want, I can split Sprint-8 into **per-ticket Markdown files** and stub the new modules/tests so several items go green right away.

[1]: https://modelcontextprotocol.io/docs/concepts/architecture?utm_source=chatgpt.com "Architecture overview"
[2]: https://octopus.com/devops/software-deployments/progressive-delivery/?utm_source=chatgpt.com "Achieving Progressive Delivery: Challenges And Best ..."
[3]: https://istio.io/latest/docs/tasks/traffic-management/traffic-shifting/?utm_source=chatgpt.com "Traffic Shifting"
[4]: https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/outlier?utm_source=chatgpt.com "Outlier detection — envoy 1.36.0-dev-df4c4b documentation"
[5]: https://opentelemetry.io/docs/specs/semconv/http/?utm_source=chatgpt.com "Semantic conventions for HTTP"
[6]: https://modelcontextprotocol.io/docs/concepts/tools?utm_source=chatgpt.com "Tools"
[7]: https://istio.io/latest/docs/tasks/traffic-management/request-timeouts/?utm_source=chatgpt.com "Request Timeouts"
[8]: https://www.envoyproxy.io/docs/envoy/latest/configuration/upstream/cluster_manager/cluster_stats?utm_source=chatgpt.com "Circuit breakers statistics - Cluster manager"
[9]: https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/local_rate_limit_filter?utm_source=chatgpt.com "Local rate limit — envoy 1.36.0-dev-07fb38 documentation"
[10]: https://opentelemetry.io/docs/specs/semconv/http/http-spans/?utm_source=chatgpt.com "Semantic conventions for HTTP spans"
