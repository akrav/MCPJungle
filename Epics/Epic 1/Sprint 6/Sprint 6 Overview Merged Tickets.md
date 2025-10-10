# Sprint 4 — MVP Test & Stabilization (Updated, Sequential IDs)

**Goal**
Prove the MVP is reliable. Add tight **contract tests** for MCP behaviors, **load tests** (steady and spiky), targeted **chaos drills** (Jungle restart / latency / packet loss), correctness checks for **progress ordering** and **cancel**, and validation for **timeouts/retries** with jitter. Document a tiny **runbook** and **test matrix**.

**What changed (merges kept, numbering fixed)**

* **Discovery + Execute contract** combined into a single pass-through suite.
* **k6 smokes** (list + call with progress) combined into one script with two scenarios.
* All tickets renumbered sequentially (no gaps).

**Rule of engagement**
Do tickets **in order**. For each ticket: write code → write tests → **run tests** → fix until green → **commit & push**. If a test fails, loop & debug until green, then push.

**Repo (new/updated files called out below)**

```
/orchestrator
  /src
    … (no new runtime features this sprint)
  /tests/sprint4
    contract_initialize.spec.ts
    contract_pass_through.spec.ts          # merged (list + call)
    progress_ordering.spec.ts
    cancel_single_terminal.spec.ts
    timeout_behavior.spec.ts
    retry_jitter.spec.ts
    http_error_mapping.spec.ts
    batch_rejection_e2e.spec.ts
    k6/smoke_scenarios.js                  # merged (two scenarios)
    vegeta/targets.list
    vegeta/run_const_rate.sh
    chaos/jungle_restart.sh
    chaos/netem_latency.sh
    chaos/netem_loss.sh
    otel_span_assert.spec.ts
    slo_smoke_dashboard.md
  /runbooks
    mvp_runbook.md
    test_matrix.md
  README.md (updated “Testing” section)
```

---

## Ticket-401 — Contract test: `initialize` handshake

**What / Why**
Byte-for-byte JSON-RPC contract for `initialize`: `jsonrpc:"2.0"`, ID echo, non-null `result` with server info.

**Where**
`/tests/sprint4/contract_initialize.spec.ts`

**Implementation sketch**

* Use **Supertest** to POST `initialize` and deep-equal the envelope (mask dynamic fields).
* Optional: compare to known goldens.

**Accept when**

* Response conforms to JSON-RPC 2.0 (result XOR error, id echo), assertions pass.

**Plain English**

> Prove the hello handshake matches exactly what clients expect.

**LLM priming**
`supertest`, `expect(res.body).toEqual(...)`, `jsonrpc: "2.0"`, `id echo`, `result XOR error`

---

## Ticket-402 — Contract pass-through: `tools/list` **and** `tools/call`  *(merged)*

**What / Why**
One suite that proves **no mutation** of envelopes for discovery (`tools/list`) and execution (`tools/call`), including ID preservation and stream reassembly.

**Where**
`/tests/sprint4/contract_pass_through.spec.ts`

**Implementation sketch**

* Mock Jungle with deterministic responses:

  * **list**: stable order/fields.
  * **call**: nested JSON payload + streamed chunks.
* Buffer streamed chunks, `JSON.parse`, and `deepStrictEqual` vs mocks.
* Verify `content-type: application/json`.

**Accept when**

* Exact body match for both list and call; ID preserved; streaming reassembles identically.

**Plain English**

> We pass back exactly what Jungle said—no edits, no reorder.

**LLM priming**
`tools/list`, `tools/call`, `exact envelope`, `stream→buffer→JSON.parse`, `deepStrictEqual`, `application/json`

---

## Ticket-403 — Progress ordering & timeliness

**What / Why**
Validate **in-order** progress frames arrive progressively (no end-buffering). Streamable HTTP must deliver incrementally.

**Where**
`/tests/sprint4/progress_ordering.spec.ts`

**Implementation sketch**

* Mock emits 3 progress chunks with staggered delays.
* Capture arrival times; assert order and a max inter-chunk delay threshold.

**Accept when**

* Chunks are ordered and timely.

**Plain English**

> Users should see progress updates as they happen, in order.

**LLM priming**
`ReadableStream`, `getReader`, `res.write`, `timing threshold`

---

## Ticket-404 — Cancel: single terminal event

**What / Why**
After cancel, we must see **exactly one** terminal event (cancel OR final)—never both.

