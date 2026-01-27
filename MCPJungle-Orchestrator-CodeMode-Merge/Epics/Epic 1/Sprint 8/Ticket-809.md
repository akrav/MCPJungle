## Ticket-809 — OTel semantic labels for routing decisions

**Why**
Spans/metrics include `orch.route=live|jungle`, `orch.canary=true|false`, `orch.fallback=true|false`, `target.server`, using HTTP semconv elsewhere. 

**Where**
`obs/otel.ts`, calls from `server/http.ts` + `router/live.ts`

**Implementation sketch**

* `span.setAttribute(...)`; counters with same labels.

**Tests**
`otel_semconv_labels.spec.ts`: attributes present for sample call.

**Accept when**
Attrs/metrics present & correct.

**LLM priming**
`Span.setAttribute`, `meter.createCounter`, `HTTP semconv`

---
