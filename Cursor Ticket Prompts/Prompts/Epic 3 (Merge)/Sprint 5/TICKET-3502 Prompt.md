### Cursor Prompt: Execute Ticket TICKET-3502

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3502
- TICKET_NAME: Ticket-3502 — Config: routing flags and defaults
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 5/Ticket-3502.md

Permanent references:
- Config: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/config/{schema.ts,load.ts}

Code references for this ticket:
- Implement: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/config/schema.ts
- Implement: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/config/load.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint5-routing/config_modes.spec.ts

Objective:
- Add ROUTING_MODE env (shared|per_user, default shared) and expose via typed config.

Required steps:
1) Zod enum; default; update types; tests for invalid/valid/default.

Success criteria:
- Flags parsed; tests pass.
