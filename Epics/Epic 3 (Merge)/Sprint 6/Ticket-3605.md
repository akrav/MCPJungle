# Ticket-3605 — Teardown & garbage collection

Source: Epics/Epic 3 (Merge)/Sprint 6/Sprint 6 Overview.md (section "Ticket-3605 — Teardown & garbage collection")

What / Why
- Implement GC to stop/remove stale user instances after TTL or explicit delete.

Where
- /orchestrator/src/routing/store.ts
- /orchestrator/src/provisioning/{docker.ts,types.ts}

Implementation sketch
- store.listExpired(); GC task calls provisioner.stop(userId); then store.delete(userId). Optional timer-driven GC in dev.

Tests
- tests/sprint6-provisioning/teardown_gc.spec.ts: expired entries → stop() called and entries removed.

Accept when
- No leaks; idempotent GC runs.

Process
- Implement → write tests → run → fix → push.
