# Sprint 6 — Per‑User Jungle Provisioning (Optional Isolation)

**Goal**  
Provision and manage dedicated MCPJungle instances per user/tenant when required (compliance/isolation), behind feature flags. Integrate with the router from Sprint 5 so missing mappings can be satisfied by on‑demand provisioning. Keep shared mode as default.

**Rule of engagement**  
Do tickets in order. For each ticket: implement → write tests → run tests → fix until green → commit & push to `Orchestrator-CodeMode-Merge`. If tests fail, loop until green before pushing.

**What we will reuse**

* Routing: `src/routing/{router.ts,store.ts}` (Sprint 5) — add provision‑on‑miss path
* Upstream: `src/server/upstream.ts` — unchanged client, dynamic baseUrl
* Code Mode: `src/codemode/{invoker.ts,runner.ts}` — router already wired
* Observability: `src/obs/{log.ts,otel.ts}` — metrics/logs
* Config: `src/config/{schema.ts,load.ts}` — extend with provisioner flags

**Repo layout (S6 additions highlighted)**

```
/orchestrator
  /src
    /provisioning                                 # NEW in S6
      types.ts                                    # Provisioner interface
      docker.ts                                   # Docker implementation
      k8s.ts                                      # K8s stub (unit-testable client; no live cluster required)
      health.ts                                   # /health polling with timeout/backoff
    /routing
      router.ts                                   # updated: ensure endpoint on miss (feature-gated)
    /config
      schema.ts                                   # updated: provisioner flags
      load.ts                                     # updated: defaults
  /tests/sprint6-provisioning                     # NEW in S6
    config_flags.spec.ts
    provisioner_interface.spec.ts
    docker_command_build.spec.ts
    health_polling.spec.ts
    router_ensure_on_miss.spec.ts
    teardown_gc.spec.ts
    metrics_and_logs.spec.ts
    fallback_on_fail.spec.ts
    e2e_two_users_isolated_endpoints.spec.ts
```

---

## Ticket-3601 — Provisioner interface & flags

**What / Why**  
Define a clean interface for provisioners and add config flags to choose implementation and behavior.

**Where**  
`/orchestrator/src/provisioning/types.ts`, `/src/config/{schema.ts,load.ts}`

**Implementation sketch**

* Interface:
  ```ts
  export interface Provisioner {
    provision(userId: string): Promise<{ baseUrl: string }>;
    stop(userId: string): Promise<void>;
    isHealthy(baseUrl: string): Promise<boolean>;
  }
  ```
* Config flags:
  - `PROVISIONER` = `none|docker|k8s` (default `none`)
  - `PROVISION_ON_DEMAND` = `true|false` (default `false`)
  - Common timeouts: `JUNGLE_HEALTH_TIMEOUT_MS` (default 20000), `JUNGLE_HEALTH_BACKOFF_MS` (default 250)

**Tests**  
`config_flags.spec.ts`: enum validation + defaults; flags exposed via loader.

**Accept when**  
Types compile; flags parsed with sane defaults.

**LLM priming**  
`z.enum`, `default(false)`, `typed config`

---

## Ticket-3602 — Docker provisioner (local dev)

**What / Why**  
Implement `docker.ts` to start/stop a Jungle container for a user in dev environments.

**Where**  
`/orchestrator/src/provisioning/docker.ts`

**Implementation sketch**

* Compose Docker CLI (or Node API if available) commands:
  - `docker run -d --name jungle-<userId> -p 0:9000 -e ... <JUNGLE_IMAGE>`
  - Capture mapped host port from `docker inspect` → `baseUrl = http://127.0.0.1:<hostPort>`
  - `docker stop/rm` for teardown
* Inject required env: tokens, minimal config.

**Tests**  
`docker_command_build.spec.ts`: unit test command composition & parsing of an `inspect` JSON sample (no live docker required).

**Accept when**  
Command strings and parsing are deterministic; no live system dependence in tests.

**LLM priming**  
`child_process.spawn`, `inspect JSON`, `dynamic host port`

---

## Ticket-3603 — Health polling with timeout/backoff

**What / Why**  
Poll `GET /health` on the provisioned endpoint until healthy or timeout.

**Where**  
`/orchestrator/src/provisioning/health.ts`

**Implementation sketch**

* `waitForHealthy(baseUrl, { timeoutMs, backoffMs })` using `undici fetch`; success on 200 JSON `{status:'ok'}`.
* Exponential backoff with jitter; abort at timeout.

**Tests**  
`health_polling.spec.ts`: simulate responses; assert backoff behavior and timeout error.

**Accept when**  
Deterministic retry/backoff; clean abort.

**LLM priming**  
`AbortSignal.timeout`, `exponential backoff`, `jitter`

---

## Ticket-3604 — Router: ensure endpoint on miss (feature-gated)

**What / Why**  
When `ROUTING_MODE=per_user` and `PROVISION_ON_DEMAND=true`, automatically provision a Jungle for a user with no mapping, then store and return it.

**Where**  
`/orchestrator/src/routing/router.ts`

**Implementation sketch**

* Add `ensureEndpoint(userId)` that consults store; on miss and feature flag, calls provisioner → health → store `set(userId, baseUrl, ttl)`; return `{ baseUrl, mode:'per_user' }`.
* Log `route_provisioned` with `{ user_id, baseUrl }`.

