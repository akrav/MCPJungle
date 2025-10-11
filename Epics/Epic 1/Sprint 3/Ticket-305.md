## Ticket-305 — Compose up **smoke**: health then `/mcp initialize`

**What / Why**
Integration check: stack is healthy, `/mcp` handles a minimal JSON-RPC `initialize`.

**Where**
`tests/sprint3/compose_up_health.test.sh`

**Tests / Accept**
Poll `/healthz` → POST `{"jsonrpc":"2.0","id":1,"method":"initialize"}` → has `result`.

**LLM priming**
`curl -H 'Content-Type: application/json' -d`, `jq -e '.result'`

---
