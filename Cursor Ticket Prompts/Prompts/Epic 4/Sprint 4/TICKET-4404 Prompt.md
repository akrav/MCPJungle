### Cursor Prompt: Execute Ticket TICKET-4404

Please execute this ticket for Epic 4: Dynamic Tool Discovery.

Ticket to execute:
- TICKET_ID: 4404
- TICKET_NAME: Ticket-4404 — Manual Selection Logic
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 4/Ticket-4404.md

Permanent references (always follow):
- Epic 4 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Epic 4 Overview.md
- Sprint 4 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 4/Sprint 4 Overview.md

Code references for this ticket:
- Edit: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/server/admin.ts
- Import: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/discovery/interaction/pendingState.ts
- Import: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/discovery/provisioning/installer.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint4-4/admin_logic.spec.ts

Objective:
- Implement the logic inside the admin route to actually install the selected tool or clear the pending state.

Constraints and style:
- Handle 'select' and 'reject' actions. Clean up state after action.

Required steps:
1) Read the ticket.
2) Implement business logic in route.
3) Write tests mocking dependencies.
4) Run tests.

Output:
- Test execution results.

