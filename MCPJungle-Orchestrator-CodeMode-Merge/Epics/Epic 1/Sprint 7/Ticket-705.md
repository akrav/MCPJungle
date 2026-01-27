## Ticket-705 — Shadow router: compute **predicted** target (no live changes)

**What / Why**
For each inbound call, compute a **predicted** route using the catalog. Do **not** alter real routing; just log/trace.

**Where**
`/src/router/shadow.ts` (pure planner), hook from `server/http.ts`.

**Tests**
`shadow_route_plan.spec.ts`: deterministic predictions; unknown → default `jungle`.

**Accept when**
Planner is pure and deterministic; wiring runs alongside proxy.

**Plain English**

> Quietly decide where we *would* send the call—without actually doing it.

**LLM priming**
`pure function`, `deterministic`, `shadow mode`, `catalog lookup`

---
