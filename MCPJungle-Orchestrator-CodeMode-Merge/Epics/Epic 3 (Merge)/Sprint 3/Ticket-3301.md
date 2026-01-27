# Ticket-3301 — Extract shared upstream client helpers

Source: Epics/Epic 3 (Merge)/Sprint 3/Sprint 3 Overview.md (section "Ticket-3301 — Extract shared upstream client helpers")

What / Why
- Factor Undici + retry + header shaping into /src/server/upstream.ts so both HTTP /mcp relay and Code Mode invoker reuse it.

Where
- /orchestrator/src/server/upstream.ts (new)
- Update imports in /orchestrator/src/server/http.ts

Implementation sketch
- Export postToJungle({ body, headers, timeoutMs }): Promise<Response> with fetchWithRetry(502/503) and AbortSignal.timeout.
- Centralize headers: User-Agent, Forwarded, Authorization, x-user-id, Mcp-Session-Id.

Tests
- tests/sprint3-bridge/upstream_extract.spec.ts: retry counts, headers, timeout; existing relay tests stay green.

Accept when
- Relay unchanged; helper covered by tests.

Process
- Implement → write tests → run → fix → push.
