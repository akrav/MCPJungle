Sprint 5 is **Production Hardening & Scale**: k8s requests/limits + LimitRanges, HPA v2, PDB, NetworkPolicy (egress-only to Jungle and telemetry), service-mesh **mTLS** (Istio or Linkerd), ingress rate-limit at the edge, OTel Collector wiring, Grafana/alerts scaffolding, and connection pooling. We continue to treat **MCPJungle as the only upstream** and keep your orchestrator a pass-through. Key references we align to: Kubernetes resource mgmt & HPA, NetworkPolicy, PDB, Istio/Linkerd mTLS, NGINX ingress rate-limit annotations, and OTel Collector deployment patterns. ([Kubernetes][1])

---

# Sprint 5 — Production Hardening & Scale

**Goal**
Get the service ready for real traffic: right-sized Pods, safe autoscaling, graceful disruptions, tight network policy + **mTLS** between services, edge rate-limit, and robust telemetry/export. **HPA v2** scales replicas based on metrics; **requests/limits** protect nodes; **PDB** guards availability; **NetworkPolicy** narrows blast radius; **Istio/Linkerd** enforce mTLS in-cluster; edge rate-limit complements your app limiter; OTel Collector centralizes traces/metrics. ([Kubernetes][2])

**Rule of engagement**
Do tickets **in order**. For each ticket: write code → write tests → **run tests** → fix until green → **commit & push**. If a test fails, **loop & debug** until green, then push.

**Repo (new/updated files called out below)**

```
/orchestrator
  /deploy/k8s
    deployment.yaml                # updated with resources, probes
    hpa.yaml                       # NEW (autoscaling/v2)
    pdb.yaml                       # NEW
    networkpolicy.yaml             # NEW (egress allowlist)
    namespace-limitrange.yaml      # NEW (defaults)
    istio/peer-authn.yaml          # NEW (if using Istio)
    linkerd/README.md              # NEW (if using Linkerd)
    ingress.yaml                   # updated (edge rate-limit notes)
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
    ingress_ratelimit.spec.ts
    otel_collector_cfg.spec.ts
    pool_keepalive.spec.ts
    docs_linked.spec.ts
  README.md (updated deploy section)
```

---

## Ticket-501 — Set container **requests/limits** and namespace **LimitRange**

**What / Why**
Add CPU/memory **requests** (guarantees) and **limits** (caps) to the Deployment; set a namespace **LimitRange** so new Pods get sane defaults. This stabilizes scheduling and prevents noisy neighbors. ([Kubernetes][1])

**Where**
`/deploy/k8s/deployment.yaml`, `/deploy/k8s/namespace-limitrange.yaml`

**Implementation sketch**

* Deployment: e.g., `requests: { cpu: 100m, memory: 128Mi }`, `limits: { cpu: 500m, memory: 512Mi }` (adjust later).
* LimitRange: default requests/limits and max caps for the namespace.

**Tests**

* `/tests/sprint5/resources_exist.spec.ts`: parse YAML (js-yaml) → assert requests/limits exist.
* `/tests/sprint5/k8s_yaml_lint.sh`: `kubectl kustomize` or `kubeconform` passes.

**Accept when**
YAML validates and tests assert resources present.

**Plain English**

> Give each Pod minimum guaranteed CPU/RAM and a ceiling so it can’t hog the node.

**LLM priming**
`resources.requests`, `resources.limits`, `LimitRange`, `kubectl apply -f` ([Kubernetes][1])

---

## Ticket-502 — Tune **probes** & startup grace in Deployment

**What / Why**
Set `readinessProbe`, `livenessProbe`, and consider `startupProbe` timing tuned to `/healthz` behavior; ensures HPA/Service don’t send traffic to unready Pods. (This complements HEALTHCHECK in Docker.) ([Istio][3])

**Where**
`/deploy/k8s/deployment.yaml`

**Implementation sketch**

* `httpGet: path: /healthz, port: 8080`; `initialDelaySeconds`, `timeoutSeconds`, `periodSeconds` tuned to startup.

**Tests**

* Extend `/tests/sprint5/resources_exist.spec.ts`: verify probes are present with expected paths.

**Accept when**
Probes exist and point to `/healthz`.

**Plain English**

> Only send traffic to the app after it’s actually ready.

**LLM priming**
`readinessProbe httpGet /healthz`, `livenessProbe`, `startupProbe`

---

## Ticket-503 — Add **HPA v2** (CPU baseline)

**What / Why**
Create an **HorizontalPodAutoscaler** (autoscaling/v2) driven by CPU to add/remove replicas under load—Kubernetes’ standard scaling model. ([Kubernetes][2])

**Where**
`/deploy/k8s/hpa.yaml`

