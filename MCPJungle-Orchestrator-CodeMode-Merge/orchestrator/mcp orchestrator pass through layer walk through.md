# MCP Orchestrator Pass‑Through MVP Walkthrough

This guide shows how to run the Orchestrator MVP locally, in Docker, and how to connect and test the pass‑through to MCPJungle. It also includes optional OpenTelemetry vendor setup.

## 0) Prerequisites
- Node.js 20.x and npm
- Docker and Docker Compose (for containerized run)
- curl (and optionally jq)

Repo layout of interest:
- `orchestrator/` — Node/TS pass‑through service
- `orchestrator/docker-compose.yml` — spins Orchestrator + Jungle
- `docker-compose.yaml` (repo root) — MCPJungle registry stack for general use

> Port planning: both Jungle and the Orchestrator default to port 8080 on your host. Avoid conflicts by either:
> - Run Jungle on a different host port: `HOST_PORT=18080 docker compose up -d` (then use `JUNGLE_URL=http://localhost:18080`), or
> - Run the Orchestrator dev on a different port: `PORT=8081 npm run dev` (then use `http://localhost:8081` for health/MCP).

## 1) Local Development Run (no Docker)
Run Orchestrator dev server, pointing to a Jungle upstream you control.

1) Install deps
```bash
cd orchestrator
npm ci
```

2) Choose your Jungle upstream
- Option A1: Run MCPJungle via Docker from repo root on alternate host port
```bash
cd ..
HOST_PORT=18080 docker compose up -d
# Jungle HTTP gateway: http://localhost:18080
```
- Option A2: Run MCPJungle via Docker from repo root on default 8080
```bash
cd ..
docker compose up -d
# Jungle HTTP gateway: http://localhost:8080
```
- Option B: Use a different Jungle at a known URL (e.g., `http://localhost:9000` if you run your own)

3) Start Orchestrator (point to Jungle)
- If you used A1 (Jungle on 18080), keep Orchestrator on 8080:
```bash
cd orchestrator
export JUNGLE_URL=http://localhost:18080
npm run dev
```
- If you used A2 (Jungle on 8080), run Orchestrator on 8081:
```bash
cd orchestrator
export JUNGLE_URL=http://localhost:8080
PORT=8081 npm run dev
```
- If you used B (e.g., Jungle on 9000):
```bash
cd orchestrator
export JUNGLE_URL=http://localhost:9000
npm run dev
```

4) Smoke test the MVP
- Health (use the port you chose for the Orchestrator dev server)
```bash
# If PORT not set (8080):
curl -s http://localhost:8080/healthz | jq .
# If PORT=8081:
curl -s http://localhost:8081/healthz | jq .
```
- Initialize JSON‑RPC
```bash
# If PORT not set (8080):
curl -s -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' \
  http://localhost:8080/mcp | jq .
# If PORT=8081:
curl -s -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' \
  http://localhost:8081/mcp | jq .
```

5) Optional: simple pass‑through checks
- Reject GET on `/mcp` (should be 405)
```bash
curl -i http://localhost:${PORT:-8080}/mcp | head -n 1
```
- Content‑Type guard (should return JSON‑RPC InvalidRequest)
```bash
curl -s -H 'Content-Type: text/plain' -d 'not json' http://localhost:${PORT:-8080}/mcp | jq .
```


## 2) Docker Compose Quickstart (Orchestrator + Jungle)
Use `orchestrator/docker-compose.yml` to run both services, wiring Orchestrator to Jungle at `http://jungle:9000`.

```bash
cd orchestrator
ORCH_HOST_PORT=18081 docker compose build --no-cache
ORCH_HOST_PORT=18081 docker compose up --build -d

# OR
cd /Users/adam/Documents/GitHub/MCPJungle/orchestrator && npm run build && ORCH_HOST_PORT=18081 docker compose build --no-cache orchestrator && ORCH_HOST_PORT=18081 docker compose up -d orchestrator 

# Orchestrator health
curl -s http://localhost:8080/healthz | jq .

# Proxy initialize to Jungle via Orchestrator
curl -s -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' \
  http://localhost:8080/mcp | jq .
```

