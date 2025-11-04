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

Compose Quickstart (copy-paste)
```
cp deploy/compose.env.example .env || true
docker compose up -d
curl -s http://localhost:8080/healthz
curl -s -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' \
  http://localhost:8080/mcp
```

Notes
- GET /mcp is rejected (405); POST only.
- Array bodies to /mcp are rejected (-32600).
- Unknown methods proxy to JUNGLE_URL/mcp.
- Progress is streamed when upstream supports it.

Codemode (optional)

Enable codemode tools to expose a local execution engine that orchestrates across all tools registered in Jungle.

Environment:

```
CODEMODE_ENABLED=false               # default off to preserve pure pass-through
CODEMODE_ENABLE_LLM=true             # list executeCode when Anthropic key is present
CODEMODE_MAX_EXEC_MS=10000           # code execution timeout
CODEMODE_MAX_MEM_MB=128              # isolate memory limit (MB)
# Optional Anthropic key for executeCode
# ANTHROPIC_API_KEY=sk-ant-...
```

Behavior:

- When enabled, tools/list is augmented with:
  - codemode__executeCode (requires Anthropic key)
  - codemode__executeCodeWithTools
  - codemode__listAvailableTools
- tools/call requests to names starting with `codemode__` are handled locally; all other tools are proxied to Jungle.

Sprint 1 notes
- Error mapping: non-JSON/5xx → JSON-RPC ServerError with status
- Timeout: `ORCH_UPSTREAM_TIMEOUT_MS` enforced via AbortSignal
- Retry: 2x on 502/503 with backoff+jitter
- Header hygiene: `User-Agent`, `Forwarded`, optional `Authorization`

Security (TLS/mTLS)
- Terminate TLS at your ingress (NGINX/Envoy/Cloud LB) and forward to orchestrator over HTTP inside the cluster.
- Prefer a service mesh (e.g., Istio/Linkerd) or mTLS between internal services for transport security.
- Keep bearer tokens and secrets in headers; logs are redacted. Avoid PII in URLs.


