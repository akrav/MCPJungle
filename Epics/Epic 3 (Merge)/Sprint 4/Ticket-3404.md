# Ticket-3404 — Config flags for telemetry and code persistence (disabled by default)

Source: Epics/Epic 3 (Merge)/Sprint 4/Sprint 4 Overview.md (section "Ticket-3404 — Config flags for telemetry and code persistence (disabled by default)")

What / Why
- Add env flags: CODEMODE_TELEMETRY and CODEMODE_PERSIST_CODE (default false). When persistence enabled (dev-only), store last N code previews (redacted).

Where
- /orchestrator/src/config/{schema.ts,load.ts}; in-memory buffer in /orchestrator/src/codemode/telemetry.ts

Implementation sketch
- Zod booleans with defaults; loader maps to config. Persist { run_id, code_hash, redacted_preview } only; bounded (e.g., N=20).

Tests
- tests/sprint4-obs/config_flags.spec.ts: defaults false; when enabled, buffer retains ≤ N entries; preview redacted.

Accept when
- Flags parse and drive behavior; buffer bounded.

Process
- Implement → write tests → run → fix → push.
