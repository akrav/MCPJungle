## Ticket-207 — Metrics: counters & histograms

**What / Why**
Emit `requests_total`, `errors_total`, and `request_duration_ms` histogram. 

**Where**
`/src/obs/otel.ts` (Meter), record in `http.ts`/`proxy.ts`.

**Tests**
`metrics_histograms.spec.ts`: instruments update deterministically.

**LLM priming**
`meter.createCounter`, `createHistogram`, `record(ms)`.

---
