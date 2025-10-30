### Cursor Prompt: Execute Ticket TICKET-3405

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3405
- TICKET_NAME: Ticket-3405 — Limit enforcement telemetry (timeouts, memory, output, tool-calls)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 4/Ticket-3405.md

Permanent references:
- Telemetry helpers: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/telemetry.ts

Code references for this ticket:
- Runner enforcement: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/runner.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint4-obs/limits_telemetry.spec.ts

Objective:
- Emit metrics and span events when SecurityPolicy caps are hit.

Required steps:
1) Integrate metric/event calls on each limit breach.
2) Add tests forcing each limit and asserting signals.

Success criteria:
- All four limits produce telemetry; tests pass.
