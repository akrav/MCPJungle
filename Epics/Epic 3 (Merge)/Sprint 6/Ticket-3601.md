# Ticket-3601 — Provisioner interface & flags

Source: Epics/Epic 3 (Merge)/Sprint 6/Sprint 6 Overview.md (section "Ticket-3601 — Provisioner interface & flags")

What / Why
- Define a clean interface for provisioners and add config flags to choose implementation and behavior.

Where
- /orchestrator/src/provisioning/types.ts
- /orchestrator/src/config/{schema.ts,load.ts}

Implementation sketch
- Interface Provisioner { provision; stop; isHealthy }.
- Flags: PROVISIONER=none|docker|k8s (default none); PROVISION_ON_DEMAND=false; JUNGLE_HEALTH_TIMEOUT_MS, JUNGLE_HEALTH_BACKOFF_MS.

Tests
- tests/sprint6-provisioning/config_flags.spec.ts: enum validation + defaults; flags exposed via loader.

Accept when
- Types compile; flags parsed with sane defaults.

Process
- Implement → write tests → run → fix → push.
