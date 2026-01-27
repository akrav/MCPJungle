### Cursor Prompt: Execute Ticket TICKET-3208

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3208
- TICKET_NAME: Ticket-3208 — Correlation ID (runId) propagation (logs only)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 2/Ticket-3208.md

Permanent references (always follow):
- Epic 3 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Epic 3 Overview Draft 1.md
- Logging helpers: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/obs/log.ts

Code references for this ticket:
- Runner: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/runner.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint2-codemode/correlation_id.spec.ts

Objective:
- Include a stable runId in structured logs for each run.

Required steps:
1) Generate UUIDv7 if not provided; add runId to all runner logs.
2) Add tests asserting runId presence.
3) Run: `npm run test -- tests/sprint2-codemode/correlation_id.spec.ts`.

Success criteria:
- Logs include runId; no PII; tests pass.
