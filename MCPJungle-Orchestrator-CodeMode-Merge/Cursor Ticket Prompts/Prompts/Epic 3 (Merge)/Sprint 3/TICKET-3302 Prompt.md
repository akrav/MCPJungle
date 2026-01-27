### Cursor Prompt: Execute Ticket TICKET-3302

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3302
- TICKET_NAME: Ticket-3302 — Codemode invoker contract
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 3/Ticket-3302.md

Permanent references (always follow):
- Epic 3 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Epic 3 Overview Draft 1.md

Code references for this ticket:
- Implement: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/invoker.ts
- Upstream helper: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/server/upstream.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint3-bridge/invoker_tools_call.spec.ts

Objective:
- Map codemode calls to JSON-RPC tools/call and surface result content.

Required steps:
1) Build JSON-RPC envelope with uuid id; call postToJungle.
2) Guard content-type; parse JSON; return result content.
3) Run: `npm run test -- tests/sprint3-bridge/invoker_tools_call.spec.ts`.

Success criteria:
- Correct envelope; returned content validated by tests.