Notes:
- The orchestrator compose exposes Jungle on `http://localhost:9000` and Orchestrator on `http://localhost:8080`.
- Orchestrator service waits for Jungle health before starting.

## 3) Testing the MVP
Run the orchestrator test suite (unit + integration):
```bash
cd orchestrator
npm test
```
You should see all tests passing (66/66 as of this MVP).

Useful targeted tests:
```bash
# Retry/backoff behavior
npm test -- tests/sprint1/retry_backoff.spec.ts
# HTTP error mapping
npm test -- tests/sprint1/http_error_mapping.spec.ts
# OTel span markers in test mode
npm test -- tests/sprint4/otel_span_assert.spec.ts
```

## 4) OpenTelemetry Options
By default, tests use an in‑memory test mode. Vendor OTEL is optional for prod.

- Test mode (automatic in tests): sets `OTEL_TEST=true` internally, records span‑like markers and simple metrics in memory.
- Vendor mode (prod/ops): install optional OTEL deps and set env to export to an OTLP collector.

Enable vendor OTEL locally (optional):
1) Ensure optional deps are installed (already synced in lockfile):
```bash
cd orchestrator
npm ci --include=optional
```
2) Set env and run
```bash
export OTEL_ENABLE_VENDOR=true
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export JUNGLE_URL=http://localhost:9000
npm run dev
```

## 5) Connect an MCP Client (Claude/Cursor) to the MVP
Your MCP client should talk to the Orchestrator gateway at `http://localhost:${PORT:-8080}/mcp`.

Claude Desktop config example (mcp-remote):
```json
{
  "mcpServers": {
    "mcpjungle": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:8080/mcp",
        "--allow-http"
      ]
    }
  }
}
```

Cursor config example:
```json
{
  "mcpServers": {
    "mcpjungle": {
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

Once connected, ask your client to call a tool registered in Jungle (e.g., after you register servers in MCPJungle). For quick validation without tools, just run the `initialize` request above to verify the session handshake.

## 6) Common JSON‑RPC Calls via Orchestrator
Initialize
```bash
curl -s -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' \
  http://localhost:${PORT:-8080}/mcp | jq .
```

List tools (when your Jungle has servers registered)
```bash
curl -s -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  http://localhost:${PORT:-8080}/mcp | jq .
```

Call a tool (replace with a real tool name)
```bash
curl -s -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"filesystem__read_file","arguments":{"path":"README.md"}}}' \
  http://localhost:${PORT:-8080}/mcp | jq .
```

## 7) Troubleshooting
- Orchestrator `/healthz` is not 200
  - Ensure service is running; check logs.
  - If in Docker, ensure Jungle is healthy (compose shows `healthy`).
- `Invalid configuration: JUNGLE_URL must be a valid URL`
  - Set `JUNGLE_URL` to your Jungle endpoint (e.g., `http://localhost:18080` if you used HOST_PORT)
- `EADDRINUSE: address already in use` on port 8080
  - Free port 8080, or use `PORT=8081 npm run dev`, or run root compose with `HOST_PORT=18080`
- JSON‑RPC errors
  - `-32600 Invalid Request`: wrong `Content-Type` or body not a single JSON object
  - `-32000 Server error`: upstream error/timeout; check Jungle availability; see `error.data.status` if present
- Timeouts or 502/503 from upstream
  - Tune `ORCH_UPSTREAM_TIMEOUT_MS` (default 30000)
  - Orchestrator retries 2x on 502/503 with jittered backoff

## 8) Clean Up
```bash
# Stop dev server: Ctrl+C
# Docker Compose stack (root)
docker compose down -v
# Orchestrator+Jungle stack (in orchestrator/)
cd orchestrator && docker compose down -v
```

---
If you need a production image, CI builds and publishes `ghcr.io/<org>/mcpjungle-orchestrator:staging`. Configure vendor OTEL by setting `OTEL_ENABLE_VENDOR=true` and `OTEL_EXPORTER_OTLP_ENDPOINT` in the deployment environment.

## 9) End-to-End Verification (Session-based HTTP)

The MCP Streamable HTTP flow requires a session (Mcp-Session-Id). The orchestrator now reflects this header on initialize. Use it for subsequent calls.

