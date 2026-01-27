# Ticket-3304 — Streaming aggregate to final result

Source: Epics/Epic 3 (Merge)/Sprint 3/Sprint 3 Overview.md (section "Ticket-3304 — Streaming aggregate to final result")

What / Why
- Consume streaming JSON from Jungle and aggregate to a final object for Code Mode (atomic return), with optional progress logs.

Where
- /orchestrator/src/codemode/invoker.ts

Implementation sketch
- If content-type is application/json and body is a stream, incrementally buffer and JSON.parse at end; log chunk boundaries with runId.

Tests
- tests/sprint3-bridge/streaming_aggregate.spec.ts: 3 chunks simulated; verify ordered arrival and final parse.

Accept when
- Final result equals parsed JSON; no unnecessary end-buffering.

Process
- Implement → write tests → run → fix → push.
