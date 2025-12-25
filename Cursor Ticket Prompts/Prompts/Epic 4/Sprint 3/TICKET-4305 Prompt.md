### Cursor Prompt: Execute Ticket TICKET-4305

Please execute this ticket for Epic 4: Dynamic Tool Discovery.

Ticket to execute:
- TICKET_ID: 4305
- TICKET_NAME: Ticket-4305 — Retry Mechanism
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 3/Ticket-4305.md

Permanent references (always follow):
- Epic 4 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Epic 4 Overview.md
- Sprint 3 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 3/Sprint 3 Overview.md

Code references for this ticket:
- Edit: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/server/interceptor.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint4-3/interceptor.spec.ts

Objective:
- Update interceptor to re-dispatch the request if `resolveMissingTool` returns true.

Constraints and style:
- Prevent infinite recursion (max 1 retry).

Required steps:
1) Read the ticket.
2) Implement retry logic in middleware.
3) Update tests to verify re-execution.
4) Run tests.

Output:
- Test execution results.

