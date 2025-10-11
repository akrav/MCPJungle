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
