## Ticket-202 — Method allow-list (AuthZ guard)

**What / Why**
Block unknown JSON-RPC methods; allow only `{initialize, tools/list, tools/call, cancel}` to reduce **API1 / API3** exposure. 

**Where**
`/src/auth/authorize.ts` (middleware before proxy)

**Tests**
`authz_allowlist.spec.ts`: allowed pass; others → `-32601`.

**LLM priming**
`switch(method)`, `-32601`, `least privilege`.

---
