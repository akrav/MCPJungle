## Ticket-310 — (Optional) **K8s skeleton** manifests

**What / Why**
Placeholders for later sprints with **readiness/liveness/startup** probes to `/healthz`. (Keep dry; don’t apply yet.) 

**Where**
`/deploy/k8s/deployment.yaml`, `/deploy/k8s/service.yaml`

**Accept when**
YAML is valid and documented as **placeholder**.

**LLM priming**
`readinessProbe httpGet /healthz`, `livenessProbe`, `startupProbe`

---

## How to run Sprint 3 tests locally

```bash
# Build the image
bash tests/sprint3/docker_build.test.sh

# Run container and verify /healthz
bash tests/sprint3/docker_run_health.test.sh

# Validate compose & bring up the stack
bash tests/sprint3/compose_config.test.sh
bash tests/sprint3/compose_up_health.test.sh
```

---

### Why these priming cues work

They match well-trodden patterns from Docker, Compose startup order, and GitHub Actions Buildx/GHCR docs—so an LLM produces **idiomatic, low-ambiguity** edits that pass your scripts on the first try. 

If you want, I can also generate tiny **stub scripts/YAML** with TODOs so several tickets go green with near-zero extra calls.