**Implementation sketch**

* Target `Deployment/orchestrator`, min 2, max 10, `metrics: resource cpu targetAverageUtilization: 70`.

**Tests**

* `/tests/sprint5/hpa_fields.spec.ts`: YAML must include min/max and CPU metric.

**Accept when**
HPA YAML validates and fields assert.

**Plain English**

> Let the cluster add pods when CPU gets hot.

**LLM priming**
`autoscaling/v2`, `HorizontalPodAutoscaler`, `targetAverageUtilization` ([Red Hat Docs][4])

---

## Ticket-504 — **PDB** to protect availability

**What / Why**
Add **PodDisruptionBudget** so voluntary disruptions (node drains) don’t drop all replicas at once. ([Kubernetes][5])

**Where**
`/deploy/k8s/pdb.yaml`

**Implementation sketch**

* For ≥2 replicas: `minAvailable: 1` (or `maxUnavailable: 1`).

**Tests**

* `/tests/sprint5/pdb_policy.spec.ts`: YAML includes PDB for the `app=orchestrator` selector.

**Accept when**
PDB validates and selector targets the Deployment.

**Plain English**

> Keep at least one pod up during maintenance.

**LLM priming**
`policy/v1 PodDisruptionBudget`, `minAvailable`, `selector` ([Kubernetes][6])

---

## Ticket-505 — **NetworkPolicy**: egress allowlist (Jungle + OTel only)

**What / Why**
Lock down egress to: MCPJungle service/namespace and the OTel collector; optionally allow DNS. This reduces the blast radius. ([Kubernetes][7])

**Where**
`/deploy/k8s/networkpolicy.yaml`

**Implementation sketch**

* Default deny egress for `app=orchestrator`.
* Allow to Jungle Service (namespaceSelector + podSelector) and OTel Collector, and UDP/53 to kube-dns.

**Tests**

* `/tests/sprint5/netpol_egress.spec.ts`: assert egress rules include Jungle and OTel destinations only.

**Accept when**
Policy compiles and selectors are correct.

**Plain English**

> Only talk to Jungle, telemetry, and DNS—nothing else.

**LLM priming**
`policy.networking.k8s.io/v1`, `egress`, `namespaceSelector`, `podSelector`, `to: ports:` ([Kubernetes][7])

---

## Ticket-506 — Service-mesh **mTLS** (Istio path)

**What / Why**
Enforce **mTLS** between in-mesh workloads with Istio **PeerAuthentication** (and/or RequestAuthentication if you later add JWT). mTLS gives authenticated, encrypted pod-to-pod traffic. ([Istio][3])

**Where**
`/deploy/k8s/istio/peer-authn.yaml`

**Implementation sketch**

* Namespace-wide `PeerAuthentication` with `mtls.mode: STRICT`.
* Note: sidecars must be injected; confirm with `istioctl`.

**Tests**

* `/tests/sprint5/docs_linked.spec.ts`: README contains an “Istio mTLS” section linking the file and apply command.

**Accept when**
File exists; docs linked; mesh notes clear.

**Plain English**

> Turn on encrypted, authenticated traffic between pods via Istio.

**LLM priming**
`PeerAuthentication mtls STRICT`, `Envoy sidecar injection`, `istioctl analyze` ([Istio][3])

---

## Ticket-507 — Service-mesh **mTLS** (Linkerd path)

**What / Why**
If using **Linkerd**, document/enable automatic **mTLS** and how to **verify** it (tap/diagnostics). Linkerd auto-mTLS is transparent to the app. ([Linkerd][8])

**Where**
`/deploy/k8s/linkerd/README.md`

**Implementation sketch**

* Steps to `linkerd inject` Deployment, confirm with `linkerd viz tap` / metrics; mention how to validate mTLS.

**Tests**

* `/tests/sprint5/docs_linked.spec.ts`: README must mention Linkerd and validation steps.

**Accept when**
Doc present with commands.

**Plain English**

> If you choose Linkerd, here’s how to enable and check mTLS.

**LLM priming**
`linkerd inject`, `automatic mTLS`, `linkerd viz`, `tap` ([Linkerd][9])

---

## Ticket-508 — **Ingress** edge rate-limit annotations (+ note on semantics)

**What / Why**
Add NGINX Ingress rate-limit annotations at the **edge** (e.g., `limit-rps`), with a note that limits are **per ingress-controller replica**, not global. Complements our app-level limiter. ([civo.com][10])

**Where**
`/deploy/k8s/ingress.yaml`

**Implementation sketch**

* Add `nginx.ingress.kubernetes.io/limit-rps: "5"` (example).
* Comment that scaling ingress replicas multiplies effective limit.

