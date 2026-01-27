### Cursor Prompt: Execute Ticket TICKET-3601

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3601
- TICKET_NAME: Ticket-3601 — Provisioner interface & flags
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 6/Ticket-3601.md

Permanent references:
- Config: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/config/{schema.ts,load.ts}

Code references for this ticket:
- Implement interface: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/provisioning/types.ts
- Config updates: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/config
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint6-provisioning/config_flags.spec.ts

Objective:
- Define Provisioner interface and add PROVISIONER/PROVISION_ON_DEMAND flags with defaults/timeouts.

Required steps:
1) Implement interface; extend config schema/loaders; set sane defaults.
2) Add tests for enum validation and defaults.

Success criteria:
- Types compile; flags parsed; tests pass.
