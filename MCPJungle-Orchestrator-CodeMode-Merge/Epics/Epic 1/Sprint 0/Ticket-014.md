## Ticket-014 — Golden fixtures for `initialize`

**What / Why**
Byte-for-byte golden tests for the initialize request/response to catch regressions.

**Where**
`/tests/fixtures/initialize_req.json`, `initialize_res.json`, test in `/tests/sprint0/initializePayload.spec.ts`

**Implementation sketch**
Load fixtures and compare to live response.

**Tests**
Golden compare (string equality).

**Accept when**
Exact match; test green.

**Plain English**

> Freeze the expected JSON so we notice accidental changes.

**LLM priming**
`golden master`, `snapshot-like test`, `byte-for-byte compare`, `fixture`

---
