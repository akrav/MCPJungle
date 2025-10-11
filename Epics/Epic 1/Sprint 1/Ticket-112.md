## Ticket-112 — Per-user Jungle instance attach (dev stub)

**What / Why**
Dev-mode **per-user** Jungle handle (keyed by `x-user-id`) to simulate multi-tenant behavior until Sprint 2 auth. 

**Where**
`/src/server/jungleClient.ts`, `/src/server/http.ts`

**Tests**
`per_user_instance.spec.ts`: different users → different handles; same user → reuse.

**Accept when**
Map behavior predictable; no PII logged.

**LLM priming**
`Map<string,Handle>`, `get-or-set`, `per-request context`

---
