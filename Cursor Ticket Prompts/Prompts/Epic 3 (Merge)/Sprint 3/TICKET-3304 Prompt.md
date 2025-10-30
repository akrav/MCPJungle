### Cursor Prompt: Execute Ticket TICKET-3304

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3304
- TICKET_NAME: Ticket-3304 — Streaming aggregate to final result
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 3/Ticket-3304.md

Permanent references:
- Upstream helper: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/server/upstream.ts

Code references for this ticket:
- Invoker: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/invoker.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint3-bridge/streaming_aggregate.spec.ts

Objective:
- Buffer streaming JSON and parse into a final result for Code Mode; log chunk boundaries.

Required steps:
1) Implement incremental buffering and final parse in invoker.
2) Add tests simulating chunked responses.
3) Run: `npm run test -- tests/sprint3-bridge/streaming_aggregate.spec.ts`.

Success criteria:
- Final result equals parsed JSON; observed chunk order logged; tests pass.
