### Cursor Prompt: Execute Ticket TICKET-3306

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3306
- TICKET_NAME: Ticket-3306 — Error mapping parity with HTTP relay
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 3/Ticket-3306.md

Permanent references:
- Relay behavior: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/server/http.ts

Code references for this ticket:
- Invoker mapping: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/invoker.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint3-bridge/error_mapping_bridge.spec.ts

Objective:
- Match relay error mapping: pass-through JSON errors; non-JSON → JSON-RPC -32000 with data.status.

Required steps:
1) Implement content-type sniffing; mapping to standard error shape.
2) Add tests for 502/HTML and JSON-RPC error pass-through.

Success criteria:
- Deterministic mapping identical to relay; tests pass.
