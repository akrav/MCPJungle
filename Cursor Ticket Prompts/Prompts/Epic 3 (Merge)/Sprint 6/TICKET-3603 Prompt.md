### Cursor Prompt: Execute Ticket TICKET-3603

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3603
- TICKET_NAME: Ticket-3603 — Health polling with timeout/backoff
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 6/Ticket-3603.md

Permanent references:
- Provisioning: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/provisioning

Code references for this ticket:
- Implement: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/provisioning/health.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint6-provisioning/health_polling.spec.ts

Objective:
- Poll /health until healthy or timeout with backoff+jitter; abort cleanly.

Required steps:
1) Implement waitForHealthy with undici fetch and AbortSignal.timeout.
2) Add tests simulating sequences and timeout.

Success criteria:
- Deterministic backoff; clean abort; tests pass.
