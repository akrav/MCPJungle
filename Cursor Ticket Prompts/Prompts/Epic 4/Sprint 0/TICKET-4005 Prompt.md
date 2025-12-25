### Cursor Prompt: Execute Ticket TICKET-4005

Please execute this ticket for Epic 4: Dynamic Tool Discovery.

Ticket to execute:
- TICKET_ID: 4005
- TICKET_NAME: Ticket-4005 — Integration Smoke Test
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 0/Ticket-4005.md

Permanent references (always follow):
- Epic 4 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Epic 4 Overview.md
- Sprint 0 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 0/Sprint 0 Overview.md

Code references for this ticket:
- Test: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint4-0/integrationSmoke.spec.ts

Objective:
- Verify real connectivity to Supabase by fetching tools in a smoke test.

Constraints and style:
- Skip test if env vars are missing. Do not mock; use real connection (or high fidelity mock if offline).

Required steps:
1) Read the ticket.
2) Implement integration test script.
3) Run test with valid credentials.

Output:
- Successful connection confirmation.