1) Initialize via orchestrator and capture session
```bash
curl -i -s -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' \
  http://localhost:${PORT:-18081}/mcp
# Copy the value of the `Mcp-Session-Id` header from the response.
```

2) List tools via orchestrator (Context7 example)
```bash
curl -s -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Mcp-Session-Id: <session>' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  http://localhost:${PORT:-18081}/mcp | jq .
```

3) Call a tool (resolve-library-id), then a follow-up tool (get-library-docs)
```bash
# Resolve a library ID
curl -s -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Mcp-Session-Id: <session>' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"context7__resolve-library-id","arguments":{"libraryName":"lodash"}}}' \
  http://localhost:${PORT:-18081}/mcp | jq .

# Use the returned /org/project ID with get-library-docs
curl -s -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Mcp-Session-Id: <session>' \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"context7__get-library-docs","arguments":{"context7CompatibleLibraryID":"/lodash/lodash","tokens":2000}}}' \
  http://localhost:${PORT:-18081}/mcp | jq .
```

Notes:
- Always include the `Accept: application/json, text/event-stream` header for Streamable HTTP.
- Initialize first to obtain a valid MCP session.

## 10) Connect an LLM Client (Claude or Cursor)

Claude Desktop (mcp-remote):
```json
{
  "mcpServers": {
    "mcpjungle-orchestrator": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:18081/mcp",
        "--allow-http"
      ]
    }
  }
}
```

Cursor:
```json
{
  "mcpServers": {
    "mcpjungle-orchestrator": {
      "url": "http://localhost:18081/mcp"
    }
  }
}
```

Tip:
- For LLM agents that don’t manage MCP sessions automatically, start with an `initialize` call (the client typically does this) and reuse `Mcp-Session-Id` for subsequent calls.

## 11) Per-user MCPJungle (multi-tenant options)

You have a few deployment options for isolating per-user MCP stores:

- Separate stacks per user (simple, robust)
  - Run multiple compose projects, one per user, with unique ports and project names.
  - Example:
    - User A: `HOST_PORT=18080 docker compose -p jungle-a up -d` (Jungle A) and `ORCH_HOST_PORT=18081 docker compose -p orch-a -f orchestrator/docker-compose.yml up -d`
    - User B: `HOST_PORT=28080 docker compose -p jungle-b up -d` and `ORCH_HOST_PORT=28081 docker compose -p orch-b -f orchestrator/docker-compose.yml up -d`
  - Each user gets their own Jungle DB and tool registry.

- Single orchestrator with multiple Jungle instances
  - Keep one orchestrator per user stack as shown above; or extend orchestrator to route per-user (x-user-id) to a specific Jungle base URL.

- Advanced (future enhancement)
  - Persist session per `x-user-id` in orchestrator and route to user-scoped Jungle instances dynamically (requires a small service registry)

## 12) Full E2E checklist

- Start stacks
  - Root Jungle: `HOST_PORT=18080 docker compose up -d` (from repo root) or use the orchestrator-local compose if preferred.
  - Orchestrator: `ORCH_HOST_PORT=18081 docker compose up -d` (from orchestrator/)

- Health
  - Orchestrator: `curl -s http://localhost:18081/healthz`
  - Jungle: `curl -s http://localhost:18080/health`

- Register an MCP server in Jungle
```bash
cd /Users/adam/Documents/GitHub/MCPJungle
go build -o mcpjungle .
./mcpjungle --registry http://localhost:9000 register --name context7 --description "Context7" --url https://mcp.context7.com/mcp
./mcpjungle --registry http://localhost:9000 list servers
```

- Orchestrator initialize and tools/list
```bash
# initialize
curl -i -s -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' http://localhost:18081/mcp
# copy Mcp-Session-Id from response

# tools/list
curl -s -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -H 'Mcp-Session-Id: <session>' -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' http://localhost:18081/mcp | jq .
```

