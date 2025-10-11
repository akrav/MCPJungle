## Ticket-402 — Contract pass-through: `tools/list` **and** `tools/call`  *(merged)*

**What / Why**
One suite that proves **no mutation** of envelopes for discovery (`tools/list`) and execution (`tools/call`), including ID preservation and stream reassembly.

**Where**
`/tests/sprint4/contract_pass_through.spec.ts`

**Implementation sketch**

* Mock Jungle with deterministic responses:

  * **list**: stable order/fields.
  * **call**: nested JSON payload + streamed chunks.
* Buffer streamed chunks, `JSON.parse`, and `deepStrictEqual` vs mocks.
* Verify `content-type: application/json`.

**Accept when**

* Exact body match for both list and call; ID preserved; streaming reassembles identically.

**Plain English**

> We pass back exactly what Jungle said—no edits, no reorder.

**LLM priming**
`tools/list`, `tools/call`, `exact envelope`, `stream→buffer→JSON.parse`, `deepStrictEqual`, `application/json`

---