**Where**
`/tests/sprint4/cancel_single_terminal.spec.ts`

**Implementation sketch**

* Start long `tools/call`; send cancel; assert either cancel ack **or** final, not both.
* Ensure stream closes, no double-finalization.

**Accept when**

* Single terminal outcome; stream closed.

**Plain English**

> Cancel means “stop once,” not “stop and then finish again.”

**LLM priming**
`idempotent cancel`, `inflight map`, `single terminal`

---

## Ticket-405 — Timeout behavior is bounded & clear

**What / Why**
If Jungle stalls, use **AbortController** and return a **JSON-RPC server error** with timeout context; span status = ERROR.

**Where**
`/tests/sprint4/timeout_behavior.spec.ts`

**Implementation sketch**

* Mock stall. Assert JSON-RPC error (e.g., `-32000`), message includes “timeout”.
* Verify no leaked handles; span marked ERROR.

**Accept when**

* Bounded latency; clear error; clean shutdown.

**Plain English**

> Don’t hang forever—time out and report it clearly.

**LLM priming**
`AbortController`, `AbortSignal.timeout`, `-32000 server error`, `finally res.end()`, `SpanStatusCode.ERROR`

---

## Ticket-406 — Retry jitter correctness (502/503 only)

**What / Why**
Unit-test **exponential backoff with jitter**, capped, retried only on 502/503.

**Where**
`/tests/sprint4/retry_jitter.spec.ts`

**Implementation sketch**

* Fake timers. Assert schedule (e.g., 100ms → ~300ms with jitter), cap honored.
* Non-retryable codes skip.

**Accept when**

* Schedule follows backoff+jitter; caps respected; other codes not retried.

**Plain English**

> Brief blips should retry a little, not forever—and not for bad requests.

**LLM priming**
`exponential backoff`, `full jitter`, `setTimeout mock`, `status 502/503 only`

---

## Ticket-407 — HTTP error → JSON-RPC error mapping

**What / Why**
Map non-JSON-RPC HTTP errors (e.g., HTML 502) to **JSON-RPC error** (`-32000…-32099`) with status in `error.data`.

**Where**
`/tests/sprint4/http_error_mapping.spec.ts`

**Implementation sketch**

* Mock 502 text/html; assert envelope with `error.data.status=502`.

**Accept when**

* Deterministic, spec-compliant mapping.

**Plain English**

> Turn plain HTTP failures into JSON-RPC-shaped errors.

**LLM priming**
`-32000 server error`, `error.data.status`, `content-type sniff`

---

## Ticket-408 — E2E guard: batch rejection

**What / Why**
Reject array bodies with **InvalidRequest (-32600)** before proxying.

**Where**
`/tests/sprint4/batch_rejection_e2e.spec.ts`

**Implementation sketch**

* POST `[{…},{…}]`; assert JSON-RPC error; confirm zero upstream calls.

**Accept when**

* Always rejected; no upstream traffic.

**Plain English**

> No batching in MVP—prove it at the edges.

**LLM priming**
`Array.isArray`, `-32600 InvalidRequest`, `short-circuit`

---

## Ticket-409 — k6 smoke: `tools/list` **and** `tools/call` with progress  *(merged)*

**What / Why**
One **k6** script with two scenarios: steady `tools/list` + steady `tools/call` (mocked progress). Ensures ≥99% success and sane P95 latency under light load.

**Where**
`/tests/sprint4/k6/smoke_scenarios.js`

**Implementation sketch**

* Scenario A: `http.post()` JSON-RPC `tools/list`, thresholds on `http_req_duration`, success checks.
* Scenario B: `tools/call` that streams progress; validate final envelope + timing.

**Run**
`k6 run tests/sprint4/k6/smoke_scenarios.js`

**Accept when**

* Both scenarios pass checks and thresholds.

**Plain English**

> Light load stays green—even while progress streams.

**LLM priming**
`k6 http.post`, `scenarios`, `check(res, {...})`, `thresholds`, `vus`, `duration`, `http_req_duration`

---

## Ticket-410 — Vegeta: constant-rate probe

**What / Why**
Run **Vegeta** constant-rate probe (e.g., 50 rps for 30s) against `/mcp initialize`; report error % and latency histogram.

**Where**
`/tests/sprint4/vegeta/targets.list`, `/tests/sprint4/vegeta/run_const_rate.sh`

