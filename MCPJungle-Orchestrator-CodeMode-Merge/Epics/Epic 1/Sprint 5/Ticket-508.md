## Ticket-508 — **OTel Collector** (gateway mode)

**Why**: Centralize OTLP ingestion and fan-out to your backend(s).
**Where**: `otel/collector.yaml`
**Impl sketch**: `receivers: otlp {grpc,http}`; `exporters: otlphttp` (or vendor exporter); set app env `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318`.
**Tests**: `otel_collector_cfg.spec.ts` asserts receivers/exporters/pipelines exist.
**Accept**: Collector YAML validates; env wiring documented.
**LLM priming**: `otelcol`, `receivers.otlp`, `exporters`, `service.pipelines`

---
