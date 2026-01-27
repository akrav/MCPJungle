### Cursor Prompt: Execute Ticket TICKET-3403

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3403
- TICKET_NAME: Ticket-3403 — Structured logs for runs (runId, hashes, counts)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 4/Ticket-3403.md

Permanent references:
- Logger: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/obs/log.ts

Code references for this ticket:
- Runner/Invoker log calls: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint4-obs/logs_shape_redaction.spec.ts

Objective:
- Add start/end logs for runs with { run_id, user_id, code_hash, catalog_hash, tool_calls, duration_ms }.

Required steps:
1) Implement logging at start/end; ensure no raw code (hash only).
2) Add tests asserting fields and redaction.

Success criteria:
- Logs structured with fields; tests pass.
