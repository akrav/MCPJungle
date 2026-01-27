# Ticket-3205 — Memory cap enforcement

Source: Epics/Epic 3 (Merge)/Sprint 2/Sprint 2 Overview.md (section "Ticket-3205 — Memory cap enforcement")

What / Why
- Prevent pathological memory use from crashing the host.

Where
- Tests + runner

Implementation sketch
- Allocate large array (e.g., new Array(1e8).fill(0)) guarded; expect early termination with LimitExceeded.

Tests
- tests/sprint2-codemode/limits_memory.spec.ts: cap produces diagnostics; clean termination.

Accept when
- Memory-limit diagnostics returned; host remains responsive.

Status: Completed – 2025-10-31

Process
- Implement → write tests → run → fix → push.
