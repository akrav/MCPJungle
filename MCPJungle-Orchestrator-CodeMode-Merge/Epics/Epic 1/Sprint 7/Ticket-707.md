## Ticket-707 — Metrics: **shadow vs actual** route comparison

**What / Why**
Counters comparing **predicted** (shadow) vs **actual** (always Jungle today) to prep for cutover analysis.

**Where**
`/src/obs/otel.ts` (Meter), wired from `server/http.ts`.

**Implementation sketch**

* Counter labels: `method`, `predicted`, `actual`, plus `match` boolean.

**Tests**
`shadow_vs_actual_metrics.spec.ts`: generate a few calls; assert counter deltas.

**Accept when**
Metrics show matches/mismatches as expected.

**Plain English**

> Track how often our plan agrees with reality.

**LLM priming**
`OpenTelemetry counter.add(1,{labels})`, `match vs mismatch`

---
