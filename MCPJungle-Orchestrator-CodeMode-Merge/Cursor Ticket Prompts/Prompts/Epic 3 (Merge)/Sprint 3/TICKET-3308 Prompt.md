### Cursor Prompt: Execute Ticket TICKET-3308

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3308
- TICKET_NAME: Ticket-3308 — Correlation ID propagation (runId)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 3/Ticket-3308.md

Permanent references:
- Logging: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/obs/log.ts

Code references for this ticket:
- Invoker: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/invoker.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint3-bridge/correlation_id_bridge.spec.ts

Objective:
- Include runId in invoker logs; propagate across start/end and per-chunk.

Required steps:
1) Add runId to relevant log entries.
2) Add tests capturing logs for runId presence.

Success criteria:
- Logs consistently include runId; tests pass.
