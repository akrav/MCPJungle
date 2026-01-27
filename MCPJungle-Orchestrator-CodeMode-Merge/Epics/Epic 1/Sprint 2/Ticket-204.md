## Ticket-204 — OpenTelemetry bootstrap (Node SDK)

**What / Why**
Set up **OTLP exporters** for traces/metrics, auto-instrument `http` and `undici`; `Resource.service.name="orchestrator"`. 

**Where**
`/src/obs/otel.ts` (called from startup in `server/http.ts`)

**Tests**
`trace_init.spec.ts`: request emits a root span in a test exporter.

**LLM priming**
`@opentelemetry/sdk-node`, `OTLPTraceExporter`, `Resource`.

---
