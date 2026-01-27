## Ticket-108 — Header hygiene (strip hop-by-hop; add Forwarded)

**What / Why**
Remove hop-by-hop headers; keep `Content-Type: application/json`; add `Forwarded`/`X-Forwarded-For` and `User-Agent`. 

**Where**
`/src/server/proxy.ts`

**Tests**
`headers_hygiene.spec.ts`: hop-by-hop gone; UA + Forwarded present.

**Accept when**
Headers are clean and predictable.

**LLM priming**
`Connection`, `Transfer-Encoding`, `X-Forwarded-For`, `User-Agent`

---
