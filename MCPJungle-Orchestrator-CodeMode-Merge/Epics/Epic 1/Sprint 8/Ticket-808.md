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
