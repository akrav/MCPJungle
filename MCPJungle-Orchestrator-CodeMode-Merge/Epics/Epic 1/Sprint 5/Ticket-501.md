## Ticket-501 — Set container **requests/limits** + namespace **LimitRange**

**Why**: Stable scheduling, prevent noisy neighbors.
**Where**: `deploy/k8s/deployment.yaml`, `deploy/k8s/namespace-limitrange.yaml`
**Impl sketch**:

* Deployment: `requests: {cpu: 100m, memory: 128Mi}`; `limits: {cpu: 500m, memory: 512Mi}` (tune later).
* LimitRange: default requests/limits + sensible max.
  **Tests**: `resources_exist.spec.ts` parses YAML (js-yaml) and asserts keys. `k8s_yaml_lint.sh` validates.
  **Accept**: Keys present, YAML validates.
  **LLM priming**: `resources.requests/limits`, `LimitRange`, `kubectl apply -f`

---
