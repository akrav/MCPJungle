## Ticket-607 — Requests page (recent /mcp calls)

**Why**
Observe recent calls (method, duration, status) with **no PII**; link to trace/span if available. ([OWASP Logging])

**Where**
`/admin/app/requests/page.tsx`, `fetchOrch.listRecentRequests()`

**Implementation sketch**

* Table of sanitized entries; optional traceId link.

**Tests**
`requests_table.spec.tsx`: required columns present; no sensitive fields.

**Accept when**
Sanitized table renders.

**LLM priming**
`structured logging`, `trace_id`, `no PII`.

---
