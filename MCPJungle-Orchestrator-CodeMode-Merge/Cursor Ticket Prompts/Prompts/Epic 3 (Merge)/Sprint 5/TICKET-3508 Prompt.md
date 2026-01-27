### Cursor Prompt: Execute Ticket TICKET-3508

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3508
- TICKET_NAME: Ticket-3508 — Route decision logging & metrics
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 5/Ticket-3508.md

Permanent references:
- Logger: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/obs/log.ts
- OTel: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/obs/otel.ts

Code references for this ticket:
- Router logging: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/routing/router.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint5-routing/route_decision_logging.spec.ts

Objective:
- Log { mode, user_id, baseUrl } and count route_mode_total by mode.

Required steps:
1) Add logging and counter; ensure labels correct.
2) Add tests asserting logs and metrics.

Success criteria:
- Logs and metrics present and labeled; tests pass.
