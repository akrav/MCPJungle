## Ticket-414 — SLO smoke checklist (doc)

**What / Why**
One-page SLO **smoke** doc (latency/error thresholds) + linkable checklist patterned after PRR/launch checklists. Include how to run k6/Vegeta and read outputs.

**Where**
`/tests/sprint4/slo_smoke_dashboard.md`, `/runbooks/test_matrix.md`

**Implementation sketch**

* Define provisional targets: success ≥ 99%, P95 budgets, max error burst, etc.

**Accept when**

* Copy-paste runnable and unambiguous.

**Plain English**

> One page that says what “good” looks like and how to check it.

**LLM priming**
`SLO`, `error budget`, `P95`, `k6 thresholds`, `vegeta report`

---
