# Ticket-3204 — Timeout enforcement (infinite loop test)

Source: Epics/Epic 3 (Merge)/Sprint 2/Sprint 2 Overview.md (section "Ticket-3204 — Timeout enforcement (infinite loop test)")

What / Why
- Ensure infinite loops or long sleeps abort under maxExecutionTime.

Where
- Tests + runner integration

Implementation sketch
- Code sample: while(true){} or for(;;){}; expect diagnostic with "timed out".

Tests
- tests/sprint2-codemode/limits_timeout.spec.ts: timeout triggers; runner returns diagnostics; process doesn’t hang.

Accept when
- Run ends within deadline and reports timeout.

Status: Completed – 2025-10-31

Process
- Implement → write tests → run → fix → push.