**Implementation sketch**

* `targets.list` includes POST with JSON-RPC body.
* `vegeta attack -rate=50 -duration=30s | vegeta report`.

**Accept when**

* Success ≈ 100%; stable P95.

**Plain English**

> A short steady drill to check latency and errors.

**LLM priming**
`vegeta attack -rate`, `vegeta report`, `targets.list`

---

## Ticket-411 — Chaos: Jungle container restart

**What / Why**
Restart Jungle mid-call; orchestrator should propagate failure cleanly (or retry if configured), no descriptor leaks.

**Where**
`/tests/sprint4/chaos/jungle_restart.sh`

**Implementation sketch**

* `docker restart jungle` while long call runs; assert a **single** terminal JSON-RPC error; health checks stay OK.

**Accept when**

* One clean terminal; orchestrator healthy afterward.

**Plain English**

> If Jungle dies briefly, we fail gracefully.

**LLM priming**
`docker restart`, `trap`, `single terminal`, `no handle leak`

---

## Ticket-412 — Chaos: latency & packet loss (netem)

**What / Why**
Inject **latency** & **packet loss** on Jungle link; verify timeouts/retries follow policy (bounded, jittered).

**Where**
`/tests/sprint4/chaos/netem_latency.sh`, `/tests/sprint4/chaos/netem_loss.sh`

**Implementation sketch**

* `tc qdisc netem delay 200ms` and `loss 5%` on docker network/host.
* Observe k6/Vegeta metrics and JSON-RPC error rates.

**Accept when**

* Timeouts trigger; retries limited; service responsive.

**Plain English**

> The network will have bad days—be predictable then.

**LLM priming**
`tc qdisc netem`, `delay`, `loss`, `exponential backoff with jitter`

---

## Ticket-413 — OTel spans present & useful

**What / Why**
Spans for `initialize`, `tools/list`, `tools/call` with key attrs (user/tenant/tool/latency); errors set span status.

**Where**
`/tests/sprint4/otel_span_assert.spec.ts`

**Implementation sketch**

* In-memory collector stub; verify names/attributes; failures mark `ERROR`.

**Accept when**

* Spans present with attrs; ERROR status on failures.

**Plain English**

> Traces should tell the story without guessing.

**LLM priming**
`@opentelemetry/sdk-node`, `SpanStatusCode.ERROR`, `setAttribute`

---

## Ticket-414 — SLO smoke checklist (doc)

**What / Why**
One-page SLO **smoke** doc (latency/error thresholds) + linkable checklist patterned after PRR/launch checklists. Include how to run k6/Vegeta and read outputs.

**Where**
`/tests/sprint4/slo_smoke_dashboard.md`, `/runbooks/test_matrix.md`

**Implementation sketch**

* Define provisional targets: success ≥ 99%, P95 budgets, max error burst, etc.

**Accept when**

* Copy-paste runnable and unambiguous.

**Plain English**

> One page that says what “good” looks like and how to check it.

**LLM priming**
`SLO`, `error budget`, `P95`, `k6 thresholds`, `vegeta report`

---

## Ticket-415 — MVP runbook (ops)

**What / Why**
Create an **MVP runbook**: start/stop, common errors, logs/traces locations, JSON-RPC error code interpretations.

**Where**
`/runbooks/mvp_runbook.md`, `README.md` (Testing section updated)

**Implementation sketch**

* Curl examples, HTTP→JSON-RPC mappings, “what to check first” flow.

**Accept when**

* On-call actionable.

**Plain English**

> If something breaks at 2 a.m., this tells us what to do.

**LLM priming**
`runbook`, `on-call`, `first 5 minutes checks`, `json-rpc error codes table`

---

## How to run Sprint 4 tests locally

```bash
# Unit/integration contracts
npm run test -- tests/sprint4

# k6 smoke (two scenarios in one script)
k6 run tests/sprint4/k6/smoke_scenarios.js

# Vegeta constant-rate probe
bash tests/sprint4/vegeta/run_const_rate.sh

# Chaos drills (docker + tc netem; run carefully)
bash tests/sprint4/chaos/jungle_restart.sh
bash tests/sprint4/chaos/netem_latency.sh
bash tests/sprint4/chaos/netem_loss.sh
```

If you want, I can drop in tiny file skeletons for each ticket (headers + TODOs + example asserts) to reduce LLM round-trips further.
