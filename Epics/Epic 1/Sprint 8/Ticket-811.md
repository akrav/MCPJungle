## Ticket-811 — README: **Cutover & Runbook** (copy-pasteable)

**Why**
A single doc: enable header canary → 10% mesh → observe OTel metrics → ramp → 100% → disable flag. Include **rollback** steps (set `ORCH_ROLLBACK_TO_JUNGLE=true`). 

**Where**
`README.md`

**Implementation sketch**

* Sections: Preconditions, Canary Steps, Observe (dashboards/metrics), Rollback, Verification (MCP contract checks).

**Tests**
`readme_cutover_runbook.spec.ts`: grep headings and key commands.

**Accept when**
Doc is clear and actionable.

**LLM priming**
`progressive delivery`, `traffic shifting`, `observability gates`, `rollback switch`

---

## How to run Sprint 8 tests locally

```bash
npm i
npm run test -- tests/sprint8

# Dev canary via header (single request)
curl -s -H 'x-orch-canary: 1' -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  http://localhost:8080/mcp | jq .

# Flip live router on (dev)
export ORCH_LIVE_ROUTER_ENABLED=true
npm run dev
```

---

### Why these priming cues work

They align with your source sprint theme: **feature flags & canary**, **Istio/Envoy** resilience patterns (timeouts, retries, circuit breakers, outlier detection, local rate limit), **Jungle fallback**, and **OpenTelemetry** semconv—so an LLM sticks to **idiomatic, production-safe** implementations with minimal back-and-forth. 

If helpful, I can also emit tiny skeletons (files + TODO assertions) to make several tickets go green with near-zero extra calls.