**Tests**  
`router_ensure_on_miss.spec.ts`: mock provisioner + health; verify store set and returned baseUrl.

**Accept when**  
Auto‑provision path engaged only under feature flag; else unchanged.

**LLM priming**  
`feature flag`, `ensure`, `store.set`

---

## Ticket-3605 — Teardown & garbage collection

**What / Why**  
Implement GC to stop/remove stale user instances after TTL or explicit delete.

**Where**  
`/orchestrator/src/routing/store.ts`, `/src/provisioning/{docker.ts,types.ts}`

**Implementation sketch**

* Extend store with `listExpired()`; a GC task (exported function) iterates and calls `provisioner.stop(userId)`; then `store.delete(userId)`.
* Provide a small timer‑driven GC in dev mode (documented; opt‑in).

**Tests**  
`teardown_gc.spec.ts`: mark entries expired; assert `stop()` called and entries removed.

**Accept when**  
No leaks; idempotent GC runs.

**LLM priming**  
`idempotent`, `TTL`, `prune`

---

## Ticket-3606 — Metrics & logs for provisioning lifecycle

**What / Why**  
Emit metrics and logs around provision/health/teardown to observe readiness and stability.

**Where**  
`/orchestrator/src/obs/otel.ts`, `src/obs/log.ts`, call sites in provisioning/router

**Implementation sketch**

* Metrics: `provision_time_ms` histogram; counters `provision_attempts_total`, `provision_failures_total`, `instances_active` gauge.
* Logs: `provision_start`, `provision_ready`, `provision_failed`, `teardown_done` with `{ user_id, baseUrl }`.

**Tests**  
`metrics_and_logs.spec.ts`: assert counters/histogram increments and log fields present (test exporter mode).

**Accept when**  
Signals recorded with correct labels; logs structured.

**LLM priming**  
`histogram`, `counter`, `gauge`, `structured logs`

---

## Ticket-3607 — Fallback to shared on provision failure (parity w/ Sprint 5)

**What / Why**  
If auto‑provision fails or health check times out, route to shared Jungle and log a warning with reason.

**Where**  
`router.ts`

**Implementation sketch**

* Catch provision/health errors; log `route_fallback_shared` with `{ user_id, reason }`; return `{ baseUrl:JUNGLE_URL, mode:'shared' }`.

**Tests**  
`fallback_on_fail.spec.ts`: force provision error; assert fallback + warning log.

**Accept when**  
Deterministic fallback with clear diagnostics.

**LLM priming**  
`try/catch`, `reason`, `deterministic`

---

## Ticket-3608 — K8s provisioner stub (client & unit tests)

**What / Why**  
Add a minimal `k8s.ts` provisioner that composes Deployment/Service manifests and returns a predictable `baseUrl` shape; unit tests only.

**Where**  
`/orchestrator/src/provisioning/k8s.ts`

**Implementation sketch**

* Pure functions to build manifests (`apiVersion`, `kind`, `metadata.labels.userId`), and compute `baseUrl` from service name + port.

**Tests**  
`provisioner_interface.spec.ts`: verify manifest fields and URL composition; conforms to `Provisioner` interface (methods throw `NotImplemented` at runtime for now).

**Accept when**  
Type‑safe stub exists; unit tests pass.

**LLM priming**  
`apiVersion`, `kind: Deployment|Service`, `metadata`, `NotImplemented`

---

## Ticket-3609 — E2E: two users auto‑provisioned and isolated (dev, stub upstream)

**What / Why**  
End‑to‑end: with `ROUTING_MODE=per_user` and `PROVISION_ON_DEMAND=true`, user A and user B get different `baseUrl` from router; Code Mode call per user hits the right endpoint (stub upstream) and returns distinct results.

**Where**  
Test only.

**Implementation sketch**

* Mock Docker provisioner + health to return distinct `baseUrl`; verify router calls and invoker requests per user go to correct host:port.

**Tests**  
`e2e_two_users_isolated_endpoints.spec.ts`: assert calls segregated by `userId` and no leakage.

**Accept when**  
E2E passes; logs show `route_provisioned` for both users.

**LLM priming**  
`ROUTING_MODE=per_user`, `PROVISION_ON_DEMAND=true`, `host:port assertions`

---

## How to run Sprint 6 tests locally

```bash
# Install deps
npm i

# Run only Sprint 6 (provisioning) tests
npm run test -- tests/sprint6-provisioning

# After tests pass, push to the feature branch
git checkout -B Orchestrator-CodeMode-Merge
git add -A && git commit -m "Epic3 S6: per-user Jungle provisioning (feature-flagged)"
git push -u origin Orchestrator-CodeMode-Merge
```

---

### Notes

* Keep provisioning behind feature flags and aimed at dev/staging first (`PROVISIONER=docker`, `PROVISION_ON_DEMAND=true`). Production K8s implementation can replace docker later under the same interface.
* Default routing remains `shared`; provisioning is opt‑in. Fallback to shared is mandatory on any failure.
* Aligns with the Code Mode model: per‑execution isolates for code; per‑user Jungle isolation is a deployment choice for tenants who need it.


