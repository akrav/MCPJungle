## Ticket-602 — tRPC + Zod wiring (API layer)

**Why**
Type-safe server actions with input validation. ([tRPC], [Zod])

**Where**
`/admin/src/trpc/{router.ts,context.ts}`, `/admin/app/api/trpc/[trpc]/route.ts`

**Implementation sketch**

* Add `health` query that pings orchestrator `/healthz` via `fetchOrch`.

**Tests**
`trpc_router_health.spec.ts`: `health()` → `{ ok: true }`.

**Accept when**
tRPC endpoint responds through Next route handler.

**LLM priming**
`t.router`, `procedure.query`, `z.object`, `Next.js route handler`.

---
