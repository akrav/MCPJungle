## Ticket-510 — **Prometheus alerts**: error rate & latency

**Why**: Page on user-pain (too many errors, slow responses).
**Where**: `prometheus/rules/alerts-orch.yaml`
**Impl sketch**: Record success/error rates; alerts like `rate(errors_total[5m]) / rate(requests_total[5m]) > 0.05` with `for: 5m`.
**Tests**: `docs_linked.spec.ts` ensures README links the rules and loading instructions.
**Accept**: Rules file exists and documented.
**LLM priming**: `AlertingRule`, `for: 5m`, `severity: page`, `annotations`

---