- tools/call workflow (resolve → docs)
```bash
# resolve
curl -s -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -H 'Mcp-Session-Id: <session>' -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"context7__resolve-library-id","arguments":{"libraryName":"lodash"}}}' http://localhost:18081/mcp | jq .

# docs
curl -s -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -H 'Mcp-Session-Id: <session>' -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"context7__get-library-docs","arguments":{"context7CompatibleLibraryID":"/lodash/lodash","tokens":2000}}}' http://localhost:18081/mcp | jq .
```

Troubleshooting:
- If tools/list returns 400 via orchestrator, re-run initialize via orchestrator and reuse the reflected `Mcp-Session-Id`.
- Check logs: `docker compose logs orchestrator`, `docker compose logs jungle` (from orchestrator/)

## 13) Docker lifecycle (spin down, up, logs, ps, rebuild)

From orchestrator directory unless noted:

- Spin down stack (remove containers and volumes)
```bash
cd orchestrator
docker compose down -v
```

- Bring stack up (detached)
```bash
ORCH_HOST_PORT=18081 docker compose up -d
```

- Show running services and ports
```bash
docker compose ps
```

- Follow logs for a service
```bash
docker compose logs -f orchestrator
# In another terminal if needed
docker compose logs -f jungle
```

- Rebuild orchestrator image (pick up code changes)
```bash
ORCH_HOST_PORT=18081 docker compose build --no-cache orchestrator
ORCH_HOST_PORT=18081 docker compose up -d orchestrator
```

- Health checks (host)
```bash
# Orchestrator health
curl -s http://localhost:18081/healthz
# Jungle health
curl -s http://localhost:9000/health
```





# 14)FINAL Full from-scratch walkthrough (one terminal at a time)

1) Stop any prior stacks and start fresh
```bash
cd orchestrator
docker compose down -v
ORCH_HOST_PORT=18081 docker compose up -d
```

2) Verify containers
```bash
docker compose ps
# Expect two services, e.g., ports 18081->8080 (orchestrator) and 9000->9000 (jungle)
```

3) Watch orchestrator logs for listener line
```bash
docker compose logs -f orchestrator
# Look for: "orchestrator listening on http://0.0.0.0:8080"
# Ctrl+C to exit
```

4) Health endpoints
```bash
curl -s http://localhost:18081/healthz
curl -s http://localhost:9000/health
```

5) Build CLI and register a real MCP (Context7) in Jungle
```bash
cd /Users/adam/Documents/GitHub/MCPJungle
go build -o mcpjungle .
./mcpjungle --registry http://localhost:9000 register --name context7 --description "Context7" --url https://mcp.context7.com/mcp
./mcpjungle --registry http://localhost:9000 list servers
```

6) Initialize via orchestrator (captures session header)
```bash
curl -i -s -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' \
  http://localhost:18081/mcp
# Copy the Mcp-Session-Id header
```

7) List tools via orchestrator
```bash
curl -s -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Mcp-Session-Id: <session>' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  http://localhost:18081/mcp | jq .
```

8) Call tools via orchestrator (resolve then docs)
```bash
# Resolve context7 library id for lodash
curl -s -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Mcp-Session-Id: <session>' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"context7__resolve-library-id","arguments":{"libraryName":"lodash"}}}' \
  http://localhost:18081/mcp | jq .

# Replace /org/project with the returned ID if different
curl -s -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Mcp-Session-Id: <session>' \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"context7__get-library-docs","arguments":{"context7CompatibleLibraryID":"/lodash/lodash","tokens":2000}}}' \
  http://localhost:18081/mcp | jq .
```

# 14a) script run

cd /Users/adam/Documents/GitHub/MCPJungle/orchestrator
CODEMODE_VERBOSE_LOGS=true npm run walkthrough:final
or
npm run walkthrough:final

---

# 14b) Quick shared Jungle run (one terminal)

1) Start shared stack
```bash
cd orchestrator
docker compose down -v
ORCH_HOST_PORT=18081 docker compose up -d
```

2) Initialize via orchestrator and capture session
```bash
SESSION=$(\
  curl -is -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' \
    http://localhost:18081/mcp | awk -F': ' '/^Mcp-Session-Id:/ {gsub("\r","",$2); print $2}'
)
echo "SESSION=$SESSION"
```

