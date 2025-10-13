# MVP Runbook (Orchestrator)

Start/Stop
- Start locally: `npm run dev` (JUNGLE_URL must point to Jungle)
- Docker Compose: `docker compose up -d`
- Health: `curl -s http://localhost:8080/healthz`

Common Calls
- Initialize: `curl -s -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' http://localhost:8080/mcp`
- List tools: `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`
- Call tool: `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"..."}}`

Logs & Traces
- Logs: stdout JSON lines (include trace_id/span_id in test mode)
- Traces/Metrics: OTel configured via env; set `OTEL_EXPORTER_OTLP_ENDPOINT` and run

JSON-RPC Error Codes
- -32600 Invalid Request: wrong content-type, array body
- -32601 Method not found: only initialize/tools/*/cancel allowed
- -32000 Server error: upstream error/timeout; see `error.data.status`

Troubleshooting (First 5 Minutes)
1. `/healthz` 200?
2. `JUNGLE_URL` reachable? POST initialize to Jungle directly.
3. Content-Type headers correct (`application/json`)?
4. Timeouts: adjust `ORCH_UPSTREAM_TIMEOUT_MS`; check network conditions.
5. Retries: 502/503 only, capped. Investigate upstream health.
