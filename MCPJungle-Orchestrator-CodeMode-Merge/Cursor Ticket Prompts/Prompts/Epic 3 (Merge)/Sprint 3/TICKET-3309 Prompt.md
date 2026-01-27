### Cursor Prompt: Execute Ticket TICKET-3309

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3309
- TICKET_NAME: Ticket-3309 — E2E: two sequential tool calls via bridge (stub Jungle)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 3/Ticket-3309.md

Permanent references:
- Epic 3 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Epic 3 Overview Draft 1.md

Code references for this ticket:
- Invoker/Runner: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint3-bridge/e2e_two_calls_stub_jungle.spec.ts

Objective:
- End-to-end: two sequential codemode calls flow through invoker and produce expected result using a stub Jungle.

Required steps:
1) Implement deterministic stub upstream; write test scenario making two calls.
2) Assert order, names/args, and final result shape.

Success criteria:
- E2E test passes without flakiness.
