### Cursor Prompt: Execute Ticket TICKET-3207

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3207
- TICKET_NAME: Ticket-3207 — Result envelope + diagnostics contract
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 2/Ticket-3207.md

Permanent references (always follow):
- Epic 3 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Epic 3 Overview Draft 1.md

Code references for this ticket:
- Runner: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/runner.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint2-codemode/result_envelope.spec.ts

Objective:
- Standardize success { result } and error { diagnostics:{message} } shapes; no stacks.

Required steps:
1) Implement envelope shape in runner.
2) Add tests verifying shapes and redaction.
3) Run: `npm run test -- tests/sprint2-codemode/result_envelope.spec.ts`.

Success criteria:
- Shapes correct; redaction enforced; tests pass.
