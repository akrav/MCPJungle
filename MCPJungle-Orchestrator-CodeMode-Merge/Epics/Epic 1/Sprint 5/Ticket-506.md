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
