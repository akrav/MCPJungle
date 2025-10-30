# Ticket-3406 — E2E observability for a successful Code Mode run

Source: Epics/Epic 3 (Merge)/Sprint 4/Sprint 4 Overview.md (section "Ticket-3406 — E2E observability for a successful Code Mode run")

What / Why
- End-to-end: code calls two tools via stub Jungle; verify spans, metrics, and logs populated consistently.

Where
- Test only

Implementation sketch
- Enable OTEL_TEST=true; run a small code snippet using two codemode[...] calls; assert compile/eval spans, tool-call counts, and start/end logs.

Tests
- tests/sprint4-obs/e2e_obs_codemode_run.spec.ts: validates observability signals and redaction.

Accept when
- All signals present; counts/timings are coherent.

Process
- Implement → write tests → run → fix → push.
