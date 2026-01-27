### Cursor Prompt: Execute Ticket TICKET-4001

Please execute this ticket for Epic 4: Dynamic Tool Discovery.

Ticket to execute:
- TICKET_ID: 4001
- TICKET_NAME: Ticket-4001 — Supabase Client Setup
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 0/Ticket-4001.md

Permanent references (always follow):
- Epic 4 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Epic 4 Overview.md
- Sprint Planning: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint Planning/Sprint Planning.md
- Sprint 0 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 0/Sprint 0 Overview.md

Code references for this ticket:
- Config: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/config/schema.ts
- Create: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/discovery/supabase/client.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint4-0/supabaseConnection.spec.ts

Objective:
- Install `@supabase/supabase-js` and configure the Supabase client singleton with environment validation.

Constraints and style:
- Use Zod for env validation. Follow singleton pattern for the client.

Required steps:
1) Read the ticket file.
2) Install dependencies.
3) Update config schema and implement client.
4) Write and run unit tests.

Output:
- Status of client setup and test results.

