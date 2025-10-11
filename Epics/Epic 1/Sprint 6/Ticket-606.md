## Ticket-606 — Instances page (read-only)

**Why**
View per-user Jungle instances (id, userId, status, lastSeen). ([TanStack Table])

**Where**
`/admin/app/instances/page.tsx`, `/admin/src/ui/columns.tsx`, `fetchOrch.listInstances()`

**Implementation sketch**

* Render table with sorting (lastSeen) + quick filter (userId).

**Tests**
`instances_table.spec.tsx`: rows render; sorting & filtering work.

**Accept when**
Table renders, sorts, filters.

**LLM priming**
`useReactTable`, `columns`, `sorting`, `columnFilters`.

---
