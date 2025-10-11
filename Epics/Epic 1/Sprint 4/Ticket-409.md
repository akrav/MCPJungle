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
