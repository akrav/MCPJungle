# MCPJungle Complete Architecture & Code Pipeline Guide

> **Purpose**: This document provides comprehensive technical documentation for the entire MCPJungle codebase. It explains not just *what* each component does, but *why* it exists and *how* data flows through the system. Designed to enable another AI agent or developer to understand, integrate with, or extend any part of the system.

---

## Table of Contents

1. [What Problem Does MCPJungle Solve?](#1-what-problem-does-mcpjungle-solve)
2. [The Big Picture](#2-the-big-picture)
3. [Complete Request Flow: A Journey Through the System](#3-complete-request-flow-a-journey-through-the-system)
4. [Component Deep Dive](#4-component-deep-dive)
   - [MCPJungle Registry (Go)](#41-mcpjungle-registry-go)
   - [Orchestrator (TypeScript)](#42-orchestrator-typescript)
   - [Discovery System](#43-discovery-system)
   - [CodeMode Execution Engine](#44-codemode-execution-engine)
5. [Data Flow Patterns](#5-data-flow-patterns)
6. [The MCP Protocol Explained](#6-the-mcp-protocol-explained)
7. [Database Architecture](#7-database-architecture)
8. [Integration Guide](#8-integration-guide)
9. [API Reference](#9-api-reference)
10. [Extending the System](#10-extending-the-system)

---

## 1. What Problem Does MCPJungle Solve?

### The Problem

AI agents (like Claude, GPT, etc.) need to interact with external tools—databases, APIs, file systems, etc. The **Model Context Protocol (MCP)** standardizes how AI agents discover and call these tools. But there's a challenge:

1. **Tool Fragmentation**: Different tools run on different servers with different configurations
2. **Discovery**: AI agents don't know what tools exist or which one to use
3. **Multi-tenancy**: Each user might need different tools or isolated environments
4. **Security**: Arbitrary code execution needs to be sandboxed

### The Solution

MCPJungle provides a **unified gateway** that:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MCPJungle Solution                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. REGISTRY: Stores all available MCP servers and their tools              │
│     "Here's a catalog of 50 tools you can use"                              │
│                                                                             │
│  2. PROXY: Routes requests to the right server automatically                │
│     "You asked for 'github__create_issue'? I'll forward that to GitHub"     │
│                                                                             │
│  3. DISCOVERY: Finds tools based on what you want to do                     │
│     "You want to 'check weather'? Let me find the best weather API"         │
│                                                                             │
│  4. ISOLATION: Each user can have their own environment                     │
│     "User A's tools won't interfere with User B's"                          │
│                                                                             │
│  5. EXECUTION: Safely runs AI-generated code                                │
│     "Run this code, but don't let it access the file system"                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The Big Picture

### System Architecture

```
                                    AI AGENT
                                       │
                                       │ "Call the weather tool"
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATOR (TypeScript)                            │
│                                                                             │
│  Think of this as a "smart receptionist" that:                              │
│  • Receives all requests from AI agents                                     │
│  • Decides where to route them (which Jungle instance?)                     │
│  • Can discover new tools if one is missing                                 │
│  • Can execute AI-generated code safely                                     │
│                                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │   Router    │ │  Discovery  │ │  CodeMode   │ │   Admin     │            │
│  │             │ │             │ │             │ │   API       │            │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └─────────────┘            │
│         │               │               │                                   │
│         │               │               │                                   │
│         │      ┌────────┴────────┐      │                                   │
│         │      │    Supabase     │      │                                   │
│         │      │  (Cloud DB for  │      │                                   │
│         │      │   discovery)    │      │                                   │
│         │      └─────────────────┘      │                                   │
└─────────┼───────────────────────────────┼───────────────────────────────────┘
          │                               │
          ▼                               ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│    JUNGLE INSTANCE(S)       │   │     CODEMODE SANDBOX        │
│    (Go Registry Server)     │   │                             │
│                             │   │  Isolated V8 environment    │
│  • Stores tool registry     │   │  for running AI code        │
│  • Proxies MCP requests     │   │                             │
│  • SQLite database          │   │  (Uses tools via Jungle)    │
│                             │   │                             │
└──────────────┬──────────────┘   └─────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      UPSTREAM MCP SERVERS                                   │
│                                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                │
│  │ GitHub  │ │ Weather │ │ Database│ │ FileSystem │ │ Custom │             │
│  │  API    │ │   API   │ │  Query  │ │  Access  │ │  Tool  │               │
│  │ (HTTP)  │ │ (HTTP)  │ │ (stdio) │ │ (stdio)  │ │  (any) │               │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Three Layers Explained

**Layer 1: Orchestrator (TypeScript)**
- The entry point for all AI agent requests
- Makes routing decisions (shared vs per-user instances)
- Handles tool discovery when a tool isn't found
- Provides the CodeMode execution environment

**Layer 2: Jungle (Go)**
- The actual MCP proxy server
- Maintains a database of registered MCP servers
- Forwards tool calls to the appropriate upstream server
- Can run as shared instance or per-user containers

**Layer 3: Upstream MCP Servers**
- The actual tools (GitHub API, weather service, database, etc.)
- Can use different transports: HTTP, stdio (command line), SSE
- MCPJungle doesn't run these—it just knows how to reach them

---

## 3. Complete Request Flow: A Journey Through the System

Let's trace what happens when an AI agent calls a tool. This is the most important section for understanding how everything connects.

### Scenario: AI Agent Calls `github__create_issue`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  STEP 1: AI Agent sends JSON-RPC request to Orchestrator                    │
│  ──────────────────────────────────────────────────────────────────────     │
│                                                                             │
│  POST /mcp HTTP/1.1                                                         │
│  Content-Type: application/json                                             │
│  X-User-Id: user-12345                                                      │
│                                                                             │
│  {                                                                          │
│    "jsonrpc": "2.0",                                                        │
│    "id": 1,                                                                 │
│    "method": "tools/call",                                                  │
│    "params": {                                                              │
│      "name": "github__create_issue",                                        │
│      "arguments": {                                                         │
│        "repo": "my-org/my-repo",                                            │
│        "title": "Bug: Login broken",                                        │
│        "body": "Users can't log in"                                         │
│      }                                                                      │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  STEP 2: Orchestrator receives request (server/http.ts)                     │
│  ──────────────────────────────────────────────────────────────────────     │
│                                                                             │
│  The Express.js server at /mcp does several things:                         │
│                                                                             │
│  a) Validates the request is valid JSON-RPC                                 │
│  b) Extracts the user ID from headers                                       │
│  c) Applies rate limiting                                                   │
│  d) Checks if the method is allowed (tools/call is allowed)                 │
│                                                                             │
│  // orchestrator/src/server/http.ts                                         │
│  app.post('/mcp', async (req, res) => {                                     │
│    const body = req.body;                                                   │
│    if (!isJsonRpcObject(body)) return res.json(InvalidRequest(id));         │
│                                                                             │
│    const userId = req.headers['x-user-id'];                                 │
│    const decision = await resolveJungleEndpoint({ userId });                │
│    // decision = { baseUrl: 'http://localhost:9000', mode: 'shared' }       │
│    ...                                                                      │
│  });                                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  STEP 3: Route Resolution (routing/router.ts)                               │
│  ──────────────────────────────────────────────────────────────────────     │
│                                                                             │
│  The router decides WHICH Jungle instance should handle this request:       │
│                                                                             │
│  // orchestrator/src/routing/router.ts                                      │
│  async function resolveJungleEndpoint({ userId }) {                         │
│    const cfg = loadConfig(process.env);                                     │
│                                                                             │
│    // MODE 1: Shared - everyone uses the same Jungle                        │
│    if (cfg.routingMode === 'shared' || !userId) {                           │
│      return { baseUrl: cfg.jungleUrl, mode: 'shared' };                     │
│    }                                                                        │
│                                                                             │
│    // MODE 2: Per-user - check if user already has an instance              │
│    const existingUrl = storeGet(userId);                                    │
│    if (existingUrl) {                                                       │
│      return { baseUrl: existingUrl, mode: 'per_user' };                     │
│    }                                                                        │
│                                                                             │
│    // MODE 3: Provision on demand - spin up a new container                 │
│    if (cfg.provisionOnDemand) {                                             │
│      const provisioner = await getProvisioner(); // Docker or K8s           │
│      const { baseUrl } = await provisioner.provision(userId);               │
│      storeSet(userId, baseUrl, ttl);                                        │
│      return { baseUrl, mode: 'per_user' };                                  │
│    }                                                                        │
│                                                                             │
│    // Fallback to shared                                                    │
│    return { baseUrl: cfg.jungleUrl, mode: 'shared' };                       │
│  }                                                                          │
│                                                                             │
│  WHY THIS MATTERS:                                                          │
│  • Shared mode is simple and cheap (one server for everyone)                │
│  • Per-user mode isolates users (User A can't see User B's tools)           │
│  • On-demand provisioning creates containers only when needed               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  STEP 4: Forward to Jungle (server/upstream.ts)                             │
│  ──────────────────────────────────────────────────────────────────────     │
│                                                                             │
│  The Orchestrator forwards the exact same JSON-RPC request to Jungle:       │
│                                                                             │
│  // orchestrator/src/server/upstream.ts                                     │
│  const upstream = await fetch(`${decision.baseUrl}/mcp`, {                  │
│    method: 'POST',                                                          │
│    headers: {                                                               │
│      'Content-Type': 'application/json',                                    │
│      'Mcp-Session-Id': sessionId,     // MCP requires session management    │
│      'Authorization': `Bearer ${token}`,                                    │
│    },                                                                       │
│    body: JSON.stringify(body),        // Same body we received              │
│  });                                                                        │
│                                                                             │
│  SESSION MANAGEMENT:                                                        │
│  MCP requires sessions. The Orchestrator:                                   │
│  1. Calls 'initialize' on first request to get a session ID                 │
│  2. Stores that session ID                                                  │
│  3. Includes it in all subsequent requests                                  │
│  4. Can refresh the session if it expires                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  STEP 5: Jungle Receives Request (Go: internal/api/server.go)               │
│  ──────────────────────────────────────────────────────────────────────     │
│                                                                             │
│  The Jungle server (written in Go) exposes /mcp using the mcp-go library:   │
│                                                                             │
│  // The router wraps the MCP server                                         │
│  streamableHTTPServer := server.NewStreamableHTTPServer(s.mcpProxyServer)   │
│  r.Any("/mcp", gin.WrapH(streamableHTTPServer))                             │
│                                                                             │
│  The MCP server automatically:                                              │
│  1. Parses the JSON-RPC request                                             │
│  2. Identifies it as a 'tools/call' method                                  │
│  3. Looks up the tool by name                                               │
│  4. Invokes the registered handler                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  STEP 6: Tool Handler (Go: internal/service/mcp/proxy.go)                   │
│  ──────────────────────────────────────────────────────────────────────     │
│                                                                             │
│  This is where the magic happens. The proxy handler:                        │
│                                                                             │
│  func MCPProxyToolCallHandler(ctx context.Context, request CallToolRequest) │
│                                                                             │
│  // 1. Parse the tool name to find the server                               │
│  // "github__create_issue" → server: "github", tool: "create_issue"         │
│  serverName, toolName, _ := splitServerToolName(request.Params.Name)        │
│                                                                             │
│  // 2. Look up the server configuration in the database                     │
│  server, _ := m.GetMcpServer(serverName)                                    │
│  // server.Config contains: URL, bearer token, etc.                         │
│                                                                             │
│  // 3. Create a connection to the upstream MCP server                       │
│  mcpClient, _ := newMcpServerSession(ctx, server)                           │
│  // This might:                                                             │
│  //   - Open an HTTP connection to https://api.github.com                   │
│  //   - Spawn a subprocess for stdio servers                                │
│  //   - Connect via SSE                                                     │
│                                                                             │
│  // 4. Forward the request (without the server prefix)                      │
│  request.Params.Name = toolName  // "create_issue" not "github__create_issue│
│  response, _ := mcpClient.CallTool(ctx, request)                            │
│                                                                             │
│  // 5. Return the response                                                  │
│  return response                                                            │
│                                                                             │
│  WHY THE NAME PREFIX?                                                       │
│  • Tools from different servers might have the same name                    │
│  • "github__list" and "gitlab__list" are both "list" tools                  │
│  • The prefix ensures uniqueness across the registry                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  STEP 7: Connect to Upstream Server (Go: internal/service/mcp/util.go)      │
│  ──────────────────────────────────────────────────────────────────────     │
│                                                                             │
│  Depending on the transport type, we connect differently:                   │
│                                                                             │
│  func newMcpServerSession(ctx, server) (*client.Client, error) {            │
│    switch server.Transport {                                                │
│                                                                             │
│    case "http":  // Streamable HTTP (most common)                           │
│      // Connect via HTTP, optionally with bearer token                      │
│      client := client.NewStreamableHttpClient(config.URL)                   │
│      client.Initialize(ctx)  // MCP handshake                               │
│      return client                                                          │
│                                                                             │
│    case "stdio":  // Command line process (local tools)                     │
│      // Spawn a subprocess, communicate via stdin/stdout                    │
│      client := client.NewStdioMCPClient(                                    │
│        "python",                 // command                                 │
│        ["server.py"],            // args                                    │
│        {"API_KEY": "xxx"},       // env vars                                │
│      )                                                                      │
│      return client                                                          │
│                                                                             │
│    case "sse":  // Server-Sent Events (legacy)                              │
│      client := client.NewSSEMCPClient(config.URL)                           │
│      client.Start(ctx)                                                      │
│      return client                                                          │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  THE THREE TRANSPORTS:                                                      │
│  • HTTP: The server is a web service (e.g., https://api.example.com)        │
│  • stdio: The server is a local program (e.g., a Python script)             │
│  • SSE: Like HTTP but uses Server-Sent Events for streaming                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  STEP 8: Response Flows Back                                                │
│  ──────────────────────────────────────────────────────────────────────     │
│                                                                             │
│  The response from the upstream server travels back:                        │
│                                                                             │
│  Upstream Server                                                            │
│      ↓ MCP CallToolResult                                                   │
│  Jungle Proxy Handler                                                       │
│      ↓ Wrapped in JSON-RPC response                                         │
│  Jungle /mcp endpoint                                                       │
│      ↓ HTTP response                                                        │
│  Orchestrator                                                               │
│      ↓ Streams/forwards response                                            │
│  AI Agent                                                                   │
│                                                                             │
│  RESPONSE FORMAT:                                                           │
│  {                                                                          │
│    "jsonrpc": "2.0",                                                        │
│    "id": 1,                                                                 │
│    "result": {                                                              │
│      "content": [                                                           │
│        {                                                                    │
│          "type": "text",                                                    │
│          "text": "Issue #42 created successfully"                           │
│        }                                                                    │
│      ]                                                                      │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Deep Dive

### 4.1 MCPJungle Registry (Go)

The Go service is the **core MCP proxy and registry**. Think of it as a "switchboard" that knows about all available tools and can connect calls to the right place.

#### How Tools Get Registered

When you run `mcpjungle register`, here's what happens:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TOOL REGISTRATION FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USER RUNS:                                                                 │
│  $ mcpjungle register --name github --url https://api.github.com/mcp       │
│                                                                             │
│  STEP 1: CLI parses the command (cmd/register.go)                           │
│  ──────────────────────────────────────────────────────────────────────     │
│  input := types.RegisterServerInput{                                        │
│    Name:      "github",                                                     │
│    Transport: "http",                                                       │
│    URL:       "https://api.github.com/mcp",                                 │
│  }                                                                          │
│  apiClient.RegisterServer(&input)                                           │
│                                                                             │
│  STEP 2: API handler validates and stores (internal/api/mcp_servers.go)     │
│  ──────────────────────────────────────────────────────────────────────     │
│  server := model.NewStreamableHTTPServer(name, desc, url, token)            │
│  mcpService.RegisterMcpServer(ctx, server)                                  │
│                                                                             │
│  STEP 3: Service connects to discover tools (internal/service/mcp/server.go)│
│  ──────────────────────────────────────────────────────────────────────     │
│  // Actually connect to the upstream server                                 │
│  mcpClient, _ := newMcpServerSession(ctx, server)                           │
│                                                                             │
│  // Save the server to database                                             │
│  db.Create(server)                                                          │
│                                                                             │
│  // Fetch all tools from that server                                        │
│  mcpService.registerServerTools(ctx, server, mcpClient)                     │
│                                                                             │
│  STEP 4: Tools are stored and added to proxy (internal/service/mcp/tool.go) │
│  ──────────────────────────────────────────────────────────────────────     │
│  for _, tool := range resp.Tools {                                          │
│    // Store in database                                                     │
│    db.Create(&model.Tool{                                                   │
│      ServerID:    server.ID,                                                │
│      Name:        tool.Name,         // "create_issue"                      │
│      Description: tool.Description,                                         │
│      InputSchema: tool.InputSchema,                                         │
│    })                                                                       │
│                                                                             │
│    // Add to in-memory proxy with canonical name                            │
│    tool.Name = "github__create_issue"  // server + "__" + tool              │
│    mcpProxyServer.AddTool(tool, MCPProxyToolCallHandler)                    │
│  }                                                                          │
│                                                                             │
│  RESULT:                                                                    │
│  • Server "github" saved to SQLite with URL configuration                   │
│  • All tools like "github__create_issue" added to proxy                     │
│  • Tools immediately available for AI agents to call                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Key Data Models

```go
// The server model - WHERE to connect
type McpServer struct {
    ID          uint
    Name        string          // "github" - unique identifier
    Transport   string          // "http", "stdio", or "sse"
    Description string          // Human-readable description
    Config      JSON            // Transport-specific settings:
    // For HTTP: { "url": "https://...", "bearer_token": "xxx" }
    // For stdio: { "command": "python", "args": ["server.py"], "env": {...} }
}

// The tool model - WHAT you can call
type Tool struct {
    ID          uint
    Name        string          // "create_issue" (without server prefix)
    Description string          // "Creates a new GitHub issue"
    InputSchema JSON            // JSON Schema for parameters
    Enabled     bool            // Can be disabled without removing
    ServerID    uint            // Foreign key to McpServer
}
```

#### Why the `__` Separator?

Tools need unique names across the entire registry:

```
Server: "github"  → Tools: "create_issue", "list_repos"
Server: "gitlab"  → Tools: "create_issue", "list_repos"  // Same names!

Solution:
github__create_issue   ← Unique!
gitlab__create_issue   ← Unique!

When proxying:
1. Parse: "github__create_issue" → server="github", tool="create_issue"
2. Look up server config from database
3. Call upstream with just "create_issue"
```

---

### 4.2 Orchestrator (TypeScript)

The Orchestrator adds intelligence and features on top of the basic Jungle proxy.

#### What It Does That Jungle Doesn't

| Feature | Jungle (Go) | Orchestrator (TypeScript) |
|---------|-------------|---------------------------|
| Basic MCP proxy | ✅ | Forwards to Jungle |
| Tool registry | ✅ | Uses Jungle's |
| User routing | ❌ | ✅ Shared vs per-user |
| Container provisioning | ❌ | ✅ Docker/K8s |
| Tool discovery | ❌ | ✅ Vector search |
| Code execution | ❌ | ✅ CodeMode sandbox |

#### Directory Structure Explained

```
orchestrator/src/
│
├── server/          # HTTP SERVER LAYER
│   │                # Handles incoming requests from AI agents
│   │
│   ├── http.ts      # Main Express app
│   │                # • POST /mcp → proxies to Jungle
│   │                # • Validates JSON-RPC format
│   │                # • Rate limiting, auth
│   │
│   ├── upstream.ts  # Jungle communication
│   │                # • fetchWithRetry() - handles flaky connections
│   │                # • Session management (MCP requires sessions)
│   │                # • postToJungle() - used by CodeMode
│   │
│   ├── admin.ts     # Admin API for manual tool selection
│   │                # • POST /admin/select-tool
│   │                # • GET /admin/pending
│   │
│   └── interceptor.ts # Discovery trigger
│                    # • Catches "Method not found" errors
│                    # • Triggers tool discovery
│                    # • Retries after installation
│
├── routing/         # REQUEST ROUTING LAYER
│   │                # Decides which Jungle instance handles a request
│   │
│   ├── router.ts    # Main routing logic
│   │                # • resolveJungleEndpoint() → { baseUrl, mode }
│   │                # • Shared mode: same URL for everyone
│   │                # • Per-user: user-specific containers
│   │
│   ├── store.ts     # User → URL mapping
│   │                # • In-memory Map with TTL
│   │                # • get(userId) → baseUrl
│   │                # • set(userId, baseUrl, ttl)
│   │
│   └── types.ts     # RouteDecision interface
│
├── provisioning/    # CONTAINER MANAGEMENT LAYER
│   │                # Spins up isolated Jungle instances
│   │
│   ├── types.ts     # Provisioner interface
│   │                # • provision(userId) → { baseUrl }
│   │                # • stop(userId)
│   │                # • isHealthy(baseUrl)
│   │
│   ├── docker.ts    # Docker provisioner
│   │                # • Runs: docker run jungle-{userId} -p 0:9000 ...
│   │                # • Gets assigned port from docker inspect
│   │
│   └── k8s.ts       # Kubernetes provisioner
│                    # • Creates Deployment + Service per user
│
├── discovery/       # TOOL DISCOVERY LAYER (Epic 4)
│   │                # Finds tools based on what user wants to do
│   │
│   ├── supabase/    # Database connection
│   ├── search/      # Vector search pipeline
│   ├── selection/   # Filtering & ranking
│   ├── preferences/ # User settings
│   ├── provisioning/# Tool installation
│   └── interaction/ # Manual mode UI
│   │
│   └── index.ts     # Main entry: resolveMissingTool()
│
├── codemode/        # CODE EXECUTION LAYER
│   │                # Safely runs AI-generated code
│   │
│   ├── runner.ts    # runCode() - main entry point
│   ├── invoker.ts   # invokeTool() - bridges code to Jungle
│   └── ...          # Type generation, caching, telemetry
│
└── config/          # CONFIGURATION
    ├── schema.ts    # Zod schema for env vars
    └── load.ts      # loadConfig(process.env)
```

---

### 4.3 Discovery System

The Discovery System (Epic 4) automatically finds tools when an AI agent needs something that isn't registered.

#### The Problem It Solves

```
AI Agent: "I need to check the weather in London"

WITHOUT Discovery:
  → Error: "Method not found: weather__get_forecast"
  → AI agent is stuck

WITH Discovery:
  1. Intercept the error
  2. Search for tools matching "weather forecast London"
  3. Find "Test Weather API" with 95% similarity
  4. Install it for the user
  5. Retry the original request
  → Success!
```

#### How It Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DISCOVERY PIPELINE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INPUT: User query "I need to check weather"                                │
│                                                                             │
│  STEP 1: QUERY EXPANSION (search/queryExpansion.ts)                         │
│  ────────────────────────────────────────────────────────────               │
│  We don't search for "check weather" directly. Instead, we ask              │
│  an LLM to generate an "ideal tool description":                            │
│                                                                             │
│  User Query: "check weather"                                                │
│           ↓                                                                 │
│  GPT-4o-mini prompt:                                                        │
│    "Given a user's query about what they want to accomplish,                │
│     generate an ideal tool description..."                                  │
│           ↓                                                                 │
│  Expanded: "A comprehensive weather API for getting current                 │
│            conditions, forecasts, and alerts by location.                   │
│            Supports city name, coordinates, and zip code lookups."          │
│                                                                             │
│  WHY? "check weather" is vague. The expanded description                    │
│  matches better with tool descriptions in the database.                     │
│                                                                             │
│  STEP 2: EMBEDDING GENERATION (search/embedding.ts)                         │
│  ────────────────────────────────────────────────────────────               │
│  Convert the expanded text into a vector (array of numbers):                │
│                                                                             │
│  Text: "A comprehensive weather API..."                                     │
│           ↓                                                                 │
│  OpenAI text-embedding-3-small                                              │
│           ↓                                                                 │
│  Vector: [0.023, -0.041, 0.089, ...] (1536 dimensions)                      │
│                                                                             │
│  WHY? Vectors allow semantic similarity comparison.                         │
│  "weather forecast" and "meteorological predictions" will have              │
│  similar vectors even though the words are different.                       │
│                                                                             │
│  STEP 3: VECTOR SEARCH (search/vectorStore.ts)                              │
│  ────────────────────────────────────────────────────────────               │
│  Search Supabase for tools with similar description embeddings:             │
│                                                                             │
│  Query Vector: [0.023, -0.041, ...]                                         │
│           ↓                                                                 │
│  Supabase RPC: match_tools_orchestrator(                                    │
│    query_embedding: [0.023, -0.041, ...],                                   │
│    match_threshold: 0.5,    // Minimum 50% similarity                       │
│    match_count: 10          // Return top 10                                │
│  )                                                                          │
│           ↓                                                                 │
│  Results:                                                                   │
│  1. "Test Weather API" - similarity: 0.89                                   │
│  2. "Climate Data Service" - similarity: 0.72                               │
│  3. "Air Quality Monitor" - similarity: 0.58                                │
│                                                                             │
│  HOW? Supabase uses pgvector extension for cosine similarity:               │
│  1 - (query_embedding <=> stored_embedding)                                 │
│                                                                             │
│  STEP 4: FILTERING (selection/filters.ts)                                   │
│  ────────────────────────────────────────────────────────────               │
│  Apply user's constraints:                                                  │
│                                                                             │
│  User Preferences:                                                          │
│    max_price_cap: 0.01         // Max $0.01 per call                        │
│    min_rating_threshold: 3.0   // At least 3 stars                          │
│                                                                             │
│  Before filter: 3 tools                                                     │
│  After filter: 2 tools (Air Quality filtered - too expensive)               │
│                                                                             │
│  STEP 5: RANKING (selection/ranking.ts)                                     │
│  ────────────────────────────────────────────────────────────               │
│  Sort by user's preferred strategy:                                         │
│                                                                             │
│  Strategy: "balanced"                                                       │
│                                                                             │
│  score = (rating / 5 * 0.6) + ((1 - price/0.01) * 0.4)                      │
│                                                                             │
│  Tool 1: score = (4.5/5 * 0.6) + (0.95 * 0.4) = 0.92                        │
│  Tool 2: score = (3.0/5 * 0.6) + (0.90 * 0.4) = 0.72                        │
│                                                                             │
│  STEP 6: MODE DECISION (selection/index.ts)                                 │
│  ────────────────────────────────────────────────────────────               │
│                                                                             │
│  IF discovery_mode = "auto":                                                │
│    → Install the top-ranked tool automatically                              │
│    → Retry the original request                                             │
│                                                                             │
│  IF discovery_mode = "manual":                                              │
│    → Store candidates in pending state                                      │
│    → Prompt user: "Please select a tool:"                                   │
│      1. Test Weather API - $0.005/call - ★★★★☆                              │
│      2. Climate Data - $0.001/call - ★★★☆☆                                  │
│    → Wait for admin API call                                                │
│                                                                             │
│  STEP 7: INSTALLATION (provisioning/installer.ts)                           │
│  ────────────────────────────────────────────────────────────               │
│  Once a tool is selected:                                                   │
│                                                                             │
│  1. Generate canonical name: "Test_Weather_API__a1b2c3d4"                   │
│  2. Save to user_tools_orchestrator table                                   │
│  3. Trigger runtime refresh callbacks                                       │
│                                                                             │
│  OUTPUT: Tool installed, ready for use                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Manual Mode Flow

When `discovery_mode = "manual"`, the system pauses for human approval:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MANUAL MODE FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Discovery finds candidates, stores them:                                │
│                                                                             │
│     // discovery/interaction/pendingState.ts                                │
│     storePendingChoices(requestId, userId, query, candidates)               │
│     // Stored in memory Map with 5-minute expiration                        │
│                                                                             │
│  2. System outputs prompt to console:                                       │
│                                                                             │
│     ┌──────────────────────────────────────────────────────────────┐        │
│     │  MANUAL SELECTION REQUIRED                                   │        │
│     │  Request ID: req_1704518400_abc123                           │        │
│     │  Query: "check weather"                                      │        │
│     │                                                              │        │
│     │  Candidates:                                                 │        │
│     │  ┌────┬────────────────────┬─────────┬────────┐              │        │
│     │  │ #  │ Name               │ Price   │ Rating │              │        │
│     │  ├────┼────────────────────┼─────────┼────────┤              │        │
│     │  │ 1  │ Test Weather API   │ $0.0050 │ ★★★★☆  │              │        │
│     │  │ 2  │ Climate Data Svc   │ $0.0010 │ ★★★☆☆  │              │        │
│     │  └────┴────────────────────┴─────────┴────────┘              │        │
│     │                                                              │        │
│     │  To select tool 1:                                           │        │
│     │  curl -X POST http://localhost:8080/admin/select-tool \      │        │
│     │    -H "Content-Type: application/json" \                     │        │
│     │    -d '{"requestId":"req_...","toolId":"uuid","action":"select"}'    │
│     └──────────────────────────────────────────────────────────────┘        │
│                                                                             │
│  3. Admin calls the API:                                                    │
│                                                                             │
│     POST /admin/select-tool                                                 │
│     { "requestId": "req_...", "toolId": "uuid...", "action": "select" }     │
│                                                                             │
│  4. Admin route handler (server/admin.ts):                                  │
│                                                                             │
│     // Validate request exists and tool is in candidates                    │
│     const pending = getPendingChoices(requestId);                           │
│     const selectedTool = pending.candidates.find(t => t.id === toolId);     │
│                                                                             │
│     // Install the tool                                                     │
│     await installTool(pending.userId, selectedTool);                        │
│                                                                             │
│     // Clear the pending state                                              │
│     clearPendingChoices(requestId);                                         │
│                                                                             │
│  5. Response: { "success": true, "message": "Tool installed" }              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.4 CodeMode Execution Engine

CodeMode allows AI agents to **generate and execute code** that calls MCP tools.

#### Why CodeMode?

Sometimes an AI needs to do complex operations:

```
AI: "Get all issues from my-repo, filter to bugs created this week,
     and post a summary to Slack"

WITHOUT CodeMode:
  Tool call 1: github__list_issues → 150 issues
  Tool call 2: Filter in AI's head (slow, error-prone)
  Tool call 3: slack__post_message

WITH CodeMode:
  AI generates JavaScript:
  ```javascript
  const issues = await tools.github__list_issues({ repo: "my-repo" });
  const bugs = issues.filter(i => 
    i.labels.includes("bug") && 
    new Date(i.created_at) > weekAgo
  );
  await tools.slack__post_message({ 
    channel: "#bugs",
    text: `Found ${bugs.length} new bugs this week`
  });
  return { summary: bugs.length };
  ```
```

#### How It Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CODEMODE EXECUTION FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INPUT: AI-generated code string                                            │
│                                                                             │
│  STEP 1: RUNNER SETUP (codemode/runner.ts)                                  │
│  ────────────────────────────────────────────────────────────               │
│                                                                             │
│  async function runCode(params) {                                           │
│    const { code, invoker, security } = params;                              │
│                                                                             │
│    // Build security limits                                                 │
│    const limits = {                                                         │
│      maxExecutionTime: 30000,  // 30 seconds                                │
│      maxMemoryMB: 128,         // 128 MB                                    │
│      maxToolCalls: 50,         // Prevent infinite loops                    │
│    };                                                                       │
│                                                                             │
│    // Create a "registry" that routes all tool calls through invoker        │
│    let toolCallCount = 0;                                                   │
│    const registry = {                                                       │
│      async executeTool(name, args) {                                        │
│        toolCallCount++;                                                     │
│        if (toolCallCount > limits.maxToolCalls) {                           │
│          throw new Error("LimitExceeded: tool-calls");                      │
│        }                                                                    │
│        return invoker(name, args);  // Bridge to Jungle                     │
│      },                                                                     │
│      hasTool: () => true,  // Assume all tools exist                        │
│    };                                                                       │
│  }                                                                          │
│                                                                             │
│  STEP 2: ISOLATED EXECUTION (codemode-standalone)                           │
│  ────────────────────────────────────────────────────────────               │
│                                                                             │
│  Uses isolated-vm to run code in a separate V8 isolate:                     │
│                                                                             │
│  // Create isolate with memory limit                                        │
│  const isolate = new ivm.Isolate({                                          │
│    memoryLimit: 128  // MB                                                  │
│  });                                                                        │
│                                                                             │
│  // Create execution context                                                │
│  const context = await isolate.createContext();                             │
│                                                                             │
│  // Inject the 'tools' proxy object                                         │
│  // When code calls tools.github__list_issues(args),                        │
│  // it bridges back to our registry.executeTool()                           │
│  await jail.set('__executeToolNative', callbackRef);                        │
│                                                                             │
│  // Execute with timeout                                                    │
│  const script = await isolate.compileScript(code);                          │
│  const result = await script.run(context, {                                 │
│    timeout: 30000,  // 30 second timeout                                    │
│    promise: true,   // Handle async code                                    │
│  });                                                                        │
│                                                                             │
│  SECURITY BOUNDARIES:                                                       │
│  • Separate V8 process (memory isolation)                                   │
│  • No access to Node.js APIs (require, process, etc.)                       │
│  • No file system access                                                    │
│  • No network access (except through tools)                                 │
│  • Memory and time limits enforced                                          │
│                                                                             │
│  STEP 3: TOOL INVOCATION BRIDGE (codemode/invoker.ts)                       │
│  ────────────────────────────────────────────────────────────               │
│                                                                             │
│  When code calls a tool, it bridges to Jungle:                              │
│                                                                             │
│  async function invokeTool(functionName, args, ctx) {                       │
│    // Resolve which Jungle instance to use                                  │
│    const decision = await resolveJungleEndpoint({ userId });                │
│                                                                             │
│    // Build JSON-RPC request                                                │
│    const body = {                                                           │
│      jsonrpc: '2.0',                                                        │
│      id: generateId(),                                                      │
│      method: 'tools/call',                                                  │
│      params: { name: functionName, arguments: args }                        │
│    };                                                                       │
│                                                                             │
│    // POST to Jungle                                                        │
│    const response = await postToJungle(body, {                              │
│      userId,                                                                │
│      useSession: true,  // Include MCP session ID                           │
│      baseUrl: decision.baseUrl                                              │
│    });                                                                      │
│                                                                             │
│    // Parse and return result                                               │
│    const json = await response.json();                                      │
│    if (json.error) throw new Error(json.error.message);                     │
│    return json.result;                                                      │
│  }                                                                          │
│                                                                             │
│  OUTPUT: { result: { summary: 5 }, executionTime: 1234 }                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Data Flow Patterns

### Pattern 1: Simple Tool Call

```
AI Agent                      Orchestrator                    Jungle                    Upstream
   │                              │                             │                           │
   │ POST /mcp                    │                             │                           │
   │ tools/call "github__..."     │                             │                           │
   ├─────────────────────────────>│                             │                           │
   │                              │ resolveJungleEndpoint()     │                           │
   │                              │ → shared mode               │                           │
   │                              │                             │                           │
   │                              │ POST /mcp                   │                           │
   │                              │ tools/call "github__..."    │                           │
   │                              ├────────────────────────────>│                           │
   │                              │                             │ Split: github + tool      │
   │                              │                             │ Look up github config     │
   │                              │                             │                           │
   │                              │                             │ POST /mcp                 │
   │                              │                             │ tools/call "..."          │
   │                              │                             ├──────────────────────────>│
   │                              │                             │                           │
   │                              │                             │<──────────────────────────┤
   │                              │                             │ Result                    │
   │                              │<────────────────────────────┤                           │
   │<─────────────────────────────┤ Result                      │                           │
   │ Result                       │                             │                           │
```

### Pattern 2: Discovery Flow

```
AI Agent                      Orchestrator                    Supabase                   Jungle
   │                              │                             │                           │
   │ POST /mcp                    │                             │                           │
   │ tools/call "weather__..."    │                             │                           │
   ├─────────────────────────────>│                             │                           │
   │                              │ Forward to Jungle           │                           │
   │                              ├──────────────────────────────────────────────────────>│
   │                              │                             │                           │
   │                              │<──────────────────────────────────────────────────────┤
   │                              │ Error: Method not found     │                           │
   │                              │                             │                           │
   │                              │ Discovery triggered         │                           │
   │                              │ expandQuery("weather")      │                           │
   │                              │ → "A weather API..."        │                           │
   │                              │                             │                           │
   │                              │ generateEmbedding()         │                           │
   │                              │ → [0.023, ...]              │                           │
   │                              │                             │                           │
   │                              │ RPC: match_tools()          │                           │
   │                              ├────────────────────────────>│                           │
   │                              │<────────────────────────────┤                           │
   │                              │ Results: Weather API (0.89) │                           │
   │                              │                             │                           │
   │                              │ Filter & Rank               │                           │
   │                              │ → Weather API wins          │                           │
   │                              │                             │                           │
   │                              │ Install tool                │                           │
   │                              ├────────────────────────────>│                           │
   │                              │                             │                           │
   │                              │ Retry original request      │                           │
   │                              ├──────────────────────────────────────────────────────>│
   │                              │<──────────────────────────────────────────────────────┤
   │<─────────────────────────────┤ Result (this time it works!)│                           │
```

### Pattern 3: Per-User Provisioning

```
AI Agent                      Orchestrator                    Docker                     New Jungle
   │                              │                             │                           │
   │ POST /mcp                    │                             │                           │
   │ X-User-Id: user-123          │                             │                           │
   ├─────────────────────────────>│                             │                           │
   │                              │ resolveJungleEndpoint()     │                           │
   │                              │ → per_user mode             │                           │
   │                              │ → no existing instance      │                           │
   │                              │                             │                           │
   │                              │ DockerProvisioner.provision │                           │
   │                              ├────────────────────────────>│                           │
   │                              │                             │ docker run jungle-user123│
   │                              │                             │ -p 0:9000                │
   │                              │                             ├─────────────────────────>│
   │                              │                             │                           │
   │                              │<────────────────────────────┤                           │
   │                              │ { baseUrl: localhost:54321 }│                           │
   │                              │                             │                           │
   │                              │ Store mapping               │                           │
   │                              │ user-123 → localhost:54321  │                           │
   │                              │                             │                           │
   │                              │ Forward to new instance     │                           │
   │                              ├──────────────────────────────────────────────────────>│
   │                              │<──────────────────────────────────────────────────────┤
   │<─────────────────────────────┤                             │                           │
```

---

## 6. The MCP Protocol Explained

### What is MCP?

MCP (Model Context Protocol) is a standard for AI agents to interact with tools. Think of it like HTTP for AI tool calls.

### Message Format

MCP uses JSON-RPC 2.0:

```javascript
// REQUEST
{
  "jsonrpc": "2.0",          // Always "2.0"
  "id": 1,                   // Unique ID for this request
  "method": "tools/call",    // What you're doing
  "params": {                // Parameters for the method
    "name": "github__create_issue",
    "arguments": {
      "repo": "my-org/my-repo",
      "title": "Bug report"
    }
  }
}

// SUCCESS RESPONSE
{
  "jsonrpc": "2.0",
  "id": 1,                   // Same ID as request
  "result": {
    "content": [
      { "type": "text", "text": "Issue #42 created" }
    ]
  }
}

// ERROR RESPONSE
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,          // Standard error code
    "message": "Method not found",
    "data": { "method": "weather__get_forecast" }
  }
}
```

### Available Methods

| Method | Description | Example Params |
|--------|-------------|----------------|
| `initialize` | Start session | `{ protocolVersion: "2024-11-05" }` |
| `tools/list` | List available tools | `{}` |
| `tools/call` | Call a tool | `{ name: "...", arguments: {...} }` |
| `cancel` | Cancel a request | `{ id: 1 }` |

### Session Management

MCP requires sessions for stateful operations:

```
1. Client sends: initialize
2. Server responds with session ID in header: Mcp-Session-Id: abc123
3. Client includes header in all subsequent requests
4. Sessions expire after inactivity
```

---

## 7. Database Architecture

### Local SQLite (Jungle)

Stored at `mcpjungle.db`, managed by GORM.

```sql
-- MCP Servers (where to connect)
CREATE TABLE mcp_servers (
  id          INTEGER PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,     -- "github"
  transport   VARCHAR(30) NOT NULL,     -- "http", "stdio", "sse"
  description TEXT,
  config      JSON NOT NULL             -- Transport-specific config
);

-- Tools (what you can call)
CREATE TABLE tools (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,           -- "create_issue" (no prefix)
  enabled      BOOLEAN DEFAULT TRUE,
  description  TEXT,
  input_schema JSON,                    -- JSON Schema for validation
  server_id    INTEGER REFERENCES mcp_servers(id)
);

-- Example data:
INSERT INTO mcp_servers VALUES (1, 'github', 'http', 'GitHub API', 
  '{"url": "https://api.github.com/mcp", "bearer_token": "ghp_xxx"}');

INSERT INTO tools VALUES (1, 'create_issue', TRUE, 
  'Creates a GitHub issue', '{"type":"object",...}', 1);
```

### Supabase Cloud (Discovery)

Used by the Orchestrator for tool discovery and user preferences.

```sql
-- EXISTING TABLE (Read-only for orchestrator)
-- This is the marketplace of available tools
CREATE TABLE tools (
  id             UUID PRIMARY KEY,
  name           VARCHAR NOT NULL,        -- "Weather API"
  description    VARCHAR NOT NULL,        -- For semantic search
  endpoint_url   VARCHAR NOT NULL,        -- Where to call it
  price_per_call REAL NOT NULL,           -- Cost per invocation
  average_rating REAL NOT NULL,           -- User rating
  listing_status TEXT NOT NULL            -- 'ACTIVE' or 'INACTIVE'
);

-- ORCHESTRATOR TABLE: Vector embeddings for search
CREATE TABLE tool_embeddings_orchestrator (
  id                    UUID PRIMARY KEY,
  tool_id               UUID UNIQUE REFERENCES tools(id),
  description_embedding VECTOR(1536),      -- OpenAI embedding
  created_at            TIMESTAMPTZ
);

-- ORCHESTRATOR TABLE: User preferences
CREATE TABLE user_preferences_orchestrator (
  user_id               UUID PRIMARY KEY,
  discovery_mode        TEXT DEFAULT 'manual',    -- 'auto' or 'manual'
  auto_install_strategy TEXT DEFAULT 'balanced',  -- 'cheapest', 'rating', 'balanced'
  max_price_cap         REAL DEFAULT 1.0,         -- Max $/call
  min_rating_threshold  REAL DEFAULT 3.0,         -- Min stars
  created_at            TIMESTAMPTZ
);

-- ORCHESTRATOR TABLE: Installed tools per user
CREATE TABLE user_tools_orchestrator (
  id             UUID PRIMARY KEY,
  user_id        UUID NOT NULL,
  tool_id        UUID REFERENCES tools(id),
  canonical_name TEXT NOT NULL,           -- "Weather_API__a1b2c3d4"
  installed_at   TIMESTAMPTZ,
  is_active      BOOLEAN DEFAULT TRUE
);

-- Vector search function
CREATE FUNCTION match_tools_orchestrator(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
) RETURNS TABLE (id UUID, name VARCHAR, similarity FLOAT, ...)
AS $$
  SELECT t.*, 1 - (e.description_embedding <=> query_embedding) AS similarity
  FROM tools t
  JOIN tool_embeddings_orchestrator e ON t.id = e.tool_id
  WHERE 1 - (e.description_embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
```

---

## 8. Integration Guide

### Adding Lambda Support

To add AWS Lambda as a provisioning option:

```typescript
// orchestrator/src/provisioning/lambda.ts

import { Provisioner } from './types.js';
import { LambdaClient, CreateFunctionCommand } from '@aws-sdk/client-lambda';

export class LambdaProvisioner implements Provisioner {
  private client: LambdaClient;
  
  constructor(config: { region: string }) {
    this.client = new LambdaClient({ region: config.region });
  }
  
  async provision(userId: string): Promise<{ baseUrl: string }> {
    // 1. Create Lambda function for this user
    const functionName = `jungle-${userId}`;
    
    await this.client.send(new CreateFunctionCommand({
      FunctionName: functionName,
      Runtime: 'nodejs20.x',
      Handler: 'index.handler',
      Code: {
        S3Bucket: 'mcpjungle-packages',
        S3Key: 'jungle-lambda.zip',
      },
      Environment: {
        Variables: { USER_ID: userId },
      },
    }));
    
    // 2. Create API Gateway endpoint
    const apiUrl = await this.createApiGateway(functionName);
    
    return { baseUrl: apiUrl };
  }
  
  async stop(userId: string): Promise<void> {
    // Delete Lambda function and API Gateway
  }
  
  async isHealthy(baseUrl: string): Promise<boolean> {
    // Ping the Lambda endpoint
  }
}

// Register in types.ts
export async function getProvisioner(): Promise<Provisioner> {
  switch (cfg.provisioner) {
    case 'lambda':
      return new LambdaProvisioner({ region: cfg.awsRegion });
    // ...existing cases...
  }
}
```

### Connecting External Tool Endpoints

To call tools that are already deployed externally:

```typescript
// In your tool call handler, instead of proxying to Jungle,
// you could forward directly to the tool's endpoint_url:

async function callExternalTool(tool: Tool, args: unknown) {
  // Tool has endpoint_url from Supabase
  const response = await fetch(tool.endpoint_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Add any required auth
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { arguments: args },
    }),
  });
  
  return response.json();
}
```

### Adding a New Selection Strategy

```typescript
// orchestrator/src/discovery/selection/ranking.ts

export type SortStrategy = 'cheapest' | 'rating' | 'balanced' | 'similarity';

export function rankTools<T extends RankableTool>(
  tools: T[],
  strategy: SortStrategy
): T[] {
  switch (strategy) {
    case 'similarity':
      // New strategy: prioritize semantic match
      return tools.sort((a, b) => 
        (b.similarity ?? 0) - (a.similarity ?? 0)
      );
    
    case 'cheapest':
      return tools.sort((a, b) => 
        a.price_per_call - b.price_per_call
      );
    
    case 'rating':
      return tools.sort((a, b) => 
        b.average_rating - a.average_rating
      );
    
    case 'balanced':
      return tools.sort((a, b) => 
        calculateBalancedScore(b) - calculateBalancedScore(a)
      );
  }
}
```

---

## 9. API Reference

### Orchestrator Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/healthz` | GET | Health check |
| `/mcp` | POST | MCP JSON-RPC proxy |
| `/admin/select-tool` | POST | Manual tool selection |
| `/admin/pending` | GET | List pending selections |
| `/admin/health` | GET | Admin API health |

### Jungle Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/mcp` | POST | MCP endpoint (streamable HTTP) |
| `/sse` | GET | MCP endpoint (SSE) |
| `/api/v0/servers` | GET/POST | List/register servers |
| `/api/v0/tools` | GET | List tools |
| `/api/v0/tools/invoke` | POST | Direct tool invocation |

### MCP Methods

| Method | Purpose |
|--------|---------|
| `initialize` | Start session |
| `tools/list` | List available tools |
| `tools/call` | Call a tool |
| `cancel` | Cancel request |

---

## 10. Extending the System

### Key Extension Points

1. **New Provisioner**: Implement `Provisioner` interface in `orchestrator/src/provisioning/`
2. **New Transport**: Add case in `internal/service/mcp/util.go`
3. **New Selection Strategy**: Add to `orchestrator/src/discovery/selection/ranking.ts`
4. **New Admin Endpoint**: Add route in `orchestrator/src/server/admin.ts`

### Configuration

All configuration is via environment variables. Add new ones:

```typescript
// orchestrator/src/config/schema.ts
export const configSchema = z.object({
  // Add your new config
  AWS_REGION: z.string().optional(),
  LAMBDA_ROLE_ARN: z.string().optional(),
});
```

### Testing

```bash
# Run Go tests
cd /MCPJungle && go test ./...

# Run TypeScript tests
cd /MCPJungle/orchestrator && npm test

# Run specific test file
npm test -- tests/sprint4-5/e2e_auto_mode.spec.ts
```

---

## 11. Complete End-to-End Pipeline: All Paths Explained

This section provides a comprehensive walkthrough of **every possible path** a request can take through MCPJungle, from the moment an AI agent makes a request to the final response. It also identifies the **exact code locations** where Lambda or other infrastructure can be integrated.

### 11.1 The Master Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    COMPLETE MCPJUNGLE PIPELINE                                      │
│                                                                                                     │
│  This diagram shows EVERY path a request can take through the system                                │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘

                                         ┌─────────────┐
                                         │  AI AGENT   │
                                         │ (Claude,GPT)│
                                         └──────┬──────┘
                                                │
                                    POST /mcp + X-User-Id header
                                    { method: "tools/call", params: { name: "weather__forecast" } }
                                                │
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    ORCHESTRATOR (Entry Point)                                         │
│                                    orchestrator/src/server/http.ts                                    │
│                                                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 1: VALIDATE & EXTRACT                                                                      │  │
│  │ • Parse JSON-RPC body                                                                           │  │
│  │ • Extract userId from X-User-Id header                                                          │  │
│  │ • Apply rate limiting                                                                           │  │
│  │ • Check method is allowed (tools/call, tools/list, initialize, cancel)                          │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                │                                                      │
│                                                ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 2: ROUTE RESOLUTION                                                                        │  │
│  │ orchestrator/src/routing/router.ts → resolveJungleEndpoint({ userId })                          │  │
│  │                                                                                                 │  │
│  │                            ┌──────────────────────────┐                                         │  │
│  │                            │  What's the ROUTING_MODE? │                                        │  │
│  │                            └────────────┬─────────────┘                                         │  │
│  │                                         │                                                       │  │
│  │              ┌──────────────────────────┼──────────────────────────┐                            │  │
│  │              ▼                          ▼                          ▼                            │  │
│  │   ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐                 │  │
│  │   │   MODE: shared      │    │   MODE: per_user    │    │  MODE: per_user     │                 │  │
│  │   │                     │    │   (existing user)   │    │  (NEW user)         │                 │  │
│  │   │ Return config's     │    │                     │    │                     │                 │  │
│  │   │ JUNGLE_URL          │    │ Lookup in store:    │    │ PROVISION ON DEMAND │                 │  │
│  │   │                     │    │ store.get(userId)   │    │                     │                 │  │
│  │   │ baseUrl: "http://   │    │ → found!            │    │ 🔌 INTEGRATION      │                 │  │
│  │   │ localhost:9000"     │    │                     │    │    POINT #1         │                 │  │
│  │   │                     │    │ baseUrl: "http://   │    │                     │                 │  │
│  │   └─────────────────────┘    │ localhost:54321"    │    │ getProvisioner()    │                 │  │
│  │                              └─────────────────────┘    │ .provision(userId)  │                 │  │
│  │                                                         │                     │                 │  │
│  │                                                         │ Docker/K8s/Lambda   │                 │  │
│  │                                                         └─────────────────────┘                 │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                │                                                      │
│                                      RouteDecision: { baseUrl, mode }                                 │
│                                                │                                                      │
│                                                ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 3: FORWARD TO JUNGLE                                                                       │  │
│  │ orchestrator/src/server/upstream.ts → postToJungle(body, { baseUrl })                           │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    JUNGLE (Go Registry Server)                                        │
│                                    internal/api/server.go → /mcp endpoint                             │
│                                                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 4: MCP SERVER PROCESSES REQUEST                                                            │  │
│  │ The mcp-go library parses the JSON-RPC and invokes the registered handler                       │  │
│  │                                                                                                 │  │
│  │ internal/service/mcp/proxy.go → MCPProxyToolCallHandler(request)                                │  │
│  │                                                                                                 │  │
│  │  1. Parse tool name: "weather__forecast" → server="weather", tool="forecast"                    │  │
│  │  2. Look up server config from SQLite: db.Where("name = ?", "weather")                          │  │
│  │                                                                                                 │  │
│  │                            ┌─────────────────────────────┐                                      │  │
│  │                            │  Is server "weather" found? │                                      │  │
│  │                            └──────────────┬──────────────┘                                      │  │
│  │                                           │                                                     │  │
│  │              ┌────────────────────────────┼────────────────────────────┐                        │  │
│  │              ▼                                                         ▼                        │  │
│  │   ┌─────────────────────────────┐                      ┌─────────────────────────────┐          │  │
│  │   │         YES - FOUND         │                      │         NO - NOT FOUND      │          │  │
│  │   │                             │                      │                             │          │  │
│  │   │  Continue to connect...     │                      │  Return JSON-RPC Error:     │          │  │
│  │   │                             │                      │  {                          │          │  │
│  │   │  See STEP 5                 │                      │    error: {                 │          │  │
│  │   │                             │                      │      code: -32601,          │          │  │
│  │   │                             │                      │      message: "Method       │          │  │
│  │   │                             │                      │               not found"    │          │  │
│  │   │                             │                      │    }                        │          │  │
│  │   │                             │                      │  }                          │          │  │
│  │   └──────────────┬──────────────┘                      └──────────────┬──────────────┘          │  │
│  │                  │                                                    │                         │  │
│  │                  │                                                    │                         │  │
│  │                  ▼                                                    │                         │  │
│  │   ┌─────────────────────────────┐                                     │                         │  │
│  │   │ STEP 5: CONNECT TO UPSTREAM │                                     │                         │  │
│  │   │ internal/service/mcp/util.go│                                     │                         │  │
│  │   │                             │                                     │                         │  │
│  │   │ newMcpServerSession(server) │                                     │                         │  │
│  │   │                             │                                     │                         │  │
│  │   │ Based on server.Transport:  │                                     │                         │  │
│  │   │ • http → HTTP connection    │                                     │                         │  │
│  │   │ • stdio → spawn subprocess  │                                     │                         │  │
│  │   │ • sse → SSE connection      │                                     │                         │  │
│  │   │                             │                                     │                         │  │
│  │   │ 🔌 INTEGRATION POINT #2     │                                     │                         │  │
│  │   │ Add: lambda → invoke Lambda │                                     │                         │  │
│  │   └──────────────┬──────────────┘                                     │                         │  │
│  │                  │                                                    │                         │  │
│  │                  ▼                                                    │                         │  │
│  │   ┌─────────────────────────────┐                                     │                         │  │
│  │   │ STEP 6: CALL UPSTREAM TOOL  │                                     │                         │  │
│  │   │                             │                                     │                         │  │
│  │   │ mcpClient.CallTool(request) │                                     │                         │  │
│  │   │                             │                                     │                         │  │
│  │   │ → Upstream executes tool    │                                     │                         │  │
│  │   │ → Returns result            │                                     │                         │  │
│  │   └──────────────┬──────────────┘                                     │                         │  │
│  │                  │                                                    │                         │  │
│  │                  │                                                    │                         │  │
│  └──────────────────┼────────────────────────────────────────────────────┼─────────────────────────┘  │
│                     │                                                    │                            │
│                     ▼                                                    ▼                            │
│            ┌────────────────┐                                 ┌────────────────┐                      │
│            │ SUCCESS RESULT │                                 │ ERROR RESPONSE │                      │
│            └────────┬───────┘                                 └────────┬───────┘                      │
│                     │                                                  │                              │
└─────────────────────┼──────────────────────────────────────────────────┼──────────────────────────────┘
                      │                                                  │
                      │              ┌───────────────────────────────────┘
                      │              │
                      │              ▼
                      │   ┌─────────────────────────────────────────────────────────────────────────────┐
                      │   │                    ORCHESTRATOR: INTERCEPT ERROR                            │
                      │   │                    orchestrator/src/server/interceptor.ts                   │
                      │   │                                                                             │
                      │   │   ┌───────────────────────────────────────────────────────────────────────┐ │
                      │   │   │  Is this a "Method not found" error? (code: -32601)                   │ │
                      │   │   │                                                                       │ │
                      │   │   │  if (error.code === -32601) → TRIGGER DISCOVERY                       │ │
                      │   │   └───────────────────────────────────────────────────────────────────────┘ │
                      │   │                              │                                              │
                      │   │                              ▼                                              │
                      │   │   ┌───────────────────────────────────────────────────────────────────────┐ │
                      │   │   │                       DISCOVERY PIPELINE                              │ │
                      │   │   │                       orchestrator/src/discovery/index.ts             │ │
                      │   │   │                       resolveMissingTool(userId, query)               │ │
                      │   │   │                                                                       │ │
                      │   │   │  See Section 11.2 for full discovery flow...                         │ │
                      │   │   │                                                                       │ │
                      │   │   │  Result: { resolved: true/false, manualMode: true/false, ... }        │ │
                      │   │   └───────────────────────────────────────────────────────────────────────┘ │
                      │   │                              │                                              │
                      │   │              ┌───────────────┼───────────────┐                              │
                      │   │              ▼               ▼               ▼                              │
                      │   │   ┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐                │
                      │   │   │ RESOLVED: true   │ │ MANUAL MODE  │ │ NOT RESOLVED     │                │
                      │   │   │                  │ │              │ │                  │                │
                      │   │   │ Tool installed!  │ │ Waiting for  │ │ No tool found    │                │
                      │   │   │ RETRY original   │ │ user input   │ │ Return error     │                │
                      │   │   │ request          │ │              │ │ to AI agent      │                │
                      │   │   └──────────────────┘ └──────────────┘ └──────────────────┘                │
                      │   │                                                                             │
                      │   └─────────────────────────────────────────────────────────────────────────────┘
                      │
                      ▼
           ┌─────────────────────┐
           │ RESPONSE TO AI AGENT│
           │                     │
           │ Success OR Error    │
           └─────────────────────┘
```

---

### 11.2 The Discovery Pipeline (When Tool is Missing)

When the AI agent requests a tool that doesn't exist in the user's Jungle, the Discovery system kicks in:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    DISCOVERY PIPELINE (Epic 4)                                      │
│                                    orchestrator/src/discovery/                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘

  INPUT: User query "weather forecast" (extracted from the failed tool call)
         User ID: "user-12345"

                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP D1: QUERY EXPANSION (HyDE Technique)                                                           │
│ orchestrator/src/discovery/search/queryExpansion.ts                                                 │
│                                                                                                     │
│ WHY: "weather forecast" is vague. We ask an LLM to describe what an ideal tool would look like.     │
│                                                                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ expandQuery(userQuery: string): Promise<string>                                                 │ │
│ │                                                                                                 │ │
│ │ Input: "weather forecast"                                                                       │ │
│ │                                                                                                 │ │
│ │ LLM Prompt (GPT-4o-mini):                                                                       │ │
│ │   "You are a tool discovery assistant. Given a user's query about what they want to             │ │
│ │    accomplish, generate an ideal tool description. Focus on: functionality, input/output,       │ │
│ │    common use cases. Output ONLY the description, 2-4 sentences."                               │ │
│ │                                                                                                 │ │
│ │ Output: "A comprehensive weather forecasting API that provides current weather conditions,      │ │
│ │          hourly and daily forecasts, severe weather alerts, and historical weather data.        │ │
│ │          Supports lookups by city name, coordinates, and postal code. Returns temperature,      │ │
│ │          humidity, precipitation, wind speed, and UV index."                                    │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP D2: GENERATE EMBEDDING                                                                         │
│ orchestrator/src/discovery/search/embedding.ts                                                      │
│                                                                                                     │
│ WHY: Convert text to a vector so we can do semantic similarity search.                              │
│                                                                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ generateEmbedding(text: string): Promise<number[]>                                              │ │
│ │                                                                                                 │ │
│ │ Input: "A comprehensive weather forecasting API..."                                             │ │
│ │                                                                                                 │ │
│ │ OpenAI API: text-embedding-3-small                                                              │ │
│ │                                                                                                 │ │
│ │ Output: [0.023, -0.041, 0.089, -0.012, ... ] (1536 dimensions)                                  │ │
│ │                                                                                                 │ │
│ │ 🔌 INTEGRATION POINT #3: Replace with any embedding provider (Voyage AI, Cohere, local model)   │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP D3: VECTOR SEARCH IN SUPABASE                                                                  │
│ orchestrator/src/discovery/search/vectorStore.ts                                                    │
│                                                                                                     │
│ WHY: Find tools in our database whose descriptions are semantically similar to what user wants.     │
│                                                                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ findSimilarTools(embedding: number[]): Promise<ToolWithScore[]>                                 │ │
│ │                                                                                                 │ │
│ │ Supabase RPC call:                                                                              │ │
│ │   supabase.rpc('match_tools_orchestrator', {                                                    │ │
│ │     query_embedding: [0.023, -0.041, ...],                                                      │ │
│ │     match_threshold: 0.5,    // Minimum 50% similarity                                          │ │
│ │     match_count: 10          // Top 10 results                                                  │ │
│ │   })                                                                                            │ │
│ │                                                                                                 │ │
│ │ SQL Function (using pgvector cosine distance):                                                  │ │
│ │   SELECT *, 1 - (embedding <=> query_embedding) AS similarity                                   │ │
│ │   FROM tools t                                                                                  │ │
│ │   JOIN tool_embeddings_orchestrator e ON t.id = e.tool_id                                       │ │
│ │   WHERE similarity > 0.5                                                                        │ │
│ │   ORDER BY similarity DESC                                                                      │ │
│ │   LIMIT 10;                                                                                     │ │
│ │                                                                                                 │ │
│ │ Output:                                                                                         │ │
│ │   [                                                                                             │ │
│ │     { id: "uuid-1", name: "Weather API Pro", similarity: 0.91, price_per_call: 0.005, ...},     │ │
│ │     { id: "uuid-2", name: "Climate Data Svc", similarity: 0.78, price_per_call: 0.001, ...},    │ │
│ │     { id: "uuid-3", name: "Storm Tracker", similarity: 0.65, price_per_call: 0.010, ...},       │ │
│ │   ]                                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                         3 tools found with similarity > 50%
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP D4: APPLY USER FILTERS                                                                         │
│ orchestrator/src/discovery/selection/filters.ts                                                     │
│                                                                                                     │
│ WHY: Respect the user's budget and quality constraints.                                             │
│                                                                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ First, get user preferences from Supabase:                                                      │ │
│ │                                                                                                 │ │
│ │ getUserPreferences(userId): Promise<UserPreferences>                                            │ │
│ │                                                                                                 │ │
│ │ User "user-12345" preferences (from user_preferences_orchestrator table):                       │ │
│ │   {                                                                                             │ │
│ │     discovery_mode: "auto",                                                                     │ │
│ │     auto_install_strategy: "balanced",                                                          │ │
│ │     max_price_cap: 0.008,        // Max $0.008 per call                                         │ │
│ │     min_rating_threshold: 3.5    // Min 3.5 stars                                               │ │
│ │   }                                                                                             │ │
│ │                                                                                                 │ │
│ │ Then filter tools:                                                                              │ │
│ │                                                                                                 │ │
│ │ filterTools(tools, preferences):                                                                │ │
│ │   • Weather API Pro:  price=0.005 ✓, rating=4.5 ✓  → KEEP                                       │ │
│ │   • Climate Data Svc: price=0.001 ✓, rating=3.2 ✗  → REMOVE (rating too low)                    │ │
│ │   • Storm Tracker:    price=0.010 ✗, rating=4.8    → REMOVE (too expensive)                     │ │
│ │                                                                                                 │ │
│ │ Result: 1 tool passes filters                                                                   │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                    1 tool passes filters
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP D5: RANK REMAINING TOOLS                                                                       │
│ orchestrator/src/discovery/selection/ranking.ts                                                     │
│                                                                                                     │
│ WHY: If multiple tools pass, pick the best one based on user's strategy.                            │
│                                                                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ rankTools(tools, strategy: "balanced"):                                                         │ │
│ │                                                                                                 │ │
│ │ Strategies:                                                                                     │ │
│ │   • "cheapest": Sort by price ascending                                                         │ │
│ │   • "rating": Sort by rating descending                                                         │ │
│ │   • "balanced": score = (rating/5 × 0.6) + ((1 - price/0.01) × 0.4)                             │ │
│ │                                                                                                 │ │
│ │ Weather API Pro:                                                                                │ │
│ │   balanced_score = (4.5/5 × 0.6) + ((1 - 0.005/0.01) × 0.4)                                     │ │
│ │                  = 0.54 + 0.20 = 0.74                                                           │ │
│ │                                                                                                 │ │
│ │ Result: Weather API Pro is the top-ranked tool                                                  │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP D6: MODE DECISION                                                                              │
│ orchestrator/src/discovery/selection/index.ts → selectBestTool()                                    │
│                                                                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │                        ┌─────────────────────────────────────┐                                  │ │
│ │                        │ What is discovery_mode?             │                                  │ │
│ │                        └───────────────┬─────────────────────┘                                  │ │
│ │                                        │                                                        │ │
│ │                    ┌───────────────────┼───────────────────┐                                    │ │
│ │                    ▼                                       ▼                                    │ │
│ │         ┌─────────────────────┐                 ┌─────────────────────┐                         │ │
│ │         │   MODE: "auto"      │                 │   MODE: "manual"    │                         │ │
│ │         │                     │                 │                     │                         │ │
│ │         │ → Proceed to        │                 │ → Store candidates  │                         │ │
│ │         │   install           │                 │   in pending state  │                         │ │
│ │         │   automatically     │                 │                     │                         │ │
│ │         │                     │                 │ → Prompt user to    │                         │ │
│ │         │ See STEP D7         │                 │   select via        │                         │ │
│ │         │                     │                 │   Admin API         │                         │ │
│ │         └─────────────────────┘                 │                     │                         │ │
│ │                                                 │ → Return:           │                         │ │
│ │                                                 │   { manualMode:true │                         │ │
│ │                                                 │     requestId:"..." │                         │ │
│ │                                                 │   }                 │                         │ │
│ │                                                 │                     │                         │ │
│ │                                                 │ User calls:         │                         │ │
│ │                                                 │ POST /admin/        │                         │ │
│ │                                                 │   select-tool       │                         │ │
│ │                                                 │ Then → STEP D7      │                         │ │
│ │                                                 └─────────────────────┘                         │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                          MODE: "auto" → proceed to install
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP D7: INSTALL TOOL                                                                               │
│ orchestrator/src/discovery/provisioning/installer.ts                                                │
│                                                                                                     │
│ WHY: Save this tool subscription so user can use it in future requests.                             │
│                                                                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ installTool(userId, tool):                                                                      │ │
│ │                                                                                                 │ │
│ │ 1. Generate canonical name:                                                                     │ │
│ │    "Weather_API_Pro__a1b2c3d4" (name + first 8 chars of UUID)                                   │ │
│ │                                                                                                 │ │
│ │ 2. Save to Supabase (user_tools_orchestrator table):                                            │ │
│ │    INSERT INTO user_tools_orchestrator (user_id, tool_id, canonical_name, is_active)            │ │
│ │    VALUES ('user-12345', 'uuid-1', 'Weather_API_Pro__a1b2c3d4', true)                            │ │
│ │    ON CONFLICT (user_id, tool_id) DO UPDATE SET is_active = true;                               │ │
│ │                                                                                                 │ │
│ │ 3. Refresh runtime (notify any callbacks):                                                      │ │
│ │    refreshRuntime(userId, toolId) → calls registered callbacks                                  │ │
│ │                                                                                                 │ │
│ │ 🔌 INTEGRATION POINT #4: Lambda Provisioning Hook                                               │ │
│ │    This is where you would:                                                                     │ │
│ │    • Check tool's deployment_type (PUBLIC/PRIVATE)                                              │ │
│ │    • If PRIVATE → spin up Lambda for this user                                                  │ │
│ │    • Store Lambda ARN/URL in the database                                                       │ │
│ │                                                                                                 │ │
│ │ 4. Return success:                                                                              │ │
│ │    { success: true, canonicalName: "Weather_API_Pro__a1b2c3d4", isNewInstall: true }            │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                              Tool installed successfully!
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP D8: RETRY ORIGINAL REQUEST                                                                     │
│ orchestrator/src/server/interceptor.ts                                                              │
│                                                                                                     │
│ WHY: Now that the tool is installed, try the original request again.                                │
│                                                                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ processWithDiscovery():                                                                         │ │
│ │                                                                                                 │ │
│ │ if (result.resolved && result.installed) {                                                      │ │
│ │   // Increment retry counter to prevent infinite loops                                          │ │
│ │   retryContext.retryCount++;                                                                    │ │
│ │                                                                                                 │ │
│ │   // Re-dispatch the exact same original request                                                │ │
│ │   return processWithDiscovery(originalRequest, userId, executeRequest);                         │ │
│ │ }                                                                                               │ │
│ │                                                                                                 │ │
│ │ This time:                                                                                      │ │
│ │   1. Request goes to Jungle again                                                               │ │
│ │   2. Jungle now knows about "Weather_API_Pro__a1b2c3d4"                                          │ │
│ │   3. Jungle connects to the tool's endpoint_url                                                 │ │
│ │   4. Success! Weather data returned to AI agent                                                 │ │
│ │                                                                                                 │ │
│ │ 🔌 INTEGRATION POINT #5: Lambda Invocation                                                      │ │
│ │    When Jungle tries to connect, check if tool has a Lambda endpoint:                           │ │
│ │    • If endpoint_url starts with lambda:// → invoke Lambda function                             │ │
│ │    • Pass the tool arguments to Lambda                                                          │ │
│ │    • Return Lambda response                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
                              ┌─────────────────────────┐
                              │   SUCCESS RESPONSE      │
                              │   to AI Agent           │
                              │                         │
                              │   { weather: "sunny",   │
                              │     temp: 72,           │
                              │     humidity: 45% }     │
                              └─────────────────────────┘
```

---

### 11.3 All Possible Paths Summary

Here's every possible path through the system:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                            ALL POSSIBLE REQUEST PATHS                                               │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                     │
│  PATH A: HAPPY PATH (Tool Already Exists)                                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                                           │
│  AI → Orchestrator → Jungle → Tool Found → Upstream Server → Response                               │
│  Duration: ~100-500ms                                                                               │
│                                                                                                     │
│  PATH B: AUTO DISCOVERY (Tool Missing, Auto Mode)                                                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                                   │
│  AI → Orchestrator → Jungle → NOT FOUND → Discovery Pipeline →                                      │
│  Search Supabase → Filter → Rank → Auto Install → Retry → Success                                   │
│  Duration: ~2-5 seconds (includes LLM calls)                                                        │
│                                                                                                     │
│  PATH C: MANUAL DISCOVERY (Tool Missing, Manual Mode)                                               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                                  │
│  AI → Orchestrator → Jungle → NOT FOUND → Discovery Pipeline →                                      │
│  Search → Filter → Rank → Store Pending → Prompt User → WAIT →                                      │
│  Admin API Call → Install → Retry → Success                                                         │
│  Duration: Minutes to hours (waiting for human)                                                     │
│                                                                                                     │
│  PATH D: NO MATCH FOUND                                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━                                                                          │
│  AI → Orchestrator → Jungle → NOT FOUND → Discovery Pipeline →                                      │
│  Search → 0 results → Return Error                                                                  │
│  Duration: ~1-2 seconds                                                                             │
│                                                                                                     │
│  PATH E: ALL FILTERED OUT                                                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━                                                                         │
│  AI → Orchestrator → Jungle → NOT FOUND → Discovery Pipeline →                                      │
│  Search → 5 results → Filter → 0 pass → Return Error                                                │
│  Duration: ~1-2 seconds                                                                             │
│                                                                                                     │
│  PATH F: PER-USER PROVISIONING (New User)                                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                                           │
│  AI → Orchestrator → No Jungle for user → Provision Docker/K8s/Lambda →                             │
│  Wait for healthy → Store mapping → Forward → Tool call → Success                                   │
│  Duration: ~5-30 seconds (container startup)                                                        │
│                                                                                                     │
│  PATH G: CODEMODE EXECUTION                                                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━                                                                        │
│  AI → CodeMode → Run code in sandbox → Code calls tools →                                           │
│  Each tool call: CodeMode → Jungle → Upstream → Back to sandbox                                     │
│  Duration: Depends on code complexity                                                               │
│                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 11.4 Complete Code Path with File Locations

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                        EXACT CODE EXECUTION PATH (with file:line references)                        │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                     │
│  1. REQUEST ARRIVES                                                                                 │
│     ├── orchestrator/src/server/http.ts                                                             │
│     │   └── app.post('/mcp', ...) [line 56]                                                         │
│     │                                                                                               │
│  2. ROUTE RESOLUTION                                                                                │
│     ├── orchestrator/src/routing/router.ts                                                          │
│     │   └── resolveJungleEndpoint() [line 9]                                                        │
│     │                                                                                               │
│  3. PROVISIONING (if per_user + new)                                                                │
│     ├── orchestrator/src/provisioning/types.ts                                                      │
│     │   └── getProvisioner() [line 21]                                                              │
│     ├── orchestrator/src/provisioning/docker.ts                                                     │
│     │   └── DockerProvisioner.provision() [line 28]                                                 │
│     │                                                                                               │
│     │   🔌 INTEGRATION POINT #1: Add LambdaProvisioner here                                         │
│     │      File: orchestrator/src/provisioning/lambda.ts (CREATE)                                   │
│     │      Register in: orchestrator/src/provisioning/types.ts                                      │
│     │                                                                                               │
│  4. FORWARD TO JUNGLE                                                                               │
│     ├── orchestrator/src/server/upstream.ts                                                         │
│     │   └── postToJungle() [line 84]                                                                │
│     │                                                                                               │
│  5. JUNGLE RECEIVES                                                                                 │
│     ├── internal/api/server.go                                                                      │
│     │   └── setupRouter() → /mcp endpoint [line 181]                                                │
│     │                                                                                               │
│  6. MCP PROXY HANDLER                                                                               │
│     ├── internal/service/mcp/proxy.go                                                               │
│     │   └── MCPProxyToolCallHandler() [line 17]                                                     │
│     │                                                                                               │
│  7. CONNECT TO UPSTREAM                                                                             │
│     ├── internal/service/mcp/util.go                                                                │
│     │   └── newMcpServerSession() [line 279]                                                        │
│     │                                                                                               │
│     │   🔌 INTEGRATION POINT #2: Add Lambda transport here                                          │
│     │      Add case "lambda": return createLambdaMcpServerConn(ctx, s)                              │
│     │                                                                                               │
│  8. ERROR: METHOD NOT FOUND (if tool missing)                                                       │
│     ├── Response flows back to Orchestrator                                                         │
│     │                                                                                               │
│  9. INTERCEPT ERROR                                                                                 │
│     ├── orchestrator/src/server/interceptor.ts                                                      │
│     │   └── processWithDiscovery() [line 462]                                                       │
│     │   └── isMethodNotFoundError() [line 119]                                                      │
│     │                                                                                               │
│  10. DISCOVERY PIPELINE                                                                             │
│     ├── orchestrator/src/discovery/index.ts                                                         │
│     │   └── resolveMissingTool() [line 222]                                                         │
│     │                                                                                               │
│  11. QUERY EXPANSION                                                                                │
│     ├── orchestrator/src/discovery/search/queryExpansion.ts                                         │
│     │   └── expandQuery() [line 85]                                                                 │
│     │                                                                                               │
│     │   🔌 INTEGRATION POINT #3: Replace embedding/expansion providers                              │
│     │      Modify: getQueryExpansionConfig() for different LLM                                      │
│     │                                                                                               │
│  12. EMBEDDING GENERATION                                                                           │
│     ├── orchestrator/src/discovery/search/embedding.ts                                              │
│     │   └── generateEmbedding() [line 50]                                                           │
│     │                                                                                               │
│  13. VECTOR SEARCH                                                                                  │
│     ├── orchestrator/src/discovery/search/vectorStore.ts                                            │
│     │   └── findSimilarTools() [line 75]                                                            │
│     │                                                                                               │
│  14. GET USER PREFERENCES                                                                           │
│     ├── orchestrator/src/discovery/preferences/store.ts                                             │
│     │   └── getUserPreferences() [line 30]                                                          │
│     │                                                                                               │
│  15. FILTER & RANK                                                                                  │
│     ├── orchestrator/src/discovery/selection/filters.ts                                             │
│     │   └── filterTools() [line 65]                                                                 │
│     ├── orchestrator/src/discovery/selection/ranking.ts                                             │
│     │   └── rankTools() [line 45]                                                                   │
│     │                                                                                               │
│  16. MODE DECISION                                                                                  │
│     ├── orchestrator/src/discovery/selection/index.ts                                               │
│     │   └── selectBestTool() [line 90]                                                              │
│     │                                                                                               │
│  17. INSTALL TOOL                                                                                   │
│     ├── orchestrator/src/discovery/provisioning/installer.ts                                        │
│     │   └── installTool() [line 222]                                                                │
│     │   └── persistToolConfig() [line 88]                                                           │
│     │   └── refreshRuntime() [line 185]                                                             │
│     │                                                                                               │
│     │   🔌 INTEGRATION POINT #4: Lambda provisioning hook                                           │
│     │      In installTool(), after persistToolConfig():                                             │
│     │      - Check tool.deployment_type                                                             │
│     │      - If PRIVATE: await lambdaProvisioner.provisionForUser(userId, tool)                     │
│     │      - Store Lambda ARN in database                                                           │
│     │                                                                                               │
│  18. RETRY ORIGINAL REQUEST                                                                         │
│     ├── orchestrator/src/server/interceptor.ts                                                      │
│     │   └── processWithDiscovery() recursion [line 547]                                             │
│     │                                                                                               │
│  19. SUCCESS!                                                                                       │
│     ├── Response flows back: Jungle → Orchestrator → AI Agent                                       │
│                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 11.5 Lambda Integration Points (Detailed)

Here are the **exact locations** where Lambda infrastructure should connect:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           LAMBDA INTEGRATION GUIDE                                                  │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                     │
│  🔌 INTEGRATION POINT #1: User Instance Provisioning                                                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                                │
│                                                                                                     │
│  WHEN: A new user needs their own isolated Jungle instance                                          │
│  WHY: Per-user isolation using Lambda instead of Docker/K8s                                         │
│                                                                                                     │
│  FILE: orchestrator/src/provisioning/lambda.ts (CREATE NEW)                                         │
│                                                                                                     │
│  ```typescript                                                                                      │
│  import { Provisioner } from './types.js';                                                          │
│  import { LambdaClient, CreateFunctionCommand, InvokeCommand } from '@aws-sdk/client-lambda';       │
│                                                                                                     │
│  export class LambdaProvisioner implements Provisioner {                                            │
│    private client: LambdaClient;                                                                    │
│                                                                                                     │
│    constructor(config: { region: string; s3Bucket: string; roleArn: string }) {                     │
│      this.client = new LambdaClient({ region: config.region });                                     │
│      this.s3Bucket = config.s3Bucket;                                                               │
│      this.roleArn = config.roleArn;                                                                 │
│    }                                                                                                │
│                                                                                                     │
│    async provision(userId: string): Promise<{ baseUrl: string }> {                                  │
│      const functionName = `jungle-${userId}`;                                                       │
│                                                                                                     │
│      // Create Lambda function for this user                                                        │
│      await this.client.send(new CreateFunctionCommand({                                             │
│        FunctionName: functionName,                                                                  │
│        Runtime: 'nodejs20.x',                                                                       │
│        Handler: 'index.handler',                                                                    │
│        Role: this.roleArn,                                                                          │
│        Code: {                                                                                      │
│          S3Bucket: this.s3Bucket,                                                                   │
│          S3Key: 'jungle-lambda-package.zip',                                                        │
│        },                                                                                           │
│        Environment: {                                                                               │
│          Variables: {                                                                               │
│            USER_ID: userId,                                                                         │
│            SUPABASE_URL: process.env.SUPABASE_URL,                                                  │
│            SUPABASE_KEY: process.env.SUPABASE_KEY,                                                  │
│          },                                                                                         │
│        },                                                                                           │
│        Timeout: 30,                                                                                 │
│        MemorySize: 512,                                                                             │
│      }));                                                                                           │
│                                                                                                     │
│      // Create API Gateway or Function URL                                                          │
│      const apiUrl = await this.createFunctionUrl(functionName);                                     │
│                                                                                                     │
│      return { baseUrl: apiUrl };                                                                    │
│    }                                                                                                │
│                                                                                                     │
│    async stop(userId: string): Promise<void> {                                                      │
│      await this.client.send(new DeleteFunctionCommand({                                             │
│        FunctionName: `jungle-${userId}`,                                                            │
│      }));                                                                                           │
│    }                                                                                                │
│                                                                                                     │
│    async isHealthy(baseUrl: string): Promise<boolean> {                                             │
│      const response = await fetch(`${baseUrl}/health`);                                             │
│      return response.ok;                                                                            │
│    }                                                                                                │
│  }                                                                                                  │
│  ```                                                                                                │
│                                                                                                     │
│  REGISTER IN: orchestrator/src/provisioning/types.ts                                                │
│                                                                                                     │
│  ```typescript                                                                                      │
│  export async function getProvisioner(): Promise<Provisioner> {                                     │
│    const cfg = loadConfig(process.env);                                                             │
│    switch (cfg.provisioner) {                                                                       │
│      case 'lambda':                                                                                 │
│        const { LambdaProvisioner } = await import('./lambda.js');                                   │
│        return new LambdaProvisioner({                                                               │
│          region: cfg.awsRegion,                                                                     │
│          s3Bucket: cfg.lambdaS3Bucket,                                                              │
│          roleArn: cfg.lambdaRoleArn,                                                                │
│        });                                                                                          │
│      // ... existing cases ...                                                                      │
│    }                                                                                                │
│  }                                                                                                  │
│  ```                                                                                                │
│                                                                                                     │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                     │
│  🔌 INTEGRATION POINT #2: MCP Tool Transport                                                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                                        │
│                                                                                                     │
│  WHEN: An MCP tool is hosted on Lambda (not a traditional HTTP endpoint)                            │
│  WHY: Some tools run as serverless functions                                                        │
│                                                                                                     │
│  FILE: internal/service/mcp/util.go                                                                 │
│                                                                                                     │
│  ```go                                                                                              │
│  // Add new transport type                                                                          │
│  // pkg/types/mcp_server.go                                                                         │
│  const TransportLambda McpServerTransport = "lambda"                                                │
│                                                                                                     │
│  // Add Lambda config                                                                               │
│  // internal/model/mcp_server.go                                                                    │
│  type LambdaConfig struct {                                                                         │
│      FunctionArn string `json:"function_arn"`                                                       │
│      Region      string `json:"region"`                                                             │
│  }                                                                                                  │
│                                                                                                     │
│  // Add Lambda connection                                                                           │
│  // internal/service/mcp/util.go                                                                    │
│  func newMcpServerSession(ctx context.Context, s *model.McpServer) (*client.Client, error) {        │
│      switch s.Transport {                                                                           │
│      case types.TransportLambda:                                                                    │
│          return createLambdaMcpServerConn(ctx, s)                                                   │
│      // ... existing cases ...                                                                      │
│      }                                                                                              │
│  }                                                                                                  │
│                                                                                                     │
│  func createLambdaMcpServerConn(ctx context.Context, s *model.McpServer) (*client.Client, error) {  │
│      conf, err := s.GetLambdaConfig()                                                               │
│      if err != nil {                                                                                │
│          return nil, err                                                                            │
│      }                                                                                              │
│                                                                                                     │
│      // Create Lambda-backed MCP client                                                             │
│      // This would invoke Lambda for each tool call                                                 │
│      return client.NewLambdaMCPClient(conf.FunctionArn, conf.Region)                                │
│  }                                                                                                  │
│  ```                                                                                                │
│                                                                                                     │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                     │
│  🔌 INTEGRATION POINT #3: Tool Installation → Lambda Spin-up                                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                        │
│                                                                                                     │
│  WHEN: User subscribes to a PRIVATE tool that needs its own Lambda                                  │
│  WHY: Private tools require isolated execution environment per user                                 │
│                                                                                                     │
│  FILE: orchestrator/src/discovery/provisioning/installer.ts                                         │
│                                                                                                     │
│  ```typescript                                                                                      │
│  // Modify installTool() function                                                                   │
│                                                                                                     │
│  export async function installTool(                                                                 │
│    userId: string,                                                                                  │
│    tool: InstallableTool                                                                            │
│  ): Promise<InstallResult> {                                                                        │
│    // ... existing validation ...                                                                   │
│                                                                                                     │
│    // Persist to database                                                                           │
│    const record = await persistToolConfig(userId, tool);                                            │
│                                                                                                     │
│    // 🔌 NEW: Check if tool needs Lambda provisioning                                               │
│    const toolMetadata = await getToolMetadata(tool.id);                                             │
│    if (toolMetadata.deployment_type === 'PRIVATE') {                                                │
│      // Spin up Lambda for this user+tool                                                           │
│      const lambdaResult = await provisionToolLambda(userId, tool, toolMetadata);                    │
│                                                                                                     │
│      // Store Lambda endpoint for this user's tool                                                  │
│      await storeUserLambdaEndpoint(userId, tool.id, lambdaResult);                                  │
│    }                                                                                                │
│                                                                                                     │
│    // Refresh runtime                                                                               │
│    await refreshRuntime(userId, tool.id);                                                           │
│                                                                                                     │
│    return { success: true, ... };                                                                   │
│  }                                                                                                  │
│                                                                                                     │
│  // 🔌 NEW: Lambda provisioning for tools                                                           │
│  async function provisionToolLambda(                                                                │
│    userId: string,                                                                                  │
│    tool: InstallableTool,                                                                           │
│    metadata: ToolMetadata                                                                           │
│  ): Promise<{ functionArn: string; endpointUrl: string }> {                                         │
│    const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });                       │
│                                                                                                     │
│    const functionName = `tool-${tool.id.slice(0,8)}-${userId.slice(0,8)}`;                          │
│                                                                                                     │
│    // Create Lambda from S3 package                                                                 │
│    await lambdaClient.send(new CreateFunctionCommand({                                              │
│      FunctionName: functionName,                                                                    │
│      Runtime: 'nodejs20.x',                                                                         │
│      Code: {                                                                                        │
│        S3Bucket: metadata.s3_bucket,                                                                │
│        S3Key: metadata.s3_package_key,                                                              │
│      },                                                                                             │
│      Handler: 'index.handler',                                                                      │
│      Role: process.env.LAMBDA_EXECUTION_ROLE,                                                       │
│      Timeout: metadata.timeout_ms / 1000,                                                           │
│      MemorySize: metadata.memory_mb,                                                                │
│    }));                                                                                             │
│                                                                                                     │
│    // Create function URL                                                                           │
│    const urlResult = await lambdaClient.send(new CreateFunctionUrlConfigCommand({                   │
│      FunctionName: functionName,                                                                    │
│      AuthType: 'AWS_IAM',                                                                           │
│    }));                                                                                             │
│                                                                                                     │
│    return {                                                                                         │
│      functionArn: `arn:aws:lambda:${region}:${account}:function:${functionName}`,                   │
│      endpointUrl: urlResult.FunctionUrl,                                                            │
│    };                                                                                               │
│  }                                                                                                  │
│  ```                                                                                                │
│                                                                                                     │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                     │
│  🔌 INTEGRATION POINT #4: Tool Invocation via Lambda                                                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                                 │
│                                                                                                     │
│  WHEN: A tool call needs to be routed to a Lambda function                                          │
│  WHY: Tool is hosted on Lambda, not traditional HTTP                                                │
│                                                                                                     │
│  FILE: internal/service/mcp/proxy.go                                                                │
│                                                                                                     │
│  ```go                                                                                              │
│  func (m *MCPService) MCPProxyToolCallHandler(...) (*mcp.CallToolResult, error) {                   │
│      // ... existing code to parse tool name and get server ...                                     │
│                                                                                                     │
│      // 🔌 NEW: Check if this tool should be routed to Lambda                                       │
│      if server.Transport == types.TransportLambda {                                                 │
│          return m.invokeLambdaTool(ctx, server, request)                                            │
│      }                                                                                              │
│                                                                                                     │
│      // ... existing upstream connection code ...                                                   │
│  }                                                                                                  │
│                                                                                                     │
│  func (m *MCPService) invokeLambdaTool(                                                             │
│      ctx context.Context,                                                                           │
│      server *model.McpServer,                                                                       │
│      request mcp.CallToolRequest,                                                                   │
│  ) (*mcp.CallToolResult, error) {                                                                   │
│      conf, _ := server.GetLambdaConfig()                                                            │
│                                                                                                     │
│      // Create Lambda client                                                                        │
│      client := lambda.NewFromConfig(awsConfig)                                                      │
│                                                                                                     │
│      // Serialize MCP request                                                                       │
│      payload, _ := json.Marshal(map[string]any{                                                     │
│          "method": "tools/call",                                                                    │
│          "params": request.Params,                                                                  │
│      })                                                                                             │
│                                                                                                     │
│      // Invoke Lambda                                                                               │
│      result, err := client.Invoke(ctx, &lambda.InvokeInput{                                         │
│          FunctionName: aws.String(conf.FunctionArn),                                                │
│          Payload:      payload,                                                                     │
│      })                                                                                             │
│                                                                                                     │
│      // Parse response                                                                              │
│      var mcpResult mcp.CallToolResult                                                               │
│      json.Unmarshal(result.Payload, &mcpResult)                                                     │
│                                                                                                     │
│      return &mcpResult, nil                                                                         │
│  }                                                                                                  │
│  ```                                                                                                │
│                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 11.6 Database Schema Extensions for Lambda

```sql
-- Add to Supabase for Lambda support

-- Tool metadata for Lambda deployment
CREATE TABLE tool_deployments_orchestrator (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id          UUID REFERENCES tools(id),
  deployment_type  TEXT CHECK (deployment_type IN ('PUBLIC', 'PRIVATE', 'EXTERNAL')),
  
  -- S3 location of MCP package
  s3_bucket        TEXT,
  s3_package_key   TEXT,
  
  -- Lambda configuration
  runtime          TEXT DEFAULT 'nodejs20.x',
  handler          TEXT DEFAULT 'index.handler',
  timeout_seconds  INT DEFAULT 30,
  memory_mb        INT DEFAULT 512,
  
  -- For PUBLIC tools: shared Lambda ARN
  shared_lambda_arn TEXT,
  
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Track per-user Lambda instances
CREATE TABLE user_lambda_instances_orchestrator (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  tool_id         UUID REFERENCES tools(id),
  
  -- Lambda details
  function_name   TEXT NOT NULL,
  function_arn    TEXT NOT NULL,
  function_url    TEXT,
  
  -- Status
  status          TEXT CHECK (status IN ('CREATING', 'ACTIVE', 'FAILED', 'DELETING', 'DELETED')),
  
  -- Lifecycle
  created_at      TIMESTAMPTZ DEFAULT now(),
  last_invoked_at TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  
  UNIQUE (user_id, tool_id)
);
```

---

### 11.7 Visual: Complete System with Lambda

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           COMPLETE SYSTEM WITH LAMBDA INTEGRATION                                   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘

                                         ┌─────────────┐
                                         │  AI AGENT   │
                                         └──────┬──────┘
                                                │
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    ORCHESTRATOR                                                       │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                                    ROUTING LAYER                                               │  │
│  │                                                                                                │  │
│  │            ┌─────────────────────────────────────────────────────────────────┐                 │  │
│  │            │                   Which mode?                                   │                 │  │
│  │            └────────────────────────┬────────────────────────────────────────┘                 │  │
│  │                                     │                                                          │  │
│  │        ┌────────────────────────────┼────────────────────────────┐                             │  │
│  │        ▼                            ▼                            ▼                             │  │
│  │   ┌─────────┐                 ┌─────────┐                 ┌─────────────┐                      │  │
│  │   │ SHARED  │                 │ DOCKER  │                 │   LAMBDA    │                      │  │
│  │   │         │                 │         │                 │             │                      │  │
│  │   │ Single  │                 │ Per-user│                 │  Per-user   │                      │  │
│  │   │ Jungle  │                 │ Container                 │  Function   │                      │  │
│  │   └────┬────┘                 └────┬────┘                 └──────┬──────┘                      │  │
│  │        │                           │                             │                             │  │
│  └────────┼───────────────────────────┼─────────────────────────────┼─────────────────────────────┘  │
│           │                           │                             │                                │
│           │      ┌────────────────────┴────────────────────┐        │                                │
│           │      │         DISCOVERY LAYER                 │        │                                │
│           │      │                                         │        │                                │
│           │      │  When tool not found:                   │        │                                │
│           │      │  1. Search Supabase (vector)            │        │                                │
│           │      │  2. Filter & Rank                       │        │                                │
│           │      │  3. Install + Provision Lambda          │────────┘                                │
│           │      │                                         │                                         │
│           │      └─────────────────────────────────────────┘                                         │
└───────────┼─────────────────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                        JUNGLE LAYER                                                   │
│                                                                                                       │
│   ┌─────────────┐        ┌─────────────┐        ┌─────────────┐        ┌─────────────┐               │
│   │   Shared    │        │  User A's   │        │  User B's   │        │  User C's   │               │
│   │   Jungle    │        │   Jungle    │        │   Jungle    │        │   Jungle    │               │
│   │  (Docker)   │        │  (Docker)   │        │  (Lambda)   │        │  (Lambda)   │               │
│   └──────┬──────┘        └──────┬──────┘        └──────┬──────┘        └──────┬──────┘               │
│          │                      │                      │                      │                       │
│          └──────────────────────┼──────────────────────┼──────────────────────┘                       │
│                                 │                      │                                              │
│                    Tool Registry & Proxy               │                                              │
│                    (knows how to route to tools)       │                                              │
│                                 │                      │                                              │
└─────────────────────────────────┼──────────────────────┼──────────────────────────────────────────────┘
                                  │                      │
                                  ▼                      ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                        MCP TOOLS LAYER                                                │
│                                                                                                       │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│   │  PUBLIC TOOLS   │  │  PRIVATE TOOLS  │  │  EXTERNAL TOOLS │  │  LOCAL TOOLS    │                  │
│   │                 │  │  (User Lambda)  │  │                 │  │                 │                  │
│   │  Shared Lambda  │  │                 │  │  Third-party    │  │  stdio process  │                  │
│   │  One function   │  │  Per-user       │  │  HTTP APIs      │  │  on same host   │                  │
│   │  serves all     │  │  Lambda func    │  │                 │  │                 │                  │
│   │                 │  │                 │  │                 │  │                 │                  │
│   │  ┌───────────┐  │  │  ┌───────────┐  │  │  ┌───────────┐  │  │  ┌───────────┐  │                  │
│   │  │ Weather   │  │  │  │ User A's  │  │  │  │  GitHub   │  │  │  │ Postgres  │  │                  │
│   │  │ Lambda    │  │  │  │ Private   │  │  │  │   API     │  │  │  │  stdio    │  │                  │
│   │  │           │  │  │  │ DB Lambda │  │  │  │           │  │  │  │           │  │                  │
│   │  └───────────┘  │  │  └───────────┘  │  │  └───────────┘  │  │  └───────────┘  │                  │
│   │                 │  │                 │  │                 │  │                 │                  │
│   │  ┌───────────┐  │  │  ┌───────────┐  │  │  ┌───────────┐  │  │  ┌───────────┐  │                  │
│   │  │  Maps     │  │  │  │ User B's  │  │  │  │  Stripe   │  │  │  │ Filesystem│  │                  │
│   │  │ Lambda    │  │  │  │ Private   │  │  │  │   API     │  │  │  │  stdio    │  │                  │
│   │  │           │  │  │  │ CRM Lambda│  │  │  │           │  │  │  │           │  │                  │
│   │  └───────────┘  │  │  └───────────┘  │  │  └───────────┘  │  │  └───────────┘  │                  │
│   │                 │  │                 │  │                 │  │                 │                  │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│                                                                                                       │
│   S3 BUCKET                                                                                           │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────┐     │
│   │  /mcps/                                                                                     │     │
│   │    ├── weather-api/                                                                         │     │
│   │    │     └── package.zip        (Lambda deployment package)                                 │     │
│   │    ├── maps-api/                                                                            │     │
│   │    │     └── package.zip                                                                    │     │
│   │    └── private-db-tool/                                                                     │     │
│   │          └── package.zip                                                                    │     │
│   └─────────────────────────────────────────────────────────────────────────────────────────────┘     │
│                                                                                                       │
└───────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 11.8 Summary: What Connects Where

| Step | Action | Current Code | Lambda Integration Point |
|------|--------|--------------|--------------------------|
| 1 | User requests tool | `server/http.ts` | No change |
| 2 | Route to Jungle | `routing/router.ts` | Add `case 'lambda'` in provisioner |
| 3 | Jungle proxies | `mcp/proxy.go` | Add `case TransportLambda` |
| 4 | Connect upstream | `mcp/util.go` | Add `createLambdaMcpServerConn()` |
| 5 | Tool not found | `interceptor.ts` | No change |
| 6 | Discovery | `discovery/index.ts` | No change |
| 7 | Install tool | `provisioning/installer.ts` | Add Lambda provisioning call |
| 8 | Retry | `interceptor.ts` | No change |

---

## Appendix: Quick Reference

### Environment Variables

```bash
# Orchestrator
JUNGLE_URL=http://localhost:9000     # Jungle instance URL
PORT=8080                            # Orchestrator port
ROUTING_MODE=shared                  # shared | per_user
PROVISIONER=docker                   # none | docker | k8s
SUPABASE_URL=https://...             # For discovery
SUPABASE_KEY=...                     # Supabase anon key
OPENAI_API_KEY=sk-...                # For embeddings

# Jungle
PORT=9000                            # Jungle port
SERVER_MODE=development              # development | enterprise
DATABASE_URL=file:mcpjungle.db       # SQLite path
```

### File Locations

| What | Where |
|------|-------|
| Jungle entry | `main.go` |
| Orchestrator entry | `orchestrator/src/server/dev.ts` |
| Discovery logic | `orchestrator/src/discovery/` |
| CodeMode | `orchestrator/src/codemode/` |
| MCP proxy handler | `internal/service/mcp/proxy.go` |
| Tool models | `internal/model/` |

---

*Document Version: 2.0*  
*Last Updated: January 6, 2026*
