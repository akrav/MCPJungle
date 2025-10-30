# Ticket-3708 — CI matrix: include S1–S7 suites with flags

Source: Epics/Epic 3 (Merge)/Sprint 7/Sprint 7 Overview.md (section "Ticket-3708 — CI matrix: include S1–S7 suites with flags")

What / Why
- Wire CI to run sprint-scoped suites (S1–S7). Keep docker/provisioning tests behind flags to avoid flaky builds.

Where
- .github/workflows/ci.yml

Implementation sketch
- Add jobs running tests/sprint*-* patterns; set env flags for OTEL tests; skip provisioning unless enabled.

Tests
- tests/sprint7-hardening/ci_matrix_config.spec.ts: parse YAML text and assert presence of key jobs/steps.

Accept when
- CI workflow contains suites and flags; local test verifies structure.

Process
- Implement → write tests → run → fix → push.
