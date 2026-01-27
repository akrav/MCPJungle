## Ticket-404 — Cancel: single terminal event

**What / Why**
After cancel, we must see **exactly one** terminal event (cancel OR final)—never both.

**Where**
`/tests/sprint4/cancel_single_terminal.spec.ts`

**Implementation sketch**

* Start long `tools/call`; send cancel; assert either cancel ack **or** final, not both.
* Ensure stream closes, no double-finalization.

**Accept when**

* Single terminal outcome; stream closed.

**Plain English**

> Cancel means “stop once,” not “stop and then finish again.”

**LLM priming**
`idempotent cancel`, `inflight map`, `single terminal`

---