3) (Optional) Register Context7 to shared Jungle once
```bash
cd ..
go build -o mcpjungle .
./mcpjungle --registry http://localhost:9000 register \
  --name context7 --description "Context7" --url https://mcp.context7.com/mcp || true
./mcpjungle --registry http://localhost:9000 list servers
cd orchestrator
```

4) Call Context7 via orchestrator (shared)
```bash
curl -s \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"context7__resolve-library-id","arguments":{"libraryName":"lodash"}}}' \
  http://localhost:18081/mcp | jq .
```

5) Code Mode run (shared)
```bash
CODEMODE_VERBOSE_LOGS=true CODEMODE_LOG_DIR=./logs LIVE_USER_ID=shared npm run -s codemode:live
```

---

# 14c) Per-user run (Alice and Bob)

1) Start stack and enable per-user provisioning
```bash
cd orchestrator
docker compose down -v
ORCH_HOST_PORT=18081 docker compose up -d
export ROUTING_MODE=per_user
export PROVISION_ON_DEMAND=true
export PROVISIONER=docker
```

2) Run automated per-user walkthrough (creates per-user logs under logs/peruser-<ts>/users/<user>)
```bash
npm run walkthrough:peruser
```

Artifacts:
- users/alice and users/bob folders each contain: initialize, servers, codemode script/result, codemode trace, container logs
- orchestrator.log at the root shows route_decision=per_user and route_provisioned for each user

Notes:
- Re-registering the same MCP shows a duplicate error; it’s safe to ignore if `servers.txt` lists it.
- tools/list is for local Jungle tools; remote MCPs do not appear there by design.
- Direct curl calls may rate limit briefly; the script retries.

npm run walkthrough:peruser


## 15) Verify per-user isolation (two independent MCPJungle stores)

Approach: run two separate stacks using different compose projects and a second compose file for user B (to avoid host port conflicts on Jungle).

A) User A stack
```bash
cd orchestrator
# Start A
ORCH_HOST_PORT=18081 docker compose -p orcha up -d
# Verify
docker compose -p orcha ps
# Orchestrator A: http://localhost:18081/mcp
# Jungle A: http://localhost:9000
```

B) User B stack (copy and adjust host Jungle port)
```bash
cd orchestrator
cp docker-compose.yml docker-compose.userb.yml
# Edit docker-compose.userB.yml: change the Jungle host port mapping to "9001:9000"
# (Keep JUNGLE_URL=http://jungle:9000 for orchestrator; it uses the internal container port.)

# Start B on alternate ports
ORCH_HOST_PORT=28081 docker compose -f docker-compose.userb.yml -p orchb up -d
# Verify
docker compose -f docker-compose.userb.yml -p orchb ps
# Orchestrator B: http://localhost:28081/mcp
# Jungle B: http://localhost:9001
```

C) Register different MCP servers in A and B, then compare
```bash
# In A: register Context7
cd /Users/adam/Documents/GitHub/MCPJungle
./mcpjungle --registry http://localhost:9000 register --name context7 --description "Context7" --url https://mcp.context7.com/mcp

# In B: (example) register a different MCP (or another server)
./mcpjungle --registry http://localhost:9001 register --name context7b --description "Context7-B" --url https://mcp.context7.com/mcp

# Initialize and list tools in A
curl -i -s -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' http://localhost:18081/mcp
# Copy session
curl -s -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -H 'Mcp-Session-Id: <sessionA>' -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' http://localhost:18081/mcp | jq .

# Initialize and list tools in B
curl -i -s -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' http://localhost:28081/mcp
# Copy session
curl -s -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -H 'Mcp-Session-Id: <sessionB>' -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' http://localhost:28081/mcp | jq .
```

You should see different tool inventories between A and B if you registered different MCP servers into their respective Jungles.

## 16) Summary: How an LLM works with this app

- The LLM (Claude, Cursor, custom agent) connects to the orchestrator endpoint at `http://localhost:18081/mcp`.
- The client performs `initialize`, receives (or the orchestrator transparently manages) an `Mcp-Session-Id`, and then calls `tools/list` and `tools/call` within that session.
- Orchestrator forwards requests to Jungle, which maintains the user’s MCP registry and tool inventory. Users can register or deregister MCP servers in their Jungle independently.
- For multi-user deployments, run a Jungle per user (separate ports/projects) and point each user’s orchestrator instance to its respective Jungle. This guarantees isolation so users only see and call their own tools.



