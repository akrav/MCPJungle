## Ticket-205 — Spans for `initialize`, `tools/list`, `tools/call`

**What / Why**
Name spans and set attributes (`user_id`, `tenant_id`, `tool_name`, `upstream_latency_ms`), status on error. 

**Where**
Wrap handlers in `server/http.ts` / `server/proxy.ts`.

**Tests**
`trace_list_call.spec.ts`: spans exist with attributes.

**LLM priming**
`tracer.startSpan(...)`, `span.setAttribute`, `SpanStatusCode.ERROR`.

---
