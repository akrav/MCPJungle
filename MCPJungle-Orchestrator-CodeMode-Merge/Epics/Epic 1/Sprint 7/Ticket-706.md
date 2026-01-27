## Ticket-706 — Router policy module (rule priority)

**What / Why**
Encapsulate rule priority: exact `server__tool` → server-only wildcard → fallback.

**Where**
`/src/router/policy.ts`

**Tests**
`policy_selection.spec.ts`: table-driven cases for exact/wildcard/fallback.

**Accept when**
Selection follows the priority table.

**Plain English**

> The rules for picking a server live in one tiny, testable place.

**LLM priming**
`table-driven tests`, `precedence`, `exact vs wildcard vs fallback`

---
