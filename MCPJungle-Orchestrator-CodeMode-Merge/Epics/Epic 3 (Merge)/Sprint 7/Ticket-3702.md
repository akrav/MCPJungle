# Ticket-3702 — Chaos: restart Jungle mid-run (error hygiene)

Source: Epics/Epic 3 (Merge)/Sprint 7/Sprint 7 Overview.md (section "Ticket-3702 — Chaos: restart Jungle mid-run (error hygiene)")

What / Why
- Simulate upstream restart/error during in-flight tool call; verify deterministic error mapping and clean termination.

Where
- /orchestrator/tests/sprint7-hardening/chaos_restart_jungle.spec.ts

Implementation sketch
- Stub upstream to close mid-stream or return 502; ensure structured error (no hangs, single terminal).

Accept when
- Expected JSON-RPC mapping and closed stream.

Process
- Implement → run → fix → push.
