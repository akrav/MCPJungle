### Cursor Prompt: Execute Ticket TICKET-3204

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3204
- TICKET_NAME: Ticket-3204 — Timeout enforcement (infinite loop test)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 2/Ticket-3204.md

Permanent references (always follow):
- Epic 3 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Epic 3 Overview Draft 1.md

Code references for this ticket:
- Runner: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/runner.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint2-codemode/limits_timeout.spec.ts

Objective:
- Ensure infinite loops or long sleeps abort within maxExecutionTime and return diagnostics.

Required steps:
1) Add timeout handling to runner using configured policy.
2) Add tests (busy loop) verifying timeout and clean termination.
3) Run: `npm run test -- tests/sprint2-codemode/limits_timeout.spec.ts`.

Success criteria:
- Run ends within deadline; diagnostics contain "timed out"; tests pass.
