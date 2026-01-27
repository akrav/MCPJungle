## Ticket-201 — Bearer token parsing (AuthN middleware)

**What / Why**
Parse `Authorization: Bearer <token>` and attach auth context to `res.locals`. Missing token → JSON-RPC `-32000` (or 401), per **RFC 6750**. 

**Where**
`/src/auth/bearer.ts` (wired early in `server/http.ts`)

**Tests**
`bearer_parse.spec.ts`: no header → error; with header → `res.locals.auth.token="..."`.

**LLM priming**
`Authorization: Bearer`, `RFC 6750`, `res.locals`, `next()`.

---
