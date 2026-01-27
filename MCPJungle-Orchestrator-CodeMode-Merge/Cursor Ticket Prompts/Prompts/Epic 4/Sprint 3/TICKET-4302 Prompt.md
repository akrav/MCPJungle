### Cursor Prompt: Execute Ticket TICKET-4302

Please execute this ticket for Epic 4: Dynamic Tool Discovery.

Ticket to execute:
- TICKET_ID: 4302
- TICKET_NAME: Ticket-4302 — Tool Installer (Runtime Refresh)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 3/Ticket-4302.md

Permanent references (always follow):
- Epic 4 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Epic 4 Overview.md
- Sprint 3 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 3/Sprint 3 Overview.md

Code references for this ticket:
- Edit: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/discovery/provisioning/installer.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint4-3/installer_runtime.spec.ts

Objective:
- Implement `installTool` which calls `persistToolConfig` and then triggers a Router refresh.

Constraints and style:
- Ensure cache invalidation/reload happens after persistence.

Required steps:
1) Read the ticket.
2) Implement the wrapper function.
3) Write unit tests (spying on refresh call).
4) Run tests.

Output:
- Test execution results.

