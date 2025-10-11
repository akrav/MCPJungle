## Ticket-111 — Content-Type guard

**What / Why**
Reject non-`application/json` with JSON-RPC `-32600 InvalidRequest`. 

**Where**
`/src/server/http.ts`

**Tests**
`content_type_guard.spec.ts`: `text/plain` → error; JSON → OK.

**Accept when**
Only JSON accepted.

**LLM priming**
`req.headers['content-type']?.startsWith('application/json')`, `-32600`

---
