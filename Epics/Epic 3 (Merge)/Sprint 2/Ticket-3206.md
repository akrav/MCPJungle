# Ticket-3206 — Deny ambient APIs (network, fs, timers, crypto)

Source: Epics/Epic 3 (Merge)/Sprint 2/Sprint 2 Overview.md (section "Ticket-3206 — Deny ambient APIs (network, fs, timers, crypto)")

What / Why
- Guarantee only `codemode` binding is exposed; no ambient fetch, fs, setTimeout, crypto.subtle, etc.

Where
- Runner/binding configuration and tests

Implementation sketch
- Ensure the sandbox has no globals or they throw; do not leak host globals into isolate.

Tests
- tests/sprint2-codemode/deny_ambient_apis.spec.ts: calls to fetch/setTimeout/crypto.subtle throw deterministic errors.

Accept when
- Ambient API use impossible; errors clear and consistent.

Status: Completed – 2025-10-31

Process
- Implement → write tests → run → fix → push.
