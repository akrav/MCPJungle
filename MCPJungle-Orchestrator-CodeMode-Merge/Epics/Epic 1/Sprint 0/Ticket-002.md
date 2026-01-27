## Ticket-002 — Editor/lint/format baseline

**What / Why**
Add `.editorconfig`, ESLint, Prettier, `.gitignore` for consistent diffs.

**Where**
Root config files

**Implementation sketch**

* ESLint with `@typescript-eslint`, Prettier integration; add `npm run lint`.

**Tests**
Add CI step `npm run lint`; it must pass.

**Accept when**
Lint is clean locally and in CI.

**Plain English**

> Agree on formatting and linting so PRs are clean.

**LLM priming**
`eslint`, `@typescript-eslint`, `prettier`, `lint-staged`, `husky hook`

---


Status: Completed - 2025-10-10
