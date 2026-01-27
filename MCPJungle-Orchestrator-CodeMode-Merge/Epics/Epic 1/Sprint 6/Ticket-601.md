## Ticket-601 — Next.js (App Router) bootstrap **+ shadcn/ui shell**  *(merged)*

**Why**
Stand up the app and a clean shell (sidebar/header) so other pages drop in fast. ([Next.js App Router], [shadcn/ui]) 

**Where**
`/admin/app/layout.tsx`, `/admin/app/page.tsx`, `next.config.js`, Tailwind configs; shell scaffolding in `layout.tsx` + simple nav.

**Implementation sketch**

* `npx create-next-app@latest admin --ts` (or manual in `/admin`).
* Add Tailwind + shadcn/ui; import Button, Card, Table styles.
* Add sidebar links: **Instances**, **Requests**, **Tools**.

**Tests**
`next_bootstrap.spec.ts`: build or start dev; assert “Admin” heading and nav links render.

**Accept when**
App compiles; nav shows **Instances/Requests/Tools**.

**LLM priming**
`Next.js App Router`, `layout.tsx`, `page.tsx`, `Tailwind setup`, `shadcn/ui Card/Button`, `npm run dev`.

---
