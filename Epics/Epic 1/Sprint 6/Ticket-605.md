## Ticket-605 — CSRF token for mutations

**Why**
CSRF guard even behind JWT (Synchronizer Token Pattern). ([OWASP CSRF])

**Where**
`/admin/src/csrf/token.ts`; inject token in forms or tRPC headers.

**Implementation sketch**

* Per-session token; require header `x-csrf-token` on mutations; verify server-side.

**Tests**
`csrf_guard.spec.ts`: missing token → 403; present token → 200.

**Accept when**
Mutations require a valid token.

**LLM priming**
`x-csrf-token`, `Synchronizer Token`.

---
