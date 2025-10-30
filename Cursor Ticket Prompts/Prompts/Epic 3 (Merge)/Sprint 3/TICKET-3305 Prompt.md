### Cursor Prompt: Execute Ticket TICKET-3305

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3305
- TICKET_NAME: Ticket-3305 — Cancel propagation from runner
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 3/Ticket-3305.md

Permanent references:
- Runner: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/runner.ts

Code references for this ticket:
- Invoker: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/invoker.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint3-bridge/cancel_propagation.spec.ts

Objective:
- Forward a JSON-RPC cancel for the same id when the runner signals cancellation; ensure one terminal outcome.

Required steps:
1) Track in-flight ids; implement cancel POST; clean finalization.
2) Add tests for a long-running stub call then cancel.

Success criteria:
- No double-finalization; stream closed; tests pass.
