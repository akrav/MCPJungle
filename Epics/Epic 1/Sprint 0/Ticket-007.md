## Ticket-007 — `/mcp` POST bootstrap (reject batches)

**What / Why**
Add `POST /mcp` that parses a single JSON-RPC **object**; reject arrays.

**Where**
`/src/server/http.ts`

**Implementation sketch**

* If `Array.isArray(body)` → **InvalidRequest (-32600)**; else parse object.
* This aligns with Streamable HTTP single-request style for MVP. ([Model Context Protocol][7])

**Tests**
`/tests/sprint0/httpBootstrap.spec.ts`: `GET /mcp` → 405; `POST []` → error; `POST {}` → placeholder success.

**Accept when**
Arrays are rejected; single object accepted.

**Plain English**

> Build the front door and refuse batch calls for now.

**LLM priming**
`Express POST route`, `JSON.parse`, `Array.isArray`, `-32600 InvalidRequest` ([Model Context Protocol][2])

---
