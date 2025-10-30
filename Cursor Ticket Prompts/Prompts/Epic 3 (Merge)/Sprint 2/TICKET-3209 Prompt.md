### Cursor Prompt: Execute Ticket TICKET-3209

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3209
- TICKET_NAME: Ticket-3209 — Happy path with stub invoker
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 2/Ticket-3209.md

Permanent references (always follow):
- Epic 3 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Epic 3 Overview Draft 1.md

Code references for this ticket:
- Runner + binding: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint2-codemode/happy_path_stub_invoker.spec.ts

Objective:
- E2E confirm: two sequential codemode calls flow through invoker stub and return expected result.

Required steps:
1) Implement a deterministic stub invoker for tests.
2) Add E2E test scenario composing two tool calls.
3) Run: `npm run test -- tests/sprint2-codemode/happy_path_stub_invoker.spec.ts`.

Success criteria:
- Deterministic success; invoker called with correct names/args; tests pass.
