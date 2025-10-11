## Ticket-411 — Chaos: Jungle container restart

**What / Why**
Restart Jungle mid-call; orchestrator should propagate failure cleanly (or retry if configured), no descriptor leaks.

**Where**
`/tests/sprint4/chaos/jungle_restart.sh`

**Implementation sketch**

* `docker restart jungle` while long call runs; assert a **single** terminal JSON-RPC error; health checks stay OK.

**Accept when**

* One clean terminal; orchestrator healthy afterward.

**Plain English**

> If Jungle dies briefly, we fail gracefully.

**LLM priming**
`docker restart`, `trap`, `single terminal`, `no handle leak`

---
