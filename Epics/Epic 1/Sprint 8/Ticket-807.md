## Ticket-807 — Local rate-limit (per-process)

**Why**
Token-bucket limiter at `/mcp` to protect the app in addition to edge limiter. 

**Where**
`server/http.ts`; config via `config/load.ts`.

**Implementation sketch**

* Bucket {capacity B, refill r/s}; when empty → JSON-RPC 429 with `Retry-After`.

**Tests**
`local_ratelimit.spec.ts`: exceed → 429; recovers after refill.

**Accept when**
Bursts are throttled; normal traffic unaffected.

**LLM priming**
`token bucket`, `Retry-After`, `status 429`

---
