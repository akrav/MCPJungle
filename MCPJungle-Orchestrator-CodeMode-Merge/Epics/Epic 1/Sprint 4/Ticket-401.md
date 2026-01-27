## Ticket-401 — Contract test: `initialize` handshake

**What / Why**
Byte-for-byte JSON-RPC contract for `initialize`: `jsonrpc:"2.0"`, ID echo, non-null `result` with server info.

**Where**
`/tests/sprint4/contract_initialize.spec.ts`

**Implementation sketch**

* Use **Supertest** to POST `initialize` and deep-equal the envelope (mask dynamic fields).
* Optional: compare to known goldens.

**Accept when**

* Response conforms to JSON-RPC 2.0 (result XOR error, id echo), assertions pass.

**Plain English**

> Prove the hello handshake matches exactly what clients expect.

**LLM priming**
`supertest`, `expect(res.body).toEqual(...)`, `jsonrpc: "2.0"`, `id echo`, `result XOR error`

---
