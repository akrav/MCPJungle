## Ticket-408 — E2E guard: batch rejection

**What / Why**
Reject array bodies with **InvalidRequest (-32600)** before proxying.

**Where**
`/tests/sprint4/batch_rejection_e2e.spec.ts`

**Implementation sketch**

* POST `[{…},{…}]`; assert JSON-RPC error; confirm zero upstream calls.

**Accept when**

* Always rejected; no upstream traffic.

**Plain English**

> No batching in MVP—prove it at the edges.

**LLM priming**
`Array.isArray`, `-32600 InvalidRequest`, `short-circuit`

---
