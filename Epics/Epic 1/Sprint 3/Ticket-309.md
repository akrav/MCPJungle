## Ticket-309 — README: **Compose Quickstart** (copy-pasteable)

**What / Why**
A short “do this” doc for devs: env file, compose up, `curl` health & initialize.

**Where**
`/README.md`

**Tests / Accept**
`readme_compose_quickstart.spec.ts` greps headings and code blocks.

**LLM priming**

```
cp deploy/compose.env.example .env
docker compose up -d
curl -s -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' \
  http://localhost:8080/mcp
```

---
