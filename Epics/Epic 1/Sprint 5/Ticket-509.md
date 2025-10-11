## Ticket-509 — **Grafana** starter dashboard (SLO-ish)

**Why**: See requests, errors, P95 in one place.
**Where**: `grafana/dashboards/slo_orch.json`
**Impl sketch**: Panels for `requests_total`, `errors_total`, histogram quantile for P95; README shows import steps.
**Tests**: `docs_linked.spec.ts` ensures README points to the JSON and import steps.
**Accept**: Dashboard imports and populates when metrics flow.
**LLM priming**: `Grafana import JSON`, `PromQL histogram_quantile`

---
