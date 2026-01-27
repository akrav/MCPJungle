### Cursor Prompt: Execute Ticket TICKET-4304

Please execute this ticket for Epic 4: Dynamic Tool Discovery.

Ticket to execute:
- TICKET_ID: 4304
- TICKET_NAME: Ticket-4304 — Auto-Install Wiring
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 3/Ticket-4304.md

Permanent references (always follow):
- Epic 4 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Epic 4 Overview.md
- Sprint 3 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 3/Sprint 3 Overview.md

Code references for this ticket:
- Create: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/discovery/index.ts
- Import: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/discovery/search/index.ts
- Import: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/discovery/selection/index.ts
- Import: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/discovery/provisioning/installer.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint4-3/autoInstallFlow.spec.ts

Objective:
- Implement `resolveMissingTool` connecting Search -> Selection -> Installer.

Constraints and style:
- Only install if `autoSelected` is present and mode is `auto`.

Required steps:
1) Read the ticket.
2) Implement orchestration logic.
3) Write integration tests mocking sub-services.
4) Run tests.

Output:
- Test execution results.

