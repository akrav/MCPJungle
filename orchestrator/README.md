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

## Production guidance (concise)

- Shared vs Per-user
  - Default to shared multi-tenant Jungle for most users (lower cost, warm caches, simpler ops).
  - Use per-user isolation for sensitive data, private MCP configs/keys, noisy/expensive jobs, or strict SLOs.

- Dynamic routing
  - Store a per-user policy in your DB (shared or per_user).
  - Router selects shared or provisions per-user on demand (Docker/K8s in prod) and health-checks instances; GC idle ones.

- MCP subscriptions
  - Users enable MCPs in your UI → you register those MCP endpoints into the selected registry (shared or user’s instance).
  - Calls include `x-user-id`; orchestrator routes accordingly. Code Mode runs with that user context.

- Security & ops
  - Per-user secrets (K8s Secrets), per-tenant rate limits/quotas, structured logs and metrics with userId/runId.
  - Cost controls: idle timeouts, backpressure, and safe defaults for time/memory/tool-call limits in Code Mode.


