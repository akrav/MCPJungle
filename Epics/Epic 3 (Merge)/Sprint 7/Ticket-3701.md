# Ticket-3701 — Soak: many short Code Mode runs (stub Jungle)

Source: Epics/Epic 3 (Merge)/Sprint 7/Sprint 7 Overview.md (section "Ticket-3701 — Soak: many short Code Mode runs (stub Jungle)")

What / Why
- Run many (e.g., 200) short Code Mode executions calling 2 tools sequentially; record p50/p95 eval time and success rate.

Where
- /orchestrator/tests/sprint7-hardening/soak_codemode_short.spec.ts

Implementation sketch
- Limited concurrency pool; simple two-call program; collect timings; assert success ≥ 99% and p95 under threshold.

Accept when
- Soak passes locally/CI with guarded thresholds; brief summary printed.

Process
- Implement → run → fix → push.
