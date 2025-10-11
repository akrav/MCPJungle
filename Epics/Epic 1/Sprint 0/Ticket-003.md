## Ticket-003 — Config schema & loader

**What / Why**
Fail fast on env: `JUNGLE_URL`, `PORT` default 8080, `BIND` default 127.0.0.1, `LOG_LEVEL`.

**Where**
`/src/config/schema.ts`, `/src/config/load.ts`

**Implementation sketch**

* **Zod** schema + `loadConfig()` returning typed config. ([Zod][5])

**Tests**
`/tests/sprint0/config.spec.ts`: valid/invalid env tables → expect parse or helpful error text.

**Accept when**
Invalid env yields explicit errors; valid env returns typed object.

**Plain English**

> Make sure URL/port are correct before the server starts.

**LLM priming**
`zod object`, `z.infer`, `env parsing`, `dotenv`, `process.env` ([Zod][5])

---
