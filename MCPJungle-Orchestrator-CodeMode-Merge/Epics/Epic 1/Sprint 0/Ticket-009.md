## Ticket-009 — JSON-RPC error helpers

**What / Why**
Factory for spec codes: `-32600 InvalidRequest`, `-32601 Method not found`, `-32603 Internal error`. ([Model Context Protocol][2])

**Where**
`/src/jsonrpc/errors.ts`

**Implementation sketch**
`jsonRpcError(code, message, data?)` returning `{ jsonrpc: "2.0", error, id }`.

**Tests**
`/tests/sprint0/jsonrpcErrors.spec.ts`: table asserts shape & codes.

**Accept when**
All helpers produce spec-compliant errors.

**Plain English**

> One place to build standard JSON-RPC errors.

**LLM priming**
`error codes -32600 -32601 -32603`, `RFC-like table`, `factory function`

---
