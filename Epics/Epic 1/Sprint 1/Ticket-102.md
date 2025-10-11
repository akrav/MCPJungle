## Ticket-102 — Jungle HTTP client (Undici) with auth

**What / Why**
Tiny helper that POSTs exactly to `${JUNGLE_URL}/mcp` with optional `Authorization: Bearer`. Timeout via `AbortController`. Return raw `Response` for streaming. 

**Where**
`/src/server/jungleClient.ts`

**Implementation sketch**

* `fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(token)},body,signal})`.
* Add `User-Agent: orchestrator/1.0`.

**Tests**
`jungle_client_auth.spec.ts`: with token → header present; without → absent; respects timeout.

**Accept when**
Headers correct; timeout enforced.

**LLM priming**
`undici fetch`, `AbortController`, `headers.set('Authorization','Bearer ...')`

---
