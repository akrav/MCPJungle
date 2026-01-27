# Ticket-3502 — Config: routing flags and defaults

Source: Epics/Epic 3 (Merge)/Sprint 5/Sprint 5 Overview.md (section "Ticket-3502 — Config: routing flags and defaults")

What / Why
- Add ROUTING_MODE env with allowed values shared|per_user (default shared). Validate and expose via loadConfig().

Where
- /orchestrator/src/config/{schema.ts,load.ts}

Implementation sketch
- Zod enum for routingMode with default 'shared'.
- Extend returned config type with routingMode.

Tests
- tests/sprint5-routing/config_modes.spec.ts: invalid value → error; default applied when unset; per_user accepted.

Accept when
- Parsing/defaults behave as specified.

Process
- Implement → write tests → run → fix → push.
