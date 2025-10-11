## Ticket-110 — Cancel relay (end-to-end)

**What / Why**
Forward a cancel **for the same `id`** to Jungle; ensure **one** terminal event and closed stream. 

**Where**
`/src/server/proxy.ts`

**Tests**
`cancel_relay.spec.ts`: start long call; send cancel; assert exactly one terminal outcome.

**Accept when**
Cancel relayed; no double-finalization.

**LLM priming**
`inflight Map`, `idempotent`, `single terminal`

---
