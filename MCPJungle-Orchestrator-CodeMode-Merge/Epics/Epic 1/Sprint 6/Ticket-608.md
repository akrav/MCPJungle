## Ticket-608 — Tools page (read-only probe via tRPC)

**Why**
Run a **`tools/list`** probe through orchestrator → Jungle; render tools.

**Where**
`/admin/app/tools/page.tsx`, `trpc/router.ts` (`toolsList`), `fetchOrch.mcp({ method:'tools/list' })`

**Implementation sketch**

* Query via tRPC; show tool id/name/description.

**Tests**
`tools_list_probe.spec.ts`: mock JSON; assert render & empty state.

**Accept when**
Probe returns and renders cleanly.

**LLM priming**
`JSON-RPC`, `tools/list`, `Zod schema`, `tRPC procedure`.

---
