### Cursor Prompt: Execute Ticket TICKET-3401

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3401
- TICKET_NAME: Ticket-3401 — Span helpers for Code Mode runs
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 4/Ticket-3401.md

Permanent references:
- OTel helpers: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/obs/otel.ts

Code references for this ticket:
- Implement: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/telemetry.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint4-obs/spans_compile_eval.spec.ts

Objective:
- Add span helpers for run/compile/eval/tool-call with attributes (run_id, user_id, tool_name, catalog_hash).

Required steps:
1) Implement helper wrappers; support OTEL_TEST=true.
2) Add tests using in-memory exporter.

Success criteria:
- Expected span names/attrs recorded; tests pass.
