Orchestrator Sprint 0/1

Quickstart (Compose with Jungle)

```
cd orchestrator
docker compose up --build -d

# Orchestrator health
curl -s http://localhost:8080/healthz

# Proxy initialize (goes to Jungle at http://localhost:9000)
curl -s -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' \
  http://localhost:8080/mcp
```

Notes
- GET /mcp is rejected (405); POST only.
- Array bodies to /mcp are rejected (-32600).
- Unknown methods proxy to JUNGLE_URL/mcp.
- Progress is streamed when upstream supports it.

Sprint 1 notes
- Error mapping: non-JSON/5xx → JSON-RPC ServerError with status
- Timeout: `ORCH_UPSTREAM_TIMEOUT_MS` enforced via AbortSignal
- Retry: 2x on 502/503 with backoff+jitter
- Header hygiene: `User-Agent`, `Forwarded`, optional `Authorization`


