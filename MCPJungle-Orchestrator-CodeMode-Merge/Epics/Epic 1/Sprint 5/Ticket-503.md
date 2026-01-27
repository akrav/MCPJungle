## Ticket-503 — Add **HPA v2** (CPU baseline)

**Why**: Autoscale under load using CPU.
**Where**: `deploy/k8s/hpa.yaml`
**Impl sketch**: autoscaling/v2 HPA → min:2, max:10, CPU `targetAverageUtilization: 70`.
**Tests**: `hpa_fields.spec.ts` asserts min/max + CPU metric present.
**Accept**: HPA validates; fields correct.
**LLM priming**: `HorizontalPodAutoscaler`, `autoscaling/v2`, `targetAverageUtilization`

---
