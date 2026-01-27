### Cursor Prompt: Execute Ticket TICKET-4301

Please execute this ticket for Epic 4: Dynamic Tool Discovery.

Ticket to execute:
- TICKET_ID: 4301
- TICKET_NAME: Ticket-4301 — Tool Installer (Persistence)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 3/Ticket-4301.md

Permanent references (always follow):
- Epic 4 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Epic 4 Overview.md
- Sprint 3 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 3/Sprint 3 Overview.md

Code references for this ticket:
- Create: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/discovery/provisioning/installer.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint4-3/installer_persistence.spec.ts

Objective:
- Implement `persistToolConfig` to save selected tools to the user's permanent configuration (DB/Manifest).

Constraints and style:
- Use Upsert logic. Map Supabase tool format to internal config format.

Required steps:
1) Read the ticket.
2) Implement persistence function.
3) Write unit tests (mocking DB).
4) Run tests.

Output:
- Test execution results.

