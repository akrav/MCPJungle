# Ticket-3203 — SecurityPolicy wiring (time/memory/output/tool-calls)

Source: Epics/Epic 3 (Merge)/Sprint 2/Sprint 2 Overview.md (section "Ticket-3203 — SecurityPolicy wiring (time/memory/output/tool-calls)")

What / Why
- Provide policy.ts exporting DEFAULT_SECURITY_POLICY and a function to build per-run limits; enforce in runner.

Where
- /orchestrator/src/codemode/policy.ts

Implementation sketch
- Import SecurityPolicy from codemode-standalone.
- Defaults: maxExecutionTime=10000ms, maxMemoryMB=128, maxToolCalls=50, maxOutputBytes=1_000_000, allowNetworkAccess=false.
- Throw LimitExceeded on breach.

Tests
- tests/sprint2-codemode/limits_tool_calls.spec.ts: loop calls > max; last call rejects with LimitExceeded.

Accept when
- Limits configurable and enforced in runner.

Status: Completed – 2025-10-31

Process
- Implement → write tests → run → fix → push.