**Tests**

* `/tests/sprint5/ingress_ratelimit.spec.ts`: YAML has the expected annotations.

**Accept when**
Annotations present with cautionary comment.

**Plain English**

> Put a speed bump at the cluster edge; document how scaling changes the effective limit.

**LLM priming**
`nginx.ingress.kubernetes.io/limit-rps`, `rate limiting`, `Ingress annotations` ([NGINX Documentation][11])

---

## Ticket-509 — **OTel Collector** manifest (gateway mode)

**What / Why**
Add a basic **OpenTelemetry Collector** deployment (gateway) to receive traces/metrics/logs over OTLP and export to your backend; official pattern for k8s. ([OpenTelemetry][12])

**Where**
`/otel/collector.yaml`

**Implementation sketch**

* Receivers: `otlp` (grpc/http); Exporters: target A (e.g., Tempo/OTLP/OTLP-HTTP).
* Point orchestrator SDK env to Collector service (`OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318`).

**Tests**

* `/tests/sprint5/otel_collector_cfg.spec.ts`: parse YAML → assert `receivers.otlp` and `exporters` exist.

**Accept when**
Collector deploys and env wiring documented.

**Plain English**

> Send telemetry to a central collector that fans out to your observability backends.

**LLM priming**
`otelcol`, `receivers: otlp`, `exporters: otlphttp`, `service.pipelines` ([OpenTelemetry][13])

---

## Ticket-510 — **Grafana** starter dashboard (SLO-ish)

**What / Why**
Provide a basic Grafana dashboard JSON (requests, errors, P95 latency) using metrics emitted via OTel → Prometheus. Quick visual checks of SLOs. (You’ll refine later.)

**Where**
`/grafana/dashboards/slo_orch.json`

**Implementation sketch**

* Panels for: requests_total, errors_total, request_duration_ms P95 (or histogram quantile via PromQL).
* Document import steps in README.

**Tests**

* `/tests/sprint5/docs_linked.spec.ts`: README links the JSON with import steps.

**Accept when**
Dashboard imports and graphs populate once metrics flow.

**Plain English**

> A first dashboard to see traffic, errors, and latency at a glance.

**LLM priming**
`Grafana import JSON`, `PromQL histogram_quantile`, `OpenTelemetry → Prometheus` ([OpenTelemetry][12])

---

## Ticket-511 — **Prometheus alerts**: error rate & latency

**What / Why**
Add alerting rules: error rate > X% for Y minutes; P95 latency over budget.

**Where**
`/prometheus/rules/alerts-orch.yaml`

**Implementation sketch**

* Record rules: success/error rates; alert expressions: e.g., `rate(errors_total[5m]) / rate(requests_total[5m]) > 0.05`.
* Document how to load rules (depends on your Prom stack).

**Tests**

* `/tests/sprint5/docs_linked.spec.ts`: README links the rules file and loading instructions.

**Accept when**
Rules file exists and documented.

**Plain English**

> Get paged when users would feel pain (too many errors or slow).

**LLM priming**
`Prometheus alerting rule`, `for: 5m`, `severity: page`, `labels/annotations`

---

## Ticket-512 — **Undici Agent** keep-alive & connection pooling

**What / Why**
Enable **keep-alive** and a small connection pool to Jungle using Undici `Agent` for lower tail latencies and fewer TCP handshakes.

**Where**
`/src/server/proxy.ts` (or `jungleClient.ts`)

**Implementation sketch**

* `new Agent({ keepAliveTimeout, keepAliveMaxTimeout, pipelining: 1, connections: N })`; pass to `fetch` via `dispatcher`.
* Make pool size configurable via env.

**Tests**

* `/tests/sprint5/pool_keepalive.spec.ts`: mock server asserts `Connection: keep-alive` and low handshake churn across many requests.

**Accept when**
Repeated calls reuse connections (observed in mock logs).

**Plain English**

> Reuse HTTP connections to Jungle so calls are faster and cheaper.

**LLM priming**
`undici Agent`, `dispatcher`, `keepAlive`, `pipelining`, `connections` ([Terraform Registry][14])

---

## Ticket-513 — **Docs**: end-to-end deploy steps (Stage → Prod)

**What / Why**
Update README with a concise, copy-pasteable **Stage → Prod** checklist: apply LimitRange, NetworkPolicy, PDB, HPA; enable mTLS (Istio/Linkerd); deploy OTel Collector; import dashboard; load alerts; configure ingress limits.

**Where**
`/README.md` (Deploy section)

**Implementation sketch**

* Step-by-step bash blocks per file; note mesh choice (Istio vs Linkerd).

**Tests**

* `/tests/sprint5/docs_linked.spec.ts`: grep README for each filename and a “Deploy” section.

