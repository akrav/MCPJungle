### Cursor Prompt: Execute Ticket TICKET-3703

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3703
- TICKET_NAME: Ticket-3703 — Retry/backoff & idempotency assertions (bridge)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 7/Ticket-3703.md

Permanent references:
- Upstream helper: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/server/upstream.ts

Code references for this ticket:
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint7-hardening/retry_idempotency.spec.ts

Objective:
- Verify 502/503 retry with backoff is within budget, produces unique upstream IDs, and no duplicate side-effects.

Required steps:
1) Mock two 502s then 200; assert attempts/jitter and idempotency.

Success criteria:
- Attempts/jitter observed; single logical result; tests pass.
