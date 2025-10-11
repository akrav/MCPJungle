Orchestrator Sprint 0

Quickstart (Compose)

```
cd orchestrator
docker compose up --build -d
curl -s http://localhost:8080/healthz
curl -s -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' http://localhost:8080/mcp
```

Notes
- GET /mcp is rejected (405); POST only.
- Array bodies to /mcp are rejected (-32600).
- Unknown methods proxy to JUNGLE_URL/mcp.
- Progress is streamed when upstream supports it.


