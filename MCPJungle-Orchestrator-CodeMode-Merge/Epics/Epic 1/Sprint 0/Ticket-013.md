## Ticket-013 — Cancel relay (basic)

**What / Why**
Accept a cancel notification for a specific `id` and forward it to Jungle using the **same id**.

**Where**
`/src/server/proxy.ts`

**Implementation sketch**
Map in-flight IDs; on cancel, forward; treat 404 from Jungle as idempotent success.

**Tests**
`/tests/sprint0/proxyCancel.spec.ts`: start long call, send cancel; verify exactly **one** terminal event.

**Accept when**
Single terminal event; call stops; no double-final.

**Plain English**

> If the caller cancels, we make Jungle cancel too.

**LLM priming**
`in-flight map`, `idempotent cancel`, `single terminal state`, `controller.abort()`

---
