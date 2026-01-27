### Cursor Prompt: Execute Ticket TICKET-3307

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3307
- TICKET_NAME: Ticket-3307 — Header hygiene for invoker
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 3/Ticket-3307.md

Permanent references:
- Header contract reference: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/server/http.ts

Code references for this ticket:
- Upstream helper: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/server/upstream.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint3-bridge/header_hygiene_bridge.spec.ts

Objective:
- Replicate relay header rules for invoker requests.

Required steps:
1) Ensure removal of hop-by-hop headers; set UA, Forwarded, Authorization (optional), x-user-id.
2) Add tests verifying presence/absence per config.

Success criteria:
- Headers match relay expectations; tests pass.
