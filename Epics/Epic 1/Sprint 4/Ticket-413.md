## Ticket-413 — OTel spans present & useful

**What / Why**
Spans for `initialize`, `tools/list`, `tools/call` with key attrs (user/tenant/tool/latency); errors set span status.

**Where**
`/tests/sprint4/otel_span_assert.spec.ts`

**Implementation sketch**

* In-memory collector stub; verify names/attributes; failures mark `ERROR`.

**Accept when**

* Spans present with attrs; ERROR status on failures.

**Plain English**

> Traces should tell the story without guessing.

**LLM priming**
`@opentelemetry/sdk-node`, `SpanStatusCode.ERROR`, `setAttribute`

---
