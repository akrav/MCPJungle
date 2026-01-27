### Cursor Prompt: Execute Ticket TICKET-3404

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3404
- TICKET_NAME: Ticket-3404 — Config flags for telemetry and code persistence (disabled by default)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 4/Ticket-3404.md

Permanent references:
- Config: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/config/{schema.ts,load.ts}

Code references for this ticket:
- Telemetry buffer: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/telemetry.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint4-obs/config_flags.spec.ts

Objective:
- Add CODEMODE_TELEMETRY and CODEMODE_PERSIST_CODE flags (default false) and a bounded redacted code preview buffer.

Required steps:
1) Extend schema/loaders; implement bounded buffer storing { run_id, code_hash, redacted_preview }.
2) Add tests for defaults and bounded buffer.

Success criteria:
- Flags parsed; buffer bounded; tests pass.
