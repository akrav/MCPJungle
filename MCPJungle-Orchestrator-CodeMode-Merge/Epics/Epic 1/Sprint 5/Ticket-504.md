## Ticket-504 — **PDB** to protect availability

**Why**: Keep pods up during voluntary disruptions.
**Where**: `deploy/k8s/pdb.yaml`
**Impl sketch**: `minAvailable: 1` (or `maxUnavailable: 1`) for selector `app=orchestrator`.
**Tests**: `pdb_policy.spec.ts` asserts apiVersion/kind/selector + minAvailable.
**Accept**: PDB validates; selector matches deployment.
**LLM priming**: `policy/v1 PodDisruptionBudget`, `minAvailable`, `selector`

---
