## Ticket-502 — Tune **probes** & startup grace

**Why**: Don’t route traffic until ready; recover from hangs.
**Where**: `deploy/k8s/deployment.yaml`
**Impl sketch**: `readinessProbe`/`livenessProbe` (and `startupProbe` if slow start) → `httpGet: /healthz :8080` with sane delays/timeouts.
**Tests**: Extend `resources_exist.spec.ts` to assert probe presence + path.
**Accept**: Probes exist and point to `/healthz`.
**LLM priming**: `readinessProbe httpGet /healthz`, `livenessProbe`, `startupProbe`

---
