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
