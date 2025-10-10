References we prime against:

* **MCP** discovery/execute flow and Streamable HTTP (messages carried via JSON-RPC). ([Model Context Protocol][1])
* **JSON-RPC 2.0** spec: ID echo, result XOR error, well-known error codes. ([jsonrpc.org][2])
* **Load testing** tools & guides: **k6** and **Vegeta**. ([Grafana Labs][3])
* **OpenTelemetry** Node traces/metrics and span practices. ([OpenTelemetry][4])
* **Retry with jitter** best practices (timeouts/backoff). ([Amazon Web Services, Inc.][5])
* **Chaos** engineering primers. ([Gremlin][6])
* **SRE** readiness & launch checklists. ([Google SRE][7])

---

# Sprint 4 — MVP Test & Stabilization

**Goal**
Prove the MVP is reliable. Add tight **contract tests** for MCP behaviors, **load tests** (steady and spiky), targeted **chaos drills** (Jungle restart / latency / packet loss), correctness checks for **progress ordering** and **cancel**, and validation for **timeouts/retries** with jitter. Document a tiny **runbook** and **test matrix**.

**Rule of engagement**
Do tickets **in order**. For each ticket: write code → write tests → **run tests** → fix until green → **commit & push**. If a test fails, **loop & debug** until green, then push.

**Repo (new/updated files called out below)**

