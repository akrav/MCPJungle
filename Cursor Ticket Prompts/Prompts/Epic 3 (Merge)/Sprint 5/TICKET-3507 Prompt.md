### Cursor Prompt: Execute Ticket TICKET-3507

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3507
- TICKET_NAME: Ticket-3507 — Fallback to shared on missing per-user mapping
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 5/Ticket-3507.md

Permanent references:
- Router: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/routing/router.ts
- Logger: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/obs/log.ts

Code references for this ticket:
- Implement fallback: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/routing/router.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint5-routing/fallback_shared_mode.spec.ts

Objective:
- Route to shared JUNGLE_URL and log a warning when mapping missing in per_user mode.

Required steps:
1) Implement deterministic fallback; log with { user_id }.
2) Add tests asserting warning and baseUrl equals shared.

Success criteria:
- Fallback works; logs clear; tests pass.
