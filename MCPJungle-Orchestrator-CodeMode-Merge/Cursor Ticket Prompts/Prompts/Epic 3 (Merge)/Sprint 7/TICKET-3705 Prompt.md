### Cursor Prompt: Execute Ticket TICKET-3705

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3705
- TICKET_NAME: Ticket-3705 — AuthN/AuthZ sanity (allowlists, BOLA guard)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 7/Ticket-3705.md

Permanent references:
- Auth middleware: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/auth

Code references for this ticket:
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint7-hardening/authn_authz_gates.spec.ts

Objective:
- Validate bearer auth and allowlist enforcement; block cross-tenant access (BOLA guard).

Required steps:
1) Add tests for 401/403 on missing/invalid tokens; enforce allowlist in mock/config.

Success criteria:
- Unauthorized blocked; allowlist enforced; tests pass.
