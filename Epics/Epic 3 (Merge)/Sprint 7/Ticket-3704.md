# Ticket-3704 — Size caps end-to-end (input/output)

Source: Epics/Epic 3 (Merge)/Sprint 7/Sprint 7 Overview.md (section "Ticket-3704 — Size caps end-to-end (input/output)")

What / Why
- Confirm oversized inputs/outputs trigger limits and clean diagnostics without destabilizing the process.

Where
- /orchestrator/tests/sprint7-hardening/size_caps_end_to_end.spec.ts

Implementation sketch
- Code Mode run producing output > maxOutputBytes → LimitExceeded.
- Request body exceeding JSON size to /mcp → -32600 InvalidRequest.

Accept when
- Caps enforced with expected errors; no resource leaks.

Process
- Implement → run → fix → push.
