## Ticket-609 — Minimal mutation **with CSRF + RBAC enforced** **and audit event**  *(merged)*

**Why**
One tiny write to prove the full security path **and** generate an **audit** entry. ([OWASP Logging Vocabulary])

**Where**
`tRPC router` (mutation), `csrf/token.ts`, `rbac.ts`, `lib/audit.ts`

**Implementation sketch**

* Mutation: e.g., “mark instance note” or “request refresh”.
* Requires `admin` + `x-csrf-token`; emits `AuditEvent { ts, actorSub, action, subject, details }`.

**Tests**

* Update `csrf_guard.spec.ts` & `rbac_guard.spec.ts` to require both.
* `audit_log_write.spec.ts`: event is appended with required fields.

**Accept when**
Without either guard → failure; with both → success; audit written.

**LLM priming**
`tRPC mutation`, `requireRole('admin')`, `x-csrf-token`, `append-only audit`.

---
