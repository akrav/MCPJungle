## Ticket-810 — Mesh canary: **Istio VirtualService** example (docs + YAML)

**Why**
Ready-to-edit example for 10%→25%→50%→100% traffic shifting between v1 (pass-through) and v2 (router). 

**Where**
`deploy/istio/virtualservice-canary.yaml`, README section

**Implementation sketch**

* Two subsets or services; weighted routes; short instructions.

**Tests**
`readme_cutover_runbook.spec.ts`: README references file & steps.

**Accept when**
YAML validates; doc explains how to adjust weights.

**LLM priming**
`VirtualService http route weight`, `subset v1/v2`, `kubectl apply`

---
