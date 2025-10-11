## Ticket-505 — **NetworkPolicy**: egress allowlist (Jungle + OTel + DNS)

**Why**: Reduce blast radius; only talk to Jungle, telemetry, and DNS.
**Where**: `deploy/k8s/networkpolicy.yaml`
**Impl sketch**: Default-deny egress for `app=orchestrator`; allow to Jungle Service (namespaceSelector+podSelector), OTel Collector, UDP/53 to kube-dns.
**Tests**: `netpol_egress.spec.ts` asserts only those egress rules exist.
**Accept**: Policy compiles; selectors correct.
**LLM priming**: `networking.k8s.io/v1`, `egress`, `namespaceSelector`, `podSelector`

---
