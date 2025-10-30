### Cursor Prompt: Execute Ticket TICKET-3301

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3301
- TICKET_NAME: Ticket-3301 — Extract shared upstream client helpers
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 3/Ticket-3301.md

Permanent references (always follow):
- Epic 3 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Epic 3 Overview Draft 1.md
- Orchestrator relay: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/server/http.ts

Code references for this ticket:
- Implement: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/server/upstream.ts
- Update imports: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/server/http.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint3-bridge/upstream_extract.spec.ts

Objective:
- Centralize Undici fetch + retries + headers into upstream.ts reusable by relay and invoker.

Required steps:
1) Implement postToJungle with retry (502/503) and AbortSignal.timeout.
2) Centralize header shaping (User-Agent, Forwarded, Authorization, x-user-id, Mcp-Session-Id).
3) Update relay to reuse; run all existing relay tests plus new spec.

Success criteria:
- Relay behavior unchanged; helper covered by tests.
