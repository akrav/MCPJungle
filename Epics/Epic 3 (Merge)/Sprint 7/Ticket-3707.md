# Ticket-3707 — Examples mini-gallery (two flows)

Source: Epics/Epic 3 (Merge)/Sprint 7/Sprint 7 Overview.md (section "Ticket-3707 — Examples mini-gallery (two flows)")

What / Why
- Ship two tiny example flows that demonstrate multi-tool composition, runnable against a stub Jungle.

Where
- /orchestrator/examples/codemode/*

Implementation sketch
- Scripts call orchestrator Code Mode path; print { result } only.

Tests
- tests/sprint7-hardening/examples_gallery_smoke.spec.ts: examples output JSON and exit 0.

Accept when
- Both examples run deterministically.

Process
- Implement → write tests → run → fix → push.
