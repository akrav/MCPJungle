## Ticket-412 — Chaos: latency & packet loss (netem)

**What / Why**
Inject **latency** & **packet loss** on Jungle link; verify timeouts/retries follow policy (bounded, jittered).

**Where**
`/tests/sprint4/chaos/netem_latency.sh`, `/tests/sprint4/chaos/netem_loss.sh`

**Implementation sketch**

* `tc qdisc netem delay 200ms` and `loss 5%` on docker network/host.
* Observe k6/Vegeta metrics and JSON-RPC error rates.

**Accept when**

* Timeouts trigger; retries limited; service responsive.

**Plain English**

> The network will have bad days—be predictable then.

**LLM priming**
`tc qdisc netem`, `delay`, `loss`, `exponential backoff with jitter`

---