**Accept when**
Doc includes all artifacts and exact `kubectl` commands.

**Plain English**

> A single place with the exact commands to harden and ship this safely.

**LLM priming**
`kubectl apply -f`, `--record`, `istioctl`, `linkerd inject`, `helm install` (if relevant)

---

## Ticket-514 — **Ingress** test script for rate-limit behavior

**What / Why**
Add a tiny shell test that sends N rapid requests and verifies edge **429** from NGINX Ingress when thresholds exceeded; documents per-replica semantics. ([GitHub][15])

**Where**
`/tests/sprint5/ingress_ratelimit.spec.ts` (shell or Node)

**Implementation sketch**

* Burst > `limit-rps` using `xargs -P` or `hey`; expect some 429s.
* Note in output: “Limits are per ingress-controller replica.”

**Accept when**
Script exits 0 after observing at least one 429 when exceeding thresholds.

**Plain English**

> Prove the edge limiter actually throttles bursts.

**LLM priming**
`429 Too Many Requests`, `nginx ingress`, `limit-rps`, `hey -z 5s -c 50` ([civo.com][10])

---

## How to run Sprint 5 checks locally

```bash
# Lint & validate k8s YAML
bash tests/sprint5/k8s_yaml_lint.sh

# Node tests (YAML assertions, pooling)
npm run test -- tests/sprint5

# Optional: apply to a local cluster (kind/minikube) to observe HPA/PDB/NetPol behavior.
# (Requires Metrics Server for HPA)
kubectl apply -f deploy/k8s/
kubectl top pods -n <ns>
```

---

### Why these priming cues work

They reuse **exact resource names and field keys** common in strong examples and docs—`resources.requests/limits`, `autoscaling/v2` HPA, `PodDisruptionBudget`, `NetworkPolicy` `egress` with `namespaceSelector/podSelector`, **Istio PeerAuthentication** `mtls: STRICT`, **Linkerd automatic mTLS**, NGINX `limit-rps`, **Undici Agent** keep-alive, **OTel Collector** `receivers.otlp`—so an LLM is biased toward **idiomatic, production-ready** manifests and code. ([Kubernetes][1])

If you want, I can split these into **per-ticket Markdown files** and generate stub YAML and test scaffolding so several Sprint-5 tickets go green immediately.

[1]: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/?utm_source=chatgpt.com "Resource Management for Pods and Containers"
[2]: https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/?utm_source=chatgpt.com "Horizontal Pod Autoscaling"
[3]: https://istio.io/latest/docs/reference/config/security/peer_authentication/?utm_source=chatgpt.com "PeerAuthentication"
[4]: https://docs.redhat.com/en/documentation/openshift_container_platform/4.17/html/autoscale_apis/horizontalpodautoscaler-autoscaling-v2?utm_source=chatgpt.com "Chapter 4. HorizontalPodAutoscaler [autoscaling/v2]"
[5]: https://kubernetes.io/docs/concepts/workloads/pods/disruptions/?utm_source=chatgpt.com "Disruptions"
[6]: https://kubernetes.io/docs/tasks/run-application/configure-pdb/?utm_source=chatgpt.com "Specifying a Disruption Budget for your Application"
[7]: https://kubernetes.io/docs/concepts/services-networking/network-policies/?utm_source=chatgpt.com "Network Policies"
[8]: https://linkerd.io/2-edge/features/automatic-mtls/?utm_source=chatgpt.com "Automatic mTLS"
[9]: https://linkerd.io/2-edge/tasks/validating-your-traffic/?utm_source=chatgpt.com "Validating your mTLS traffic"
[10]: https://www.civo.com/learn/rate-limiting-applications-with-nginx-ingress?utm_source=chatgpt.com "Rate-Limiting Applications with Nginx Ingress"
[11]: https://docs.nginx.com/nginx-ingress-controller/configuration/ingress-resources/advanced-configuration-with-annotations/?utm_source=chatgpt.com "Advanced configuration with Annotations - F5 NGINX"
[12]: https://opentelemetry.io/docs/platforms/kubernetes/collector/?utm_source=chatgpt.com "OpenTelemetry Collector and Kubernetes"
[13]: https://opentelemetry.io/docs/collector/deployment/?utm_source=chatgpt.com "Deployment"
[14]: https://registry.terraform.io/providers/hashicorp/kubernetes/latest/docs/resources/pod_disruption_budget?utm_source=chatgpt.com "kubernetes_pod_disruption_bud..."
[15]: https://github.com/kubernetes/ingress-nginx/issues/12711?utm_source=chatgpt.com "[User Guide] Rate-Limit annotations lack explanation of ..."
