## Ticket-604 — RBAC guard (Admin / Viewer)

**Why**
`viewer` = read; `admin` = mutate. ([NIST RBAC])

**Where**
`/admin/src/auth/rbac.ts`

**Implementation sketch**

* Helpers: `requireRole('viewer')`, `requireRole('admin')` as tRPC middleware.

**Tests**
`rbac_guard.spec.ts`: viewer blocked on mutate; admin allowed.

**Accept when**
Role checks behave as expected.

**LLM priming**
`RBAC`, `role→permission`, `tRPC middleware`.

---
