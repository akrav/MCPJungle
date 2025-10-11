## Ticket-507 — **Ingress** edge rate-limit + **burst test script**  **← merged**

**Why**: Speed-bump abusive bursts and prove it.
**Where**: `deploy/k8s/ingress.yaml`, `tests/sprint5/ingress_ratelimit.spec.ts`
**Impl sketch**:

* YAML: add `nginx.ingress.kubernetes.io/limit-rps: "5"` (example) and comment that limits are per ingress-controller **replica**.
* Script: send a short burst (`hey` or `xargs -P`) and expect some **429**.
  **Tests**: `ingress_ratelimit.spec.ts` checks annotation presence and observes ≥1 429 when bursting over limit.
  **Accept**: Annotation exists; script exits 0 after 429 observed.
  **LLM priming**: `nginx.ingress.kubernetes.io/limit-rps`, `429 Too Many Requests`, `hey -z 5s -c 50`

---