```
/orchestrator
  /src
    … (no new runtime features this sprint)
  /tests/sprint4
    contract_initialize.spec.ts
    contract_tools_list.spec.ts
    contract_tools_call.spec.ts
    progress_ordering.spec.ts
    cancel_single_terminal.spec.ts
    timeout_behavior.spec.ts
    retry_jitter.spec.ts
    http_error_mapping.spec.ts
    batch_rejection_e2e.spec.ts
    k6/list_smoke.js
    k6/call_smoke.js
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
Byte-for-byte JSON-RPC contract for `initialize`: `jsonrpc:"2.0"`, ID echo, non-null `result` with server info. ([jsonrpc.org][2])

**Where**
`/tests/sprint4/contract_initialize.spec.ts`

**Implementation sketch**

* Use **Supertest** to POST `initialize` and deep-equal response (minus dynamic fields).
* Compare against goldens if helpful (reuse Sprint-0 fixtures).

**Accept when**
All assertions pass; response conforms to JSON-RPC 2.0.

**Plain English**

> Prove the hello handshake is exactly the shape clients expect.

**LLM priming**
`supertest`, `expect(res.body).toEqual(...)`, `jsonrpc: "2.0"`, `id echo`, `result XOR error` ([jsonrpc.org][2])

---

## Ticket-402 — Contract test: `tools/list` pass-through

**What / Why**
Verify **no mutation** of Jungle’s `tools/list` envelope (IDs, fields, ordering). MCP discovery should be pass-through. ([Model Context Protocol][1])

**Where**
`/tests/sprint4/contract_tools_list.spec.ts`

**Implementation sketch**

* Mock Jungle returns a deterministic tool list; compare equality.

**Accept when**
Bodies match exactly; headers content-type correct.

**Plain English**

> When the agent asks “what tools exist?”, we hand back Jungle’s answer unchanged.

**LLM priming**
`tools/list`, `deepStrictEqual`, `application/json`

---

## Ticket-403 — Contract test: `tools/call` pass-through

**What / Why**
Ensure `tools/call` responses (including nested results) are **unmodified** and ID is preserved. ([Model Context Protocol][1])

**Where**
`/tests/sprint4/contract_tools_call.spec.ts`

**Implementation sketch**

* Mock Jungle returns a complex JSON payload; assert strict equality & ID echo.

**Accept when**
Exact match; streaming chunks reconstruct to identical JSON.

**Plain English**

> When a tool runs, we return exactly what Jungle said.

**LLM priming**
`tools/call`, `exact envelope`, `stream to buffer then JSON.parse`

---

## Ticket-404 — Progress ordering & timeliness

**What / Why**
Validate **in-order** progress frames arrive progressively (no end-buffering). Streamable HTTP implies incremental delivery. ([OpenAI GitHub][8])

**Where**
`/tests/sprint4/progress_ordering.spec.ts`

**Implementation sketch**

* Mock emits 3 progress chunks with delays; measure arrival timestamps; assert order and max inter-chunk delay threshold.

**Accept when**
Chunks are ordered and timely.

**Plain English**

> Users should see progress updates as they happen, in order.

**LLM priming**
`ReadableStream`, `getReader`, `res.write`, `timing threshold`

---

## Ticket-405 — Cancel: single terminal event

**What / Why**
After cancel, we must see **exactly one** terminal event (cancel OR final)—never both.

**Where**
`/tests/sprint4/cancel_single_terminal.spec.ts`

**Implementation sketch**

* Start long `tools/call`; send cancel; assert either cancel ack OR final, but not both.

**Accept when**
No double-finalization; stream closes.

**Plain English**

> Cancel means “stop once,” not “stop and then finish again.”

**LLM priming**
`idempotent cancel`, `inflight map`, `single terminal`

---

## Ticket-406 — Timeout behavior is bounded & clear

**What / Why**
If Jungle stalls, we **AbortController** on timeout and return a **JSON-RPC server error** containing status context; span status is ERROR. ([OpenTelemetry][4])

**Where**
`/tests/sprint4/timeout_behavior.spec.ts`

**Implementation sketch**

* Mock stalls; assert JSON-RPC error (e.g., `-32000`), message includes “timeout”; ensure no leaked handles.

**Accept when**
Bounded latency; clean shutdown.

**Plain English**

> Don’t hang forever—time out and report it clearly.

**LLM priming**
`AbortController`, `AbortSignal.timeout`, `-32000 server error`, `finally res.end()` ([OpenTelemetry][4])

---

## Ticket-407 — Retry jitter correctness (502/503 only)

**What / Why**
Unit-test **exponential backoff with jitter**, capped, for 502/503 only (others not retried). ([Amazon Web Services, Inc.][5])

**Where**
`/tests/sprint4/retry_jitter.spec.ts`

**Implementation sketch**

* Fake timers; assert attempt schedule (100ms → ~300ms with jitter); stop after cap; non-retryable codes skip.

**Accept when**
Schedule follows backoff+jitter and respects caps.

**Plain English**

> Brief blips should retry a little, not forever—and not for bad requests.

**LLM priming**
`exponential backoff`, `full jitter`, `setTimeout mock`, `status 502/503 only`

---

## Ticket-408 — HTTP error → JSON-RPC error mapping

**What / Why**
When Jungle returns non-JSON-RPC HTTP errors (e.g., HTML 502), we wrap to **JSON-RPC error** (`-32000…-32099` reserved range) with status in `data`. ([jsonrpc.org][2])

**Where**
`/tests/sprint4/http_error_mapping.spec.ts`

**Implementation sketch**

* Mock returns 502 text/html; assert JSON-RPC error envelope created with `data.status=502`.

**Accept when**
Mapping is deterministic and spec-compliant.

**Plain English**

> Turn plain HTTP failures into JSON-RPC-shaped errors.

**LLM priming**
`-32000 server error`, `error.data.status`, `content-type sniff` ([jsonrpc.org][2])

---

## Ticket-409 — E2E guard: batch rejection

**What / Why**
End-to-end test that **array bodies** are rejected with **InvalidRequest (-32600)** before proxying. ([jsonrpc.org][2])

**Where**
`/tests/sprint4/batch_rejection_e2e.spec.ts`

**Implementation sketch**

* POST `[{…},{…}]`; assert JSON-RPC error and confirm mock Jungle received **zero** upstream calls.

**Accept when**
Always rejected; no upstream traffic.

**Plain English**

> No batching in MVP—prove it at the edges.

**LLM priming**
`Array.isArray`, `-32600 InvalidRequest`, `short-circuit`

---

## Ticket-410 — k6 smoke: steady `tools/list`

**What / Why**
Light **k6** smoke to hit `/mcp` `tools/list` at low RPS for N seconds; ensure success rate ≥ 99% and P95 latency sane. ([Grafana Labs][3])

**Where**
`/tests/sprint4/k6/list_smoke.js`

**Implementation sketch**

* JS test uses `http.post()` with JSON-RPC body; thresholds on `http_req_duration` and `checks`.

**Run**
`k6 run tests/sprint4/k6/list_smoke.js`

**Accept when**
Thresholds pass consistently.

**Plain English**

> A tiny load test to see if the basics stay green.

**LLM priming**
`k6 http.post`, `thresholds`, `vus`, `duration`, `checks` ([Grafana Labs][3])

---

## Ticket-411 — k6 smoke: steady `tools/call` with progress

**What / Why**
k6 script exercises `tools/call` that emits progress (mocked); assert success rate and modest latency while streaming. ([Grafana Labs][3])

**Where**
`/tests/sprint4/k6/call_smoke.js`

**Implementation sketch**

* Use a mock endpoint producing chunked progress; k6 validates final response and timing.

**Accept when**
Checks pass with progress under load.

**Plain English**

> Light load while progress streams—should still be smooth.

**LLM priming**
`k6`, `streaming scenario`, `check(res, {...})`, `http_req_duration`

---

## Ticket-412 — Vegeta: constant-rate probe

**What / Why**
Run a **Vegeta** constant-rate probe (e.g., 50 rps for 30s) against `/mcp initialize` to measure error % and latency histograms. ([GitHub][9])

**Where**
`/tests/sprint4/vegeta/targets.list`, `/tests/sprint4/vegeta/run_const_rate.sh`

**Implementation sketch**

* `echo "POST http://localhost:8080/mcp"` in `targets.list` with JSON-RPC body; `vegeta attack -rate=50 -duration=30s | vegeta report`.

**Accept when**
Non-zero success rate ~100%; P95 stable.

**Plain English**

> A short, steady “drill” to see latency and errors.

**LLM priming**
`vegeta attack -rate`, `vegeta report`, `targets.list` ([GitHub][9])

---

## Ticket-413 — Chaos: Jungle container restart

**What / Why**
Chaos drill: restart the Jungle container mid-call; orchestrator should propagate failure cleanly (or retry if configured), without leaking file descriptors. ([Gremlin][6])

**Where**
`/tests/sprint4/chaos/jungle_restart.sh`

**Implementation sketch**

* `docker restart jungle` while a long call is running; assert client gets a single terminal JSON-RPC error and server stays healthy.

**Accept when**
One clean terminal; orchestrator remains healthy.

**Plain English**

> If Jungle dies briefly, we fail gracefully.

**LLM priming**
`docker restart`, `trap`, `single terminal`, `no handle leak`

---

## Ticket-414 — Chaos: latency & packet loss (netem)

**What / Why**
Inject **latency** and **packet loss** on the Jungle link and verify timeouts/retries behave per policy (bounded, jittered). ([Gremlin][6])

**Where**
`/tests/sprint4/chaos/netem_latency.sh`, `/tests/sprint4/chaos/netem_loss.sh`

**Implementation sketch**

* Use `tc qdisc netem delay 200ms` and `loss 5%` on the docker network (or host).
* Observe k6/Vegeta metrics and our JSON-RPC error rates.

**Accept when**
Timeouts trigger; retries limited; service stays responsive.

**Plain English**

> The network will have bad days—make sure we’re predictable then.

**LLM priming**
`tc qdisc netem`, `delay`, `loss`, `exponential backoff with jitter` ([Amazon Web Services, Inc.][5])

---

## Ticket-415 — OTel spans present & useful

**What / Why**
Assert spans for `initialize`, `tools/list`, `tools/call` exist with attributes (user/tenant/tool/latency) and that errors set span status. ([OpenTelemetry][4])

**Where**
`/tests/sprint4/otel_span_assert.spec.ts`

**Implementation sketch**

* Use an in-memory/collector stub; verify spans and key attributes.

**Accept when**
Spans appear with names/attrs; ERROR status on failures.

**Plain English**

> Traces should tell the story without guessing.

**LLM priming**
`@opentelemetry/sdk-node`, `SpanStatusCode.ERROR`, `setAttribute` ([OpenTelemetry][4])

---

## Ticket-416 — SLO smoke checklist (doc)

**What / Why**
Write a one-page SLO **smoke** doc (latency/error thresholds for MVP) and a linkable checklist modeled after **PRR/launch checklists**. ([Google SRE][7])

**Where**
`/tests/sprint4/slo_smoke_dashboard.md`, `/runbooks/test_matrix.md`

**Implementation sketch**

* Define provisional targets: success rate ≥ 99%, P95 latency budget for list/call, max error burst, etc.; record how to run k6/Vegeta scripts and read outputs.

**Accept when**
Doc is copy-paste runnable and unambiguous.

**Plain English**

> A single page that says what “good” looks like and how to check it.

**LLM priming**
`SLO`, `error budget`, `P95`, `k6 thresholds`, `vegeta report` ([Google SRE][10])

---

## Ticket-417 — MVP runbook (ops)

**What / Why**
Create an **MVP runbook**: start/stop, common errors, where logs/traces go, and how to interpret JSON-RPC error codes (spec references). ([jsonrpc.org][2])

**Where**
`/runbooks/mvp_runbook.md`, `README.md` (“Testing” section updated)

**Implementation sketch**

* Include curl examples, common HTTP→JSON-RPC mappings, and a “what to check first” flow.

**Accept when**
Runbook is actionable for on-call.

**Plain English**

> If something breaks at 2 a.m., this tells us what to do.

**LLM priming**
`runbook`, `on-call`, `first 5 minutes checks`, `json-rpc error codes table` ([jsonrpc.org][2])

---

## How to run Sprint 4 tests locally

```bash
# Unit/integration contracts
npm run test -- tests/sprint4

