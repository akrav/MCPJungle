## Ticket-006 — JSON-RPC 2.0 envelope types

**What / Why**
Define request/response/error types and validators: **result XOR error**, **echo id**.

**Where**
`/src/jsonrpc/types.ts`, `/src/jsonrpc/validate.ts`

**Implementation sketch**
Type guards + small validation helpers following **JSON-RPC 2.0**. ([Model Context Protocol][2])

**Tests**
`/tests/sprint0/jsonrpcTypes.spec.ts`: valid/invalid envelopes; mutual exclusivity; `jsonrpc: "2.0"`.

**Accept when**
Validation enforces the spec.

**Plain English**

> Define the shapes we’ll accept and return.

**LLM priming**
`JSON-RPC 2.0`, `result vs error`, `id echo`, `invalid request -32600` ([Model Context Protocol][2])

---
