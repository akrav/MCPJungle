# Test Matrix (Smoke)

| Area | Tool | Command | Pass Criteria |
|------|------|---------|---------------|
| Initialize | k6 | `k6 run tests/sprint4/k6/smoke_scenarios.js` | P95 < 300ms, 99% success |
| List/Call | k6 | same as above | P95 < 500/800ms, 99% success |
| Constant-rate | Vegeta | `bash tests/sprint4/vegeta/run_const_rate.sh` | Near-100% success, stable P95 |
| Chaos restart | Script | `bash tests/sprint4/chaos/jungle_restart.sh` | Single terminal error, health OK |
| Netem delay | Script | `bash tests/sprint4/chaos/netem_latency.sh` | Timeouts/retries bounded |
| Netem loss | Script | `bash tests/sprint4/chaos/netem_loss.sh` | Retries bounded, errors within budget |
