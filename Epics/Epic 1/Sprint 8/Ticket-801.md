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
