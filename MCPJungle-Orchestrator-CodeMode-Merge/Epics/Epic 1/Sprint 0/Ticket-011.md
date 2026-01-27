## Ticket-011 — Guardrail: reject JSON-RPC batching (again at proxy)

**What / Why**
Hard-fail if the inbound body is an array, even before proxy (defense in depth).

**Where**
`/src/server/http.ts`

**Implementation sketch**
If array → **InvalidRequest (-32600)**; do not contact Jungle. ([Model Context Protocol][2])

**Tests**
`/tests/sprint0/proxyBatchGuard.spec.ts`: POST array → error; ensure Jungle mock was not called.

**Accept when**
Arrays always return `InvalidRequest`.

**Plain English**

> Don’t allow multiple calls in one request yet.

**LLM priming**
`short-circuit`, `guard clause`, `return early`, `400-equivalent JSON-RPC`

---
