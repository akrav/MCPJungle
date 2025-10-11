## Ticket-004 — Minimal logger with redaction

**What / Why**
Structured NDJSON logs; redact `Authorization` and any `*token*` fields.

**Where**
`/src/obs/log.ts`

**Implementation sketch**
`log(level, msg, fields)` with redaction helper; pretty in dev, NDJSON in prod.

**Tests**
`/tests/sprint0/logMiddleware.spec.ts`: capture output, assert tokens are masked.

**Accept when**
No secrets appear in logs.

**Plain English**

> Log useful info but hide sensitive bits.

**LLM priming**
`pino-like NDJSON`, `redact fields`, `structured logging`, `mask Authorization`

---


Status: Completed - 2025-10-10
