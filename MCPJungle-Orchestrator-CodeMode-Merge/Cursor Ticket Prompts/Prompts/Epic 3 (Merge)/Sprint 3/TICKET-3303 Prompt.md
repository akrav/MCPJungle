### Cursor Prompt: Execute Ticket TICKET-3303

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3303
- TICKET_NAME: Ticket-3303 — Session header forward + reflection
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 3/Ticket-3303.md

Permanent references:
- Orchestrator relay: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/server/http.ts

Code references for this ticket:
- Upstream helper: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/server/upstream.ts
- Invoker: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/invoker.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint3-bridge/session_header_forward.spec.ts

Objective:
- Forward Mcp-Session-Id on subsequent calls and update when reflected from Jungle.

Required steps:
1) Persist and reuse the session id across invoker calls.
2) Update on reflection header; test first/second call behavior.

Success criteria:
- Matches relay handling; tests pass.
