# Ticket-3103 — Catalog hash & cache (in-memory)

Source: Epics/Epic 3 (Merge)/Sprint 1/Sprint 1 Overview.md (section "Ticket-3103 — Catalog hash & cache (in-memory)")

What / Why
- Avoid regen churn: compute a stable catalogHash from tool schemas and cache generated typings per (userId,catalogHash).

Where
- /orchestrator/src/codemode/cache.ts (used by index.ts)

Implementation sketch
- Stable stringify of [{name, schemaETagOrJSON}] → sha256 hex.
- Cache Map<string /*userId:hash*/, { dts, hash, ts }>, TTL configurable (e.g., 10m).

Tests
- tests/sprint1-codemode/typegen_hashing.spec.ts: same input → same hash; order-insensitive; schema change → new hash; cache reduces generator calls.

Accept when
- Hash stable; cache prevents redundant generator calls.

Process
- Implement → write tests → run tests → fix → push to Orchestrator-CodeMode-Merge.
