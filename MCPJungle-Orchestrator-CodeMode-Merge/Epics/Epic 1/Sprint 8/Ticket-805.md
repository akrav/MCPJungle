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
