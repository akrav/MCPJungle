### Cursor Prompt: Execute Ticket TICKET-3607

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3607
- TICKET_NAME: Ticket-3607 — Fallback to shared on provision failure (parity w/ Sprint 5)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 6/Ticket-3607.md

Permanent references:
- Router: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/routing/router.ts
- Logger: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/obs/log.ts

Code references for this ticket:
- Implement fallback: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/routing/router.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint6-provisioning/fallback_on_fail.spec.ts

Objective:
- If provision/health fails, route to shared Jungle and log a warning with reason.

Required steps:
1) Wrap provision/health in try/catch; log reason; fallback to shared.
2) Add tests forcing failure and asserting fallback/log.

Success criteria:
- Deterministic fallback with clear diagnostics; tests pass.
