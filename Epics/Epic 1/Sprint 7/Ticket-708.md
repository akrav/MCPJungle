## Ticket-708 — ID echo invariants still hold

**What / Why**
New modules must never touch JSON-RPC IDs. Re-assert string/number IDs are echoed exactly.

**Where**
Tests only: `/tests/sprint7/id_invariants_still_hold.spec.ts`

**Accept when**
IDs match exactly; shadow logs contain same IDs.

**Plain English**

> Even with the new parts, request IDs stay untouched.

**LLM priming**
`jsonrpc id echo`, `must not be null`, `string|number`

---
