### Cursor Prompt: Execute Ticket TICKET-3704

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3704
- TICKET_NAME: Ticket-3704 — Size caps end-to-end (input/output)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 7/Ticket-3704.md

Permanent references:
- Relay: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/server/http.ts
- Runner/Policy: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode

Code references for this ticket:
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint7-hardening/size_caps_end_to_end.spec.ts

Objective:
- Validate oversized outputs in Code Mode trigger LimitExceeded, and oversized JSON request to /mcp returns -32600.

Required steps:
1) Add tests that exceed maxOutputBytes and content-length guard; assert expected errors.

Success criteria:
- Caps enforced with expected errors; no resource leaks; tests pass.
