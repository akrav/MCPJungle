### Cursor Prompt: Execute Ticket TICKET-4405

Please execute this ticket for Epic 4: Dynamic Tool Discovery.

Ticket to execute:
- TICKET_ID: 4405
- TICKET_NAME: Ticket-4405 — Manual Mode Wiring
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 4/Ticket-4405.md

Permanent references (always follow):
- Epic 4 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Epic 4 Overview.md
- Sprint 4 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 4/Sprint 4 Overview.md

Code references for this ticket:
- Edit: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/discovery/index.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint4-4/manualFlow.spec.ts

Objective:
- Update `resolveMissingTool` to handle `mode === 'manual'` by storing state and prompting, instead of auto-installing.

Constraints and style:
- Do NOT call install in manual mode. Return failure/pause signal.

Required steps:
1) Read the ticket.
2) Update logic to branch on discovery mode.
3) Write integration tests.
4) Run tests.

Output:
- Test execution results.

