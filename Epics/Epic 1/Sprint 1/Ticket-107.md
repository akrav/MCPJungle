## Ticket-107 — Limited retry with backoff (502/503 only)

**What / Why**
Retry **max 2** times on 502/503 with **exponential backoff + jitter**; never retry cancels. 

**Where**
`/src/server/jungleClient.ts`

**Tests**
`retry_backoff.spec.ts`: 502→502→200 succeeds; attempts counted; latency > backoff sum.

**Accept when**
Only 502/503 retried; capped attempts; jitter applied.

**LLM priming**
`exponential backoff`, `full jitter`, `retry budget`

---
