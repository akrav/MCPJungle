## Ticket-512 — **Docs**: Stage → Prod checklist (single page)

**Why**: Copy-pasteable, deterministic deploy.
**Where**: `README.md` (Deploy section)
**Impl sketch**: Step-by-step blocks: apply LimitRange, NetworkPolicy, PDB, HPA; choose & enable mTLS (Istio/Linkerd); deploy OTel Collector; import Grafana; load alerts; set ingress limits; note HPA needs Metrics Server.
**Tests**: `docs_linked.spec.ts` greps README for each artifact name and “Deploy” section.
**Accept**: Doc includes all filenames and exact commands.
**LLM priming**: `kubectl apply -f`, `istioctl`, `linkerd inject`, `helm install` (if relevant)

---

## How to run Sprint 5 checks locally

```bash
# Lint & validate k8s YAML
bash tests/sprint5/k8s_yaml_lint.sh

# Node tests (YAML assertions, pooling)
npm run test -- tests/sprint5

# Optional: apply to kind/minikube to observe NetPol/HPA/PDB behavior
kubectl apply -f deploy/k8s/
```

---

### Why these priming cues work

They bias the agent toward **idiomatic, production-ready** manifests and code paths already called out in Sprint 5: `resources.requests/limits`, `autoscaling/v2` HPA, `PodDisruptionBudget`, `NetworkPolicy egress allowlist`, **mesh mTLS** (Istio/Linkerd), NGINX `limit-rps`, **OTel Collector** `receivers.otlp` → exporters, Grafana JSON import, Prometheus alert rules, and **Undici Agent** pooling—minimizing ambiguity and retries. 

If you want, I can also emit **stub files** (empty YAML/JSON/test shells with TODOs) so several tickets go green with near-zero extra calls.
