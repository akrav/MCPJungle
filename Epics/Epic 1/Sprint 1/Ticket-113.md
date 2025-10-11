## Ticket-113 — **Compose + Quickstart with Jungle**  *(merged)*

**What / Why**
One command to boot **orchestrator + real MCPJungle** and a README section with copy-paste commands to test `tools/list`/`tools/call`. 

**Where**
`docker-compose.yml`, `README.md`

**Implementation sketch**

* Compose services: `jungle` (exposes `/mcp`) and `orch` (`JUNGLE_URL=http://jungle:9000`).
* README “Quickstart with MCPJungle”: env vars, compose up, sample `curl`.

**Tests**
`compose_quickstart.spec.ts`: `docker compose config` sanity; grep README for required headings and code blocks.

**Accept when**
Compose validates and docs are actionable.

**LLM priming**
`docker compose --profile jungle up`, `curl -X POST /mcp`, `application/json` bodies

---

## How to run Sprint 1 tests locally

```bash
# install deps
npm i

# run only Sprint 1 tests
npm run test -- tests/sprint1

# run dev server
npm run dev

# optional: run with a real Jungle via compose
docker compose --profile jungle up -d
export JUNGLE_URL=http://localhost:9000
```

---

### Why these priming cues work

They mirror the exact library/API names and MCP calls you’re already using (Express handlers, Supertest + Vitest patterns, Zod config, Undici streaming, JSON-RPC 2.0, MCP `tools/list` & `tools/call`). That nudges the model toward **idiomatic TS/Node** while keeping the orchestrator strictly **pass-through** for this sprint. 

If you want, I can also emit tiny **skeleton files** (headers + TODO asserts) so several tickets go green with near-zero extra calls.