# k6 smoke (requires k6 installed)
k6 run tests/sprint4/k6/list_smoke.js
k6 run tests/sprint4/k6/call_smoke.js

# Vegeta constant-rate probe (requires vegeta)
bash tests/sprint4/vegeta/run_const_rate.sh

# Chaos drills (requires docker + tc netem; run carefully)
bash tests/sprint4/chaos/jungle_restart.sh
bash tests/sprint4/chaos/netem_latency.sh
bash tests/sprint4/chaos/netem_loss.sh
```

---

### Why these priming cues work

They mirror **exact tool and API names** that show up in strong training examples: Supertest contracts, JSON-RPC codes, **k6** script primitives (`http.post`, `checks`, `thresholds`), **Vegeta** CLI (`attack`, `report`), OTel Node SDK span APIs, and jitter backoff patterns from widely cited docs. That nudges a decoder-only model toward **idiomatic, testable** outputs aligned with **MCP + JSON-RPC** realities. ([Grafana Labs][3])

If you want, I can split these into **per-ticket Markdown files** and generate empty test stubs (incl. k6/Vegeta/chaos scripts) so several Sprint-4 tickets go green immediately.

[1]: https://modelcontextprotocol.io/docs/concepts/tools?utm_source=chatgpt.com "Tools"
[2]: https://www.jsonrpc.org/specification?utm_source=chatgpt.com "JSON-RPC 2.0 Specification"
[3]: https://grafana.com/docs/k6/latest/?utm_source=chatgpt.com "Grafana k6 documentation"
[4]: https://opentelemetry.io/docs/languages/js/getting-started/nodejs/?utm_source=chatgpt.com "Node.js"
[5]: https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/?utm_source=chatgpt.com "Timeouts, retries and backoff with jitter"
[6]: https://www.gremlin.com/chaos-monkey?utm_source=chatgpt.com "Chaos Monkey Guide for Engineers - Gremlin"
[7]: https://sre.google/sre-book/evolving-sre-engagement-model/?utm_source=chatgpt.com "Production Readiness Review: Engagement Insight"
[8]: https://openai.github.io/openai-agents-python/mcp/?utm_source=chatgpt.com "Model context protocol (MCP) - OpenAI Agents SDK"
[9]: https://github.com/tsenart/vegeta?utm_source=chatgpt.com "tsenart/vegeta: HTTP load testing tool and library. It's over ..."
[10]: https://sre.google/sre-book/launch-checklist/?utm_source=chatgpt.com "Appendix E. Launch Coordination Checklist"
