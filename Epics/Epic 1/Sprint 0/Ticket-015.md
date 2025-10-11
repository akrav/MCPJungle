## Ticket-015 — Dockerfile, Compose, README, and e2e smoke

**What / Why**
Package the service; one-command local demo; prove end-to-end with a smoke script.

**Where**
`Dockerfile`, `docker-compose.yml`, `README.md`, `/tests/sprint0/dockerBuild.test.sh`, `/tests/sprint0/e2e_smoke.sh`

**Implementation sketch**

* Multi-stage Dockerfile & `.dockerignore` following official best practices. ([expressjs.com][3])
* Compose service `orch` + `mockJungle`; env wires `JUNGLE_URL`.
* README Quickstart with `curl` for `/healthz` and `/mcp` initialize.

**Tests**

* `dockerBuild.test.sh`: `docker build -t orch:local .` → exit 0.
* `e2e_smoke.sh`: start server, hit `/healthz`, POST initialize → success.

**Accept when**
Image builds; smoke passes locally.

**Plain English**

> Containerize it and prove the whole flow end-to-end on your machine.

**LLM priming**
`Docker multi-stage`, `node:alpine`, `npm ci --only=production`, `docker-compose up`, `healthcheck` ([expressjs.com][3])

---

## How to run tests locally (TypeScript)

```bash
# install deps
npm i

# run all unit/integration tests
npm run test

# run only sprint-0 tests
npm run test -- tests/sprint0

# dev server (uses env; mock Jungle in tests)
npm run dev
```

When pointing at a real MCPJungle, set `JUNGLE_URL=http://<host>:<port>` (Jungle exposes a unified **/mcp** over **Streamable HTTP**). ([GitHub][1])

---

### Why these priming cues work

* They mirror the **exact library and API names** prominent in open-source examples and docs (Express route shapes, Supertest call patterns, Vitest expectations, Zod schema syntax, Undici streaming calls), nudging the LLM toward **idiomatic TS/Node** solutions it’s likely seen. ([expressjs.com][3])


[1]: https://github.com/mcpjungle/MCPJungle?utm_source=chatgpt.com "mcpjungle/MCPJungle: Self-hosted MCP Gateway and ..."
[2]: https://modelcontextprotocol.io/specification/2024-11-05/basic/messages?utm_source=chatgpt.com "Messages"
[3]: https://expressjs.com/en/starter/hello-world.html?utm_source=chatgpt.com "Express \"Hello World\" example"
[4]: https://vitest.dev/?utm_source=chatgpt.com "Vitest | Next Generation testing framework"
[5]: https://zod.dev/?utm_source=chatgpt.com "Zod: Intro"
[6]: https://www.npmjs.com/package/supertest?utm_source=chatgpt.com "Supertest"
[7]: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports?utm_source=chatgpt.com "Transports"
[8]: https://undici.nodejs.org/?utm_source=chatgpt.com "Node.js Undici"
[9]: https://stackoverflow.com/questions/40385133/retrieve-data-from-a-readablestream-object?utm_source=chatgpt.com "javascript - Retrieve data from a ReadableStream object?"
