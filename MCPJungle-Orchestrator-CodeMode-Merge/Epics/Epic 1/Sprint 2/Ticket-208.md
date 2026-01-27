## Ticket-208 — Log ↔ trace correlation

**What / Why**
Inject `trace_id`/`span_id` into every log line from active context to correlate logs→traces. 

**Where**
`/src/obs/log.ts`

**Tests**
`log_trace_correlation.spec.ts`: captured logs include `trace_id` matching the test span.

**LLM priming**
`context.active()`, `trace.getSpan()`, `spanContext()`.

---
