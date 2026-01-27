# Ticket-3306 — Error mapping parity with HTTP relay

Source: Epics/Epic 3 (Merge)/Sprint 3/Sprint 3 Overview.md (section "Ticket-3306 — Error mapping parity with HTTP relay")

What / Why
- Match /mcp relay behavior: JSON errors pass-through; non-JSON map to JSON-RPC -32000 with data.status.

Where
- /orchestrator/src/codemode/invoker.ts

Implementation sketch
- Inspect content-type; non-JSON → structured server error with upstream status.

Tests
- tests/sprint3-bridge/error_mapping_bridge.spec.ts: 502/HTML → -32000; JSON-RPC error returns untouched.

Accept when
- Deterministic mapping identical to relay.

Process
- Implement → write tests → run → fix → push.