- “Client performs initialize” means the MCP client (your LLM/agent like Cursor or Claude) sends the standard MCP JSON‑RPC method initialize when it connects to the MCP endpoint. The client does this automatically; you don’t normally do it by hand. We only ran initialize with curl during manual testing to:
  - Prove connectivity and contract.
  - Obtain Mcp-Session-Id for subsequent calls during manual tests.

How the agent integration works end-to-end
- Configure the LLM client to point to the orchestrator MCP endpoint (not Jungle): http://localhost:18081/mcp
- The LLM client connects and calls initialize automatically.
  - Orchestrator forwards initialize to Jungle, gets a Mcp-Session-Id and reflects it back.
- The client then calls tools/list and tools/call within that session. Orchestrator forwards those to Jungle and relays results.
- Users add/remove MCP servers in their own Jungle; the LLM only sees the tools registered in that user’s Jungle as exposed through the orchestrator.

Is it supposed to still “work” if you paste the “wrong” session?
- You tested with two users (A/B). If you paste a session from B into a request to A’s orchestrator, Jungle A will reject it. Orchestrator auto-recovers by silently calling initialize upstream (Jungle A), obtaining a valid A session, then retrying tools/list. That’s why it still returns tools. You’re still isolated: orchestrator A always talks to Jungle A; orchestrator B to Jungle B.

How to see tools each user has (three ways)
- Jungle CLI (direct, per user):
  - User A: ./mcpjungle --registry http://localhost:9000 list tools
  - User B: ./mcpjungle --registry http://localhost:9001 list tools
  - Filter by server: add --server context7 (or context7b)
- Jungle HTTP (direct, per user):
  - User A: curl -s http://localhost:9000/api/v0/tools | jq .
  - User B: curl -s http://localhost:9001/api/v0/tools | jq .
- Through orchestrator MCP (session-based):
  - Initialize (copy Mcp-Session-Id), then:
  - User A: curl -s -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -H 'Mcp-Session-Id: <sessionA>' -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' http://localhost:18081/mcp | jq .
  - User B: same to http://localhost:28081/mcp with <sessionB>.

Part 16 added to the guide
- The guide now includes a full LLM hookup summary and per-user isolation patterns:
  - Orchestrator MCP URL for clients (Claude/Cursor).
  - How initialize/session/tools/list/tools/call work from the LLM perspective.
  - How to validate that each user sees different tools.

Does this work out of the box with LLMs?
- Yes. The orchestrator is a standard MCP server endpoint. Claude Desktop and Cursor can connect via:
  - Claude (mcp-remote): points to the orchestrator URL, does initialize automatically.
  - Cursor: set mcpServers.mcpjungle-orchestrator.url to the orchestrator URL.
- Most MCP clients manage their sessions automatically. If a client doesn’t, the orchestrator already has a 400 auto-recovery path (it will initialize upstream and retry).

How users/LLMs add new MCP servers to their store (today and future)
- Today:
  - CLI (simple): ./mcpjungle --registry http://localhost:<user_jungle_port> register --name <server> --url <mcp_server_url>
  - Or Jungle HTTP API: POST /api/v0/servers (same effect as CLI)
- Future (LLM-initiated registry updates):
  - Add a “registry” admin tool set exposed via the orchestrator that calls Jungle’s server management APIs:
    - create_server (wrap Jungle POST /api/v0/servers)
    - deregister_server
    - list_servers, list_tools
  - Protect it with auth (admin token) and optionally scope by x-user-id so the LLM can add/remove MCPs for the current user only.
  - Once added, the tools appear in tools/list for that user in the same session flow.

You can find the full operational steps, Docker lifecycle, and LLM configs in:
- /Users/adam/Documents/GitHub/MCPJungle/orchestrator/mcp orchestrator pass through layer walk through.md
  - Section 10: LLM clients
  - Sections 11–15: multi-user isolation and verification
  - Sections 13–14: Docker lifecycle and full from-scratch runs

