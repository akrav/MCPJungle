## Ticket-415 — MVP runbook (ops)

**What / Why**
Create an **MVP runbook**: start/stop, common errors, logs/traces locations, JSON-RPC error code interpretations.

**Where**
`/runbooks/mvp_runbook.md`, `README.md` (Testing section updated)

**Implementation sketch**

* Curl examples, HTTP→JSON-RPC mappings, “what to check first” flow.

**Accept when**

* On-call actionable.

**Plain English**

> If something breaks at 2 a.m., this tells us what to do.

**LLM priming**
`runbook`, `on-call`, `first 5 minutes checks`, `json-rpc error codes table`

---

## How to run Sprint 4 tests locally

```bash
# Unit/integration contracts
npm run test -- tests/sprint4

# k6 smoke (two scenarios in one script)
k6 run tests/sprint4/k6/smoke_scenarios.js

# Vegeta constant-rate probe
bash tests/sprint4/vegeta/run_const_rate.sh

# Chaos drills (docker + tc netem; run carefully)
bash tests/sprint4/chaos/jungle_restart.sh
bash tests/sprint4/chaos/netem_latency.sh
bash tests/sprint4/chaos/netem_loss.sh
```

If you want, I can drop in tiny file skeletons for each ticket (headers + TODOs + example asserts) to reduce LLM round-trips further.
