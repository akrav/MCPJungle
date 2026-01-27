# SLO Smoke Checklist

- Target success rate: ≥ 99%
- P95 latency budgets:
  - initialize: < 300ms
  - tools/list: < 500ms
  - tools/call (final): < 800ms under light load
- Error burst tolerance: < 1% over 1m window

How to run
- k6: `k6 run tests/sprint4/k6/smoke_scenarios.js`
- Vegeta: `bash tests/sprint4/vegeta/run_const_rate.sh`

Interpretation
- k6 thresholds must pass; Vegeta report should show P95 within budgets and near-100% success.
