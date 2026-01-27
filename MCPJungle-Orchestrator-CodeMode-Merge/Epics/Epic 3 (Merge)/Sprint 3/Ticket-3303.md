# Ticket-3303 — Session header forward + reflection

Source: Epics/Epic 3 (Merge)/Sprint 3/Sprint 3 Overview.md (section "Ticket-3303 — Session header forward + reflection")

What / Why
- Ensure Mcp-Session-Id is forwarded when present and updated when reflected by Jungle.

Where
- /server/upstream.ts + /codemode/invoker.ts

Implementation sketch
- Read mcp-session-id from previous response; set on next request; update cached value on reflection.

Tests
- tests/sprint3-bridge/session_header_forward.spec.ts: first call sets session from response; second call sends that header.

Accept when
- Parity with /mcp relay behavior.

Process
- Implement → write tests → run → fix → push.
