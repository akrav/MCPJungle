## Ticket-802 — Live router module (uses catalog + policy)

**Why**
Actually select the upstream via catalog + policy.

**Where**
`router/live.ts`

**Implementation sketch**

* Build `canonicalId` from JSON-RPC method; pull cached catalog; `policy.selectTarget()`. Return `{target, reason}`.

**Tests**
`live_router_select.spec.ts`: table tests (exact/wildcard/fallback).

**Accept when**
Selection deterministic and matches policy.

**LLM priming**
`canonicalId(server, tool)`, `selectTarget`, `deterministic`

---
