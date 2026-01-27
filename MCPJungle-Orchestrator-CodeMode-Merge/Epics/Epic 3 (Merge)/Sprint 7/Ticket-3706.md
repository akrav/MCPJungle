# Ticket-3706 — Docs: Quickstart (Code Mode path) + Operator runbook

Source: Epics/Epic 3 (Merge)/Sprint 7/Sprint 7 Overview.md (section "Ticket-3706 — Docs: Quickstart (Code Mode path) + Operator runbook")

What / Why
- Document how to run Code Mode via orchestrator (shared routing) and enable per-user mode; add troubleshooting.

Where
- /orchestrator/README.md (sections), or /docs/

Implementation sketch
- Add Code Mode Quickstart (envs, example curl, expected JSON snippet).
- Add Operator Runbook (routing modes, feature flags, viewing logs/metrics).

Tests
- tests/sprint7-hardening/docs_quickstart_smoke.spec.ts: grep headings and code blocks.

Accept when
- Headings found and sample commands present.

Process
- Implement → write tests → run → fix → push.
