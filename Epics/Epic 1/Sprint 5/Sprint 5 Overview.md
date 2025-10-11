# Sprint 5 — Production Hardening & Scale (Updated)

**Goal**
Right-size Pods, enable safe autoscaling, protect availability during disruptions, lock down egress, enforce in-cluster **mTLS**, add **edge rate-limit**, and wire up robust telemetry (OTel Collector → dashboards + alerts). Keep MCPJungle as the only upstream; orchestrator remains a pass-through. 

**Rule of engagement**
Do tickets **in order**. For each ticket: write code → write tests → **run tests** → fix until green → **commit & push**.

**Repo (new/updated files)**

```
/orchestrator
  /deploy/k8s
    deployment.yaml                # updated (resources, probes)
    hpa.yaml                       # NEW (autoscaling/v2)
    pdb.yaml                       # NEW
    networkpolicy.yaml             # NEW (egress allowlist)
    namespace-limitrange.yaml      # NEW (defaults)
    istio/peer-authn.yaml          # NEW (if Istio chosen)
    linkerd/README.md              # NEW (if Linkerd chosen)
    ingress.yaml                   # updated (rate-limit annotations)
  /otel
    collector.yaml                 # NEW (gateway/agent mode)
  /grafana
    dashboards/slo_orch.json       # NEW (starter dashboard)
  /prometheus
    rules/alerts-orch.yaml         # NEW (error rate/latency)
  /src/server
    proxy.ts                       # updated: Undici Agent keep-alive
  /tests/sprint5
    k8s_yaml_lint.sh
    resources_exist.spec.ts
    hpa_fields.spec.ts
    pdb_policy.spec.ts
    netpol_egress.spec.ts
    ingress_ratelimit.spec.ts      # merged: annotations + burst test
    otel_collector_cfg.spec.ts
    pool_keepalive.spec.ts
    docs_linked.spec.ts
  README.md (Deploy section updated)
```

---

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

## Ticket-502 — Tune **probes** & startup grace

**Why**: Don’t route traffic until ready; recover from hangs.
**Where**: `deploy/k8s/deployment.yaml`
**Impl sketch**: `readinessProbe`/`livenessProbe` (and `startupProbe` if slow start) → `httpGet: /healthz :8080` with sane delays/timeouts.
**Tests**: Extend `resources_exist.spec.ts` to assert probe presence + path.
**Accept**: Probes exist and point to `/healthz`.
**LLM priming**: `readinessProbe httpGet /healthz`, `livenessProbe`, `startupProbe`

---

## Ticket-503 — Add **HPA v2** (CPU baseline)

**Why**: Autoscale under load using CPU.
**Where**: `deploy/k8s/hpa.yaml`
**Impl sketch**: autoscaling/v2 HPA → min:2, max:10, CPU `targetAverageUtilization: 70`.
**Tests**: `hpa_fields.spec.ts` asserts min/max + CPU metric present.
**Accept**: HPA validates; fields correct.
**LLM priming**: `HorizontalPodAutoscaler`, `autoscaling/v2`, `targetAverageUtilization`

---

## Ticket-504 — **PDB** to protect availability

**Why**: Keep pods up during voluntary disruptions.
**Where**: `deploy/k8s/pdb.yaml`
**Impl sketch**: `minAvailable: 1` (or `maxUnavailable: 1`) for selector `app=orchestrator`.
**Tests**: `pdb_policy.spec.ts` asserts apiVersion/kind/selector + minAvailable.
**Accept**: PDB validates; selector matches deployment.
**LLM priming**: `policy/v1 PodDisruptionBudget`, `minAvailable`, `selector`

---

## Ticket-505 — **NetworkPolicy**: egress allowlist (Jungle + OTel + DNS)

**Why**: Reduce blast radius; only talk to Jungle, telemetry, and DNS.
**Where**: `deploy/k8s/networkpolicy.yaml`
**Impl sketch**: Default-deny egress for `app=orchestrator`; allow to Jungle Service (namespaceSelector+podSelector), OTel Collector, UDP/53 to kube-dns.
**Tests**: `netpol_egress.spec.ts` asserts only those egress rules exist.
**Accept**: Policy compiles; selectors correct.
**LLM priming**: `networking.k8s.io/v1`, `egress`, `namespaceSelector`, `podSelector`

---

## Ticket-506 — Service-mesh **mTLS** (Istio **or** Linkerd)  **← merged**

**Why**: Encrypted, authenticated pod-to-pod traffic.
**Where**: `deploy/k8s/istio/peer-authn.yaml` (if Istio) **or** `deploy/k8s/linkerd/README.md` (if Linkerd).
**Impl sketch**:

* **Istio**: namespace `PeerAuthentication` `mtls.mode: STRICT`; confirm sidecar injection; add `istioctl analyze` notes.
* **Linkerd**: `linkerd inject` your Deployment; verify with `linkerd viz tap` & metrics; document mTLS validation.
  **Tests**: `docs_linked.spec.ts` checks README “Service-mesh mTLS” section links chosen files/commands.
  **Accept**: File(s) present; docs show exact commands.
  **LLM priming**: `PeerAuthentication mtls STRICT`, `Envoy sidecar`, `linkerd inject`, `linkerd viz tap`

---

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

## Ticket-508 — **OTel Collector** (gateway mode)

**Why**: Centralize OTLP ingestion and fan-out to your backend(s).
**Where**: `otel/collector.yaml`
**Impl sketch**: `receivers: otlp {grpc,http}`; `exporters: otlphttp` (or vendor exporter); set app env `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318`.
**Tests**: `otel_collector_cfg.spec.ts` asserts receivers/exporters/pipelines exist.
**Accept**: Collector YAML validates; env wiring documented.
**LLM priming**: `otelcol`, `receivers.otlp`, `exporters`, `service.pipelines`

---

## Ticket-509 — **Grafana** starter dashboard (SLO-ish)

**Why**: See requests, errors, P95 in one place.
**Where**: `grafana/dashboards/slo_orch.json`
**Impl sketch**: Panels for `requests_total`, `errors_total`, histogram quantile for P95; README shows import steps.
**Tests**: `docs_linked.spec.ts` ensures README points to the JSON and import steps.
**Accept**: Dashboard imports and populates when metrics flow.
**LLM priming**: `Grafana import JSON`, `PromQL histogram_quantile`

---

## Ticket-510 — **Prometheus alerts**: error rate & latency

**Why**: Page on user-pain (too many errors, slow responses).
**Where**: `prometheus/rules/alerts-orch.yaml`
**Impl sketch**: Record success/error rates; alerts like `rate(errors_total[5m]) / rate(requests_total[5m]) > 0.05` with `for: 5m`.
**Tests**: `docs_linked.spec.ts` ensures README links the rules and loading instructions.
**Accept**: Rules file exists and documented.
**LLM priming**: `AlertingRule`, `for: 5m`, `severity: page`, `annotations`

---

## Ticket-511 — **Undici Agent** keep-alive & small pool to Jungle

**Why**: Lower tail latencies; fewer TCP handshakes.
**Where**: `src/server/proxy.ts` (or `jungleClient.ts`)
**Impl sketch**:
`new Agent({ keepAliveTimeout, keepAliveMaxTimeout, pipelining: 1, connections: N })` and pass via `dispatcher`; pool size via env.
**Tests**: `pool_keepalive.spec.ts` hits a mock many times; checks `Connection: keep-alive` and low handshake churn.
**Accept**: Connections are reused across calls.
**LLM priming**: `undici Agent`, `dispatcher`, `keepAlive`, `connections`

---

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
