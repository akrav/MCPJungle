### Cursor Prompt: Execute Ticket TICKET-3605

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3605
- TICKET_NAME: Ticket-3605 — Teardown & garbage collection
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 6/Ticket-3605.md

Permanent references:
- Router/Store: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/routing

Code references for this ticket:
- Store GC: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/routing/store.ts
- Provisioner.stop usage: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/provisioning
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint6-provisioning/teardown_gc.spec.ts

Objective:
- Implement GC to stop/remove stale user instances after TTL or explicit delete; idempotent.

Required steps:
1) listExpired(); iterate stop() then delete(); optional timer GC in dev.
2) Add tests marking expired entries and asserting cleanup.

Success criteria:
- No leaks; idempotent GC runs; tests pass.
