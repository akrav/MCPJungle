# Orchestrator

## Code Mode Quickstart

- Ensure JUNGLE_URL points to your Jungle (e.g., http://localhost:9000).
- Optional verbose logs: set CODEMODE_VERBOSE_LOGS=true and CODEMODE_LOG_DIR=./logs.
- Run the live script:

```bash
npm run codemode:live
```

Expected: JSON printed with { id, docs } fields.

## Operator Runbook

- Routing modes: ROUTING_MODE=shared|per_user (default shared).
- Provisioning flags (dev/staging): PROVISIONER=none|docker|k8s, PROVISION_ON_DEMAND=true|false.
- Health timeouts: JUNGLE_HEALTH_TIMEOUT_MS, JUNGLE_HEALTH_BACKOFF_MS.
- Logs: Code Mode traces at ${CODEMODE_LOG_DIR}/codemode-run-<runId>.log when verbose enabled.


