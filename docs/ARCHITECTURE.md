# MCPJungle Complete Architecture Documentation

> **Purpose**: This document provides comprehensive technical documentation for the entire MCPJungle codebase. It is designed to enable another AI agent or developer to understand, integrate with, or extend any part of the system—including connecting Lambda cluster provisioning or other infrastructure components.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Core Components](#3-core-components)
   - [MCPJungle Registry (Go)](#31-mcpjungle-registry-go)
   - [Orchestrator (TypeScript)](#32-orchestrator-typescript)
   - [CodeMode Standalone (TypeScript)](#33-codemode-standalone-typescript)
4. [Data Layer](#4-data-layer)
   - [Local SQLite Database](#41-local-sqlite-database-go-service)
   - [Supabase Cloud Database](#42-supabase-cloud-database-discovery)
5. [MCP Protocol Implementation](#5-mcp-protocol-implementation)
6. [Discovery System (Epic 4)](#6-discovery-system-epic-4)
7. [Routing & Provisioning](#7-routing--provisioning)
8. [CodeMode Execution Engine](#8-codemode-execution-engine)
9. [API Reference](#9-api-reference)
10. [Integration Points](#10-integration-points)
11. [Security Model](#11-security-model)
12. [Deployment](#12-deployment)
13. [Extension Guide](#13-extension-guide)

---

## 1. System Overview

**MCPJungle** is a multi-component platform for managing, discovering, and proxying Model Context Protocol (MCP) servers. It enables AI agents to:

1. **Register** upstream MCP servers (tools)
2. **Discover** tools dynamically using semantic search
3. **Proxy** MCP requests to the appropriate upstream server
4. **Execute** LLM-generated code that calls tools
5. **Route** requests to per-user or shared instances

### Key Technologies

| Component | Language | Framework | Purpose |
|-----------|----------|-----------|---------|
| Registry Server | Go | Gin | MCP proxy & HTTP API |
| Orchestrator | TypeScript | Express | Gateway, routing, discovery |
| CodeMode Standalone | TypeScript | isolated-vm | Sandboxed code execution |
| Database (local) | SQLite | GORM | Local tool/server registry |
| Database (cloud) | PostgreSQL | Supabase | Tool discovery, user prefs |

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    AI AGENT (Claude, GPT, etc.)                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              │ MCP Protocol (JSON-RPC 2.0)
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                 ORCHESTRATOR (TypeScript)                           │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │  HTTP Server    │ │  Discovery      │ │  Routing        │ │  CodeMode       │   │
│  │  /mcp endpoint  │ │  (Epic 4)       │ │  (Epic 3)       │ │  (Epic 3)       │   │
│  └────────┬────────┘ └────────┬────────┘ └────────┬────────┘ └────────┬────────┘   │
│           │                   │                   │                   │             │
│           │      ┌────────────┴───────────┐      │                   │             │
│           │      │  Supabase (Cloud)      │      │                   │             │
│           │      │  - tools table         │      │                   │             │
│           │      │  - embeddings          │      │                   │             │
│           │      │  - user_preferences    │      │                   │             │
│           │      │  - user_tools          │      │                   │             │
│           │      └────────────────────────┘      │                   │             │
│           │                                      │                   │             │
│           └──────────────────────────────────────┼───────────────────┘             │
└──────────────────────────────────────────────────┼─────────────────────────────────┘
                                                   │
                    ┌──────────────────────────────┼──────────────────────────────┐
                    │                              │                              │
                    ▼                              ▼                              ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐ ┌─────────────────────────────┐
│  SHARED JUNGLE INSTANCE     │ │  PER-USER JUNGLE (Docker)   │ │  FUTURE: Lambda Cluster     │
│  (Go Registry Server)       │ │  (Isolated Container)       │ │  (AWS Lambda Functions)     │
│                             │ │                             │ │                             │
│  - SQLite DB                │ │  - Own SQLite DB            │ │  - Serverless execution     │
│  - Registered MCP Servers   │ │  - User's registered tools  │ │  - Cold/warm starts         │
│  - MCP Proxy Server         │ │  - Isolated environment     │ │  - Public/Private MCPs      │
└──────────────┬──────────────┘ └──────────────┬──────────────┘ └──────────────┬──────────────┘
               │                               │                               │
               ▼                               ▼                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            UPSTREAM MCP SERVERS (External)                          │
│                                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │  GitHub API │ │  Weather    │ │  Database   │ │  File Sys   │ │  Custom     │   │
│  │  (HTTP)     │ │  (HTTP)     │ │  (stdio)    │ │  (stdio)    │ │  (any)      │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Components

### 3.1 MCPJungle Registry (Go)

**Location**: `/internal/`, `/cmd/`, `/pkg/`

The Go service is the **core MCP proxy and registry**. It maintains a local database of registered MCP servers and their tools, and acts as a proxy to forward MCP requests to the appropriate upstream server.

#### Entry Point

```go
// main.go
func main() {
    if err := cmd.Execute(); err != nil {
        os.Exit(1)
    }
}
```

#### Key Commands (CLI)

| Command | Description |
|---------|-------------|
| `mcpjungle start` | Start the HTTP server |
| `mcpjungle register` | Register an MCP server |
| `mcpjungle deregister` | Remove an MCP server |
| `mcpjungle list` | List all registered servers/tools |
| `mcpjungle invoke` | Invoke a tool directly |

#### Server Modes

```go
// internal/model/server_config.go
type ServerMode string

const (
    ModeDev        ServerMode = "development"
    ModeEnterprise ServerMode = "enterprise"
)
```

- **Development**: Single-user, no auth required
- **Enterprise**: Multi-user, requires authentication via access tokens

#### MCP Server Model

```go
// internal/model/mcp_server.go
type McpServer struct {
    gorm.Model
    Name        string                   `json:"name" gorm:"uniqueIndex;not null"`
    Transport   types.McpServerTransport `json:"transport"` // stdio | http | sse
    Description string                   `json:"description"`
    Config      datatypes.JSON           `json:"config"`    // Transport-specific config
}

// Transport configurations
type StreamableHTTPConfig struct {
    URL         string `json:"url"`
    BearerToken string `json:"bearer_token,omitempty"`
}

type StdioConfig struct {
    Command string            `json:"command"`
    Args    []string          `json:"args,omitempty"`
    Env     map[string]string `json:"env,omitempty"`
}

type SSEConfig struct {
    URL         string `json:"url"`
    BearerToken string `json:"bearer_token,omitempty"`
}
```

#### Tool Model

```go
// internal/model/mcp_tool.go
type Tool struct {
    gorm.Model
    Name        string         `json:"name"`
    Enabled     bool           `json:"enabled" gorm:"default:true"`
    Description string         `json:"description"`
    InputSchema datatypes.JSON `json:"input_schema" gorm:"type:jsonb"`
    ServerID    uint           `json:"-" gorm:"not null"`
    Server      McpServer      `json:"-" gorm:"foreignKey:ServerID"`
}
```

#### MCP Service

```go
// internal/service/mcp/mcp.go
type MCPService struct {
    db                *gorm.DB
    mcpProxyServer    *server.MCPServer     // For stdio/http tools
    sseMcpProxyServer *server.MCPServer     // For SSE tools
    toolInstances     map[string]mcp.Tool   // In-memory cache
    mu                sync.RWMutex
    metrics           telemetry.CustomMetrics
}

// Key methods
func (m *MCPService) RegisterMcpServer(ctx context.Context, s *model.McpServer) error
func (m *MCPService) DeregisterMcpServer(name string) error
func (m *MCPService) ListTools() ([]model.Tool, error)
func (m *MCPService) InvokeTool(ctx context.Context, name string, args map[string]any) (*types.ToolInvokeResult, error)
```

#### Tool Name Convention

Tools are uniquely identified by: `<server_name>__<tool_name>`

```go
// internal/service/mcp/util.go
const serverToolNameSep = "__"

// Example: "github__create_issue"
func mergeServerToolNames(s, t string) string {
    return s + serverToolNameSep + t
}

func splitServerToolName(name string) (string, string, bool) {
    return strings.Cut(name, serverToolNameSep)
}
```

#### MCP Proxy Flow

```go
// internal/service/mcp/proxy.go
func (m *MCPService) MCPProxyToolCallHandler(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
    // 1. Parse tool name to get server and tool
    serverName, toolName, _ := splitServerToolName(request.Params.Name)
    
    // 2. Check authorization (enterprise mode)
    if model.IsEnterpriseMode(serverMode) {
        client := ctx.Value("client").(*model.McpClient)
        if !client.CheckHasServerAccess(serverName) {
            return nil, fmt.Errorf("not authorized")
        }
    }
    
    // 3. Get server config from DB
    server, _ := m.GetMcpServer(serverName)
    
    // 4. Create session with upstream MCP server
    mcpClient, _ := newMcpServerSession(ctx, server)
    defer mcpClient.Close()
    
    // 5. Forward the request
    request.Params.Name = toolName  // Remove server prefix
    return mcpClient.CallTool(ctx, request)
}
```

#### HTTP API Routes

```go
// internal/api/server.go
func (s *Server) setupRouter() (*gin.Engine, error) {
    r := gin.Default()
    
    // Health check
    r.GET("/health", ...)
    
    // MCP Proxy endpoints
    r.Any("/mcp", ...)           // Streamable HTTP
    r.Any("/sse", ...)           // SSE transport
    r.Any("/message", ...)       // SSE messages
    
    // Tool Group endpoints
    r.Any("/v0/groups/:name/mcp", ...)
    r.Any("/v0/groups/:name/sse", ...)
    
    // API endpoints
    apiV0 := r.Group("/api/v0")
    apiV0.GET("/servers", ...)
    apiV0.GET("/tools", ...)
    apiV0.POST("/tools/invoke", ...)
    apiV0.POST("/servers", ...)        // Admin only
    apiV0.DELETE("/servers/:name", ...)  // Admin only
    
    return r, nil
}
```

---

### 3.2 Orchestrator (TypeScript)

**Location**: `/orchestrator/src/`

The Orchestrator is a **gateway layer** that sits between AI agents and the MCPJungle registry. It provides:

- Request routing (shared vs per-user)
- Tool discovery (via Supabase)
- CodeMode execution
- Session management

#### Directory Structure

```
orchestrator/src/
├── auth/                 # Authentication
│   ├── authorize.ts      # Method authorization
│   └── bearer.ts         # Bearer token extraction
├── codemode/             # Code execution engine
│   ├── index.ts          # Facade
│   ├── runner.ts         # Code runner
│   ├── invoker.ts        # Tool invocation bridge
│   ├── binding.ts        # Tool bindings
│   ├── cache.ts          # Type cache
│   ├── typegen.ts        # TypeScript generation
│   ├── policy.ts         # Security policy
│   └── telemetry.ts      # Execution telemetry
├── config/               # Configuration
│   ├── schema.ts         # Zod schema
│   └── load.ts           # Config loader
├── discovery/            # Tool discovery (Epic 4)
│   ├── index.ts          # Main entry point
│   ├── supabase/         # Supabase client & service
│   ├── search/           # Vector search & embeddings
│   ├── selection/        # Filtering & ranking
│   ├── preferences/      # User preferences
│   ├── provisioning/     # Tool installation
│   └── interaction/      # Manual mode UI
├── health/               # Health checks
├── jsonrpc/              # JSON-RPC utilities
├── obs/                  # Observability (logging, OTEL)
├── provisioning/         # Container provisioning
│   ├── types.ts          # Provisioner interface
│   ├── docker.ts         # Docker provisioner
│   └── k8s.ts            # Kubernetes provisioner
├── routing/              # Request routing
│   ├── router.ts         # Route resolution
│   ├── store.ts          # User->URL mapping
│   └── types.ts          # Route types
├── security/             # Security middleware
│   ├── helmet.ts         # HTTP headers
│   ├── limits.ts         # Size limits
│   └── rateLimit.ts      # Rate limiting
└── server/               # HTTP server
    ├── http.ts           # Main Express app
    ├── upstream.ts       # Upstream communication
    ├── admin.ts          # Admin API
    ├── interceptor.ts    # Discovery interceptor
    └── dev.ts            # Dev server entry
```

#### Configuration Schema

```typescript
// orchestrator/src/config/schema.ts
export const configSchema = z.object({
  // Core
  JUNGLE_URL: z.string().url(),
  PORT: z.string().optional().transform(v => parseInt(v || '8080')),
  BIND: z.string().default('127.0.0.1'),
  
  // Authentication
  JUNGLE_TOKEN: z.string().optional(),
  
  // Timeouts
  ORCH_UPSTREAM_TIMEOUT_MS: z.string().optional().transform(v => parseInt(v || '30000')),
  
  // CodeMode
  CODEMODE_TELEMETRY: z.string().optional().transform(v => v === 'true'),
  CODEMODE_PERSIST_CODE: z.string().optional().transform(v => v === 'true'),
  
  // Routing
  ROUTING_MODE: z.enum(['shared', 'per_user']).default('shared'),
  ROUTING_USER_TTL_MS: z.string().optional().transform(v => parseInt(v || '1800000')),
  
  // Provisioning
  PROVISIONER: z.enum(['none', 'docker', 'k8s']).default('none'),
  PROVISION_ON_DEMAND: z.string().optional().transform(v => v === 'true'),
  
  // Discovery (Supabase)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_KEY: z.string().optional(),
  
  // AI (OpenAI)
  OPENAI_API_KEY: z.string().optional(),
});

export type OrchestratorConfig = {
  jungleUrl: string;
  port: number;
  bind: string;
  jungleToken?: string;
  upstreamTimeoutMs: number;
  routingMode: 'shared' | 'per_user';
  routingUserTtlMs: number;
  provisioner: 'none' | 'docker' | 'k8s';
  provisionOnDemand: boolean;
  supabaseUrl?: string;
  supabaseKey?: string;
  openaiApiKey?: string;
};
```

#### HTTP Server

```typescript
// orchestrator/src/server/http.ts
const app = express();

// Middleware
app.use(applyHelmet());
app.use(express.json({ limit: '1mb' }));
app.use('/mcp', simpleRateLimit(5, 1000));
app.use(bearerAuth());

// Health check
app.get('/healthz', healthz);

// Main MCP endpoint
app.post('/mcp', enforceJsonAndSize(1_000_000), authorizeMethods(), async (req, res) => {
  const body = req.body;
  
  // Handle initialize
  if (body.method === 'initialize') {
    // Forward to upstream Jungle
    const decision = await resolveJungleEndpoint({ userId });
    const upstream = await fetch(`${decision.baseUrl}/mcp`, { ... });
    // ...
  }
  
  // Handle tools/list, tools/call, etc.
  // Forward to appropriate Jungle instance
  const decision = await resolveJungleEndpoint({ userId });
  const upstream = await fetchWithRetry(`${decision.baseUrl}/mcp`, { ... });
  // ...
});
```

#### Routing Logic

```typescript
// orchestrator/src/routing/router.ts
export async function resolveJungleEndpoint({ userId }: { userId?: string }): Promise<RouteDecision> {
  const cfg = loadConfig(process.env);
  
  // Shared mode: everyone uses the same Jungle instance
  if (cfg.routingMode === 'shared' || !userId) {
    return { baseUrl: cfg.jungleUrl, mode: 'shared' };
  }
  
  // Per-user mode: check if user already has an instance
  const mapped = storeGet(userId);
  if (mapped) {
    return { baseUrl: mapped, mode: 'per_user' };
  }
  
  // Provision on demand
  if (cfg.provisionOnDemand) {
    const prov = await getProvisioner();
    const { baseUrl } = await prov.provision(userId);
    await waitForHealthy(baseUrl);
    storeSet(userId, baseUrl, cfg.routingUserTtlMs);
    return { baseUrl, mode: 'per_user' };
  }
  
  // Fallback to shared
  return { baseUrl: cfg.jungleUrl, mode: 'shared' };
}
```

#### Provisioner Interface

```typescript
// orchestrator/src/provisioning/types.ts
export interface Provisioner {
  provision(userId: string): Promise<{ baseUrl: string }>;
  stop(userId: string): Promise<void>;
  isHealthy(baseUrl: string): Promise<boolean>;
}

// Get provisioner based on config
export async function getProvisioner(): Promise<Provisioner> {
  const cfg = loadConfig(process.env);
  switch (cfg.provisioner) {
    case 'docker':
      return new DockerProvisioner();
    case 'k8s':
      return new K8sProvisioner();
    default:
      return new NoopProvisioner();
  }
}
```

#### Docker Provisioner

```typescript
// orchestrator/src/provisioning/docker.ts
export class DockerProvisioner implements Provisioner {
  async provision(userId: string): Promise<{ baseUrl: string }> {
    const image = process.env.JUNGLE_IMAGE || 'mcpjungle/mcpjungle:latest-stdio';
    const name = `jungle-${userId}`;
    
    // Run container
    await pexec('docker', ['run', '-d', '--name', name, '-p', '0:9000', image]);
    
    // Get assigned port
    const { stdout } = await pexec('docker', ['inspect', name]);
    const port = parseInspectHostPort(JSON.parse(stdout));
    
    return { baseUrl: `http://127.0.0.1:${port}` };
  }
  
  async stop(userId: string): Promise<void> {
    await pexec('docker', ['rm', '-f', `jungle-${userId}`]);
  }
}
```

---

### 3.3 CodeMode Standalone (TypeScript)

**Location**: `/codemode-standalone/src/`

CodeMode is a **sandboxed code execution engine** that allows AI agents to generate and execute code that calls MCP tools.

#### Directory Structure

```
codemode-standalone/src/
├── core/
│   ├── CodemodeEngine.ts    # Main engine
│   ├── TypeGenerator.ts     # Generate TypeScript definitions
│   └── ToolRegistry.ts      # Tool registration
├── execution/
│   ├── IsolatedExecutor.ts  # V8 isolate execution
│   ├── ExecutionContext.ts  # Execution context
│   └── SecurityPolicy.ts    # Security constraints
├── mcp/
│   ├── MCPClient.ts         # MCP client wrapper
│   ├── MCPToolConverter.ts  # Convert MCP tools to codemode tools
│   └── types.ts             # MCP types
├── llm/
│   ├── AnthropicAdapter.ts  # Anthropic code generation
│   ├── ToolCallingEngine.ts # Native tool calling
│   └── types.ts             # LLM types
├── types/
│   └── index.ts             # Shared types
└── index.ts                 # Exports
```

#### Core Types

```typescript
// codemode-standalone/src/types/index.ts
export interface Tool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  execute: (input: any) => Promise<any>;
}

export interface SecurityPolicy {
  maxExecutionTime: number;    // milliseconds
  maxMemoryMB: number;         // memory limit
  allowNetworkAccess: boolean;
  allowFileAccess: boolean;
}

export interface ExecutionResult<T = any> {
  success: boolean;
  result?: T;
  error?: { message: string; stack?: string };
  executionTime: number;
}
```

#### Isolated Executor

```typescript
// codemode-standalone/src/execution/IsolatedExecutor.ts
import ivm from 'isolated-vm';

export class IsolatedExecutor {
  private securityPolicy: SecurityPolicyManager;
  private executionContext: ExecutionContext;
  
  async execute<T = any>(code: string): Promise<ExecutionResult<T>> {
    // Create isolated V8 instance with memory limits
    const isolate = new ivm.Isolate({
      memoryLimit: this.securityPolicy.getPolicy().maxMemoryMB,
    });
    
    const context = await isolate.createContext();
    
    // Inject tool proxy into isolate
    const toolCallbackRef = new ivm.Reference(
      async (toolName: string, argsJson: string) => {
        const args = JSON.parse(argsJson);
        const result = await toolsProxy[toolName](args);
        return JSON.stringify(result);
      }
    );
    
    await jail.set('__executeToolNative', toolCallbackRef);
    
    // Execute with timeout
    const script = await isolate.compileScript(wrappedCode);
    const result = await script.run(context, {
      timeout: this.securityPolicy.getMaxExecutionTime(),
      promise: true,
    });
    
    isolate.dispose();
    return { success: true, result, executionTime: Date.now() - startTime };
  }
}
```

#### Tool Calling Engine (Anthropic)

```typescript
// codemode-standalone/src/llm/ToolCallingEngine.ts
export class ToolCallingEngine {
  private client: Anthropic;
  private toolRegistry: ToolRegistry;
  
  async execute(request: ToolCallingRequest): Promise<ToolCallingResponse> {
    const messages: Message[] = [{ role: 'user', content: request.task }];
    
    for (let turn = 0; turn < this.config.maxTurns; turn++) {
      const response = await this.client.messages.create({
        model: this.config.model,
        messages,
        tools: this.getAnthropicTools(),
      });
      
      // Process tool calls
      if (response.stop_reason === 'tool_use') {
        for (const block of response.content) {
          if (block.type === 'tool_use') {
            const result = await this.toolRegistry.executeTool(block.name, block.input);
            messages.push({ role: 'assistant', content: response.content });
            messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) }] });
          }
        }
      } else {
        // Final response
        return { success: true, response: extractTextContent(response) };
      }
    }
  }
}
```

---

## 4. Data Layer

### 4.1 Local SQLite Database (Go Service)

The Go service uses SQLite for local persistence of registered MCP servers and tools.

#### Schema (GORM Models)

```sql
-- MCP Servers
CREATE TABLE mcp_servers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  DATETIME,
  updated_at  DATETIME,
  deleted_at  DATETIME,
  name        TEXT UNIQUE NOT NULL,
  transport   VARCHAR(30) NOT NULL,  -- 'stdio', 'http', 'sse'
  description TEXT,
  config      JSONB NOT NULL         -- Transport-specific config
);

-- Tools
CREATE TABLE tools (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at   DATETIME,
  updated_at   DATETIME,
  deleted_at   DATETIME,
  name         TEXT NOT NULL,
  enabled      BOOLEAN DEFAULT TRUE,
  description  TEXT,
  input_schema JSONB,
  server_id    INTEGER NOT NULL REFERENCES mcp_servers(id)
);

-- MCP Clients (Enterprise mode)
CREATE TABLE mcp_clients (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT UNIQUE NOT NULL,
  description  TEXT,
  access_token TEXT UNIQUE NOT NULL,
  allow_list   JSONB NOT NULL  -- Array of server names
);

-- Tool Groups
CREATE TABLE tool_groups (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT UNIQUE NOT NULL,
  description      TEXT,
  included_tools   JSONB,  -- Array of tool names
  included_servers JSONB,  -- Array of server names
  excluded_tools   JSONB   -- Array of tool names to exclude
);

-- Server Config
CREATE TABLE server_configs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  initialized BOOLEAN DEFAULT FALSE,
  mode        VARCHAR(30)  -- 'development', 'enterprise'
);

-- Users (Enterprise mode)
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  access_token  TEXT UNIQUE NOT NULL,
  is_admin      BOOLEAN DEFAULT FALSE
);
```

### 4.2 Supabase Cloud Database (Discovery)

The Orchestrator uses Supabase for cloud-based tool discovery and user preferences.

#### Existing Tables (Read-Only)

```sql
-- Tools table (managed externally, read-only for orchestrator)
CREATE TABLE tools (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ DEFAULT now(),
  merchant_id    UUID NOT NULL REFERENCES merchants(id),
  name           VARCHAR NOT NULL,
  description    VARCHAR NOT NULL,
  endpoint_url   VARCHAR NOT NULL,  -- The actual MCP endpoint
  price_per_call REAL NOT NULL,
  average_rating REAL NOT NULL,
  updated_at     TIMESTAMP DEFAULT now(),
  listing_status listing_status_enum NOT NULL  -- 'ACTIVE', 'INACTIVE'
);

-- Users table (Supabase Auth integration)
CREATE TABLE users (
  uid          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id      UUID REFERENCES auth.users(id),
  account_type account_type_enum,  -- 'ADMIN', 'MERCHANT', 'AGENT'
  name         VARCHAR,
  dob          DATE,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Merchants table
CREATE TABLE merchants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(uid),
  trust_rating REAL,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

#### Orchestrator Tables (Writable, suffix `_orchestrator`)

```sql
-- User preferences for tool discovery
CREATE TABLE user_preferences_orchestrator (
  user_id              UUID PRIMARY KEY,
  discovery_mode       TEXT DEFAULT 'manual' CHECK (discovery_mode IN ('auto', 'manual')),
  auto_install_strategy TEXT DEFAULT 'balanced' CHECK (auto_install_strategy IN ('cheapest', 'rating', 'balanced')),
  max_price_cap        REAL DEFAULT 1.0,
  min_rating_threshold REAL DEFAULT 3.0,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

-- Vector embeddings for tool descriptions
CREATE TABLE tool_embeddings_orchestrator (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id               UUID UNIQUE REFERENCES tools(id),
  description_embedding VECTOR(1536),  -- OpenAI text-embedding-3-small
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- Installed tools per user
CREATE TABLE user_tools_orchestrator (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  tool_id       UUID NOT NULL REFERENCES tools(id),
  canonical_name TEXT NOT NULL,  -- e.g., "github__create_issue"
  installed_at  TIMESTAMPTZ DEFAULT now(),
  is_active     BOOLEAN DEFAULT TRUE,
  UNIQUE (user_id, tool_id)
);
```

#### Vector Search Function (RPC)

```sql
-- Supabase function for semantic search
CREATE OR REPLACE FUNCTION match_tools_orchestrator(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  description VARCHAR,
  endpoint_url VARCHAR,
  price_per_call REAL,
  average_rating REAL,
  listing_status listing_status_enum,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.description,
    t.endpoint_url,
    t.price_per_call,
    t.average_rating,
    t.listing_status,
    1 - (e.description_embedding <=> query_embedding) AS similarity
  FROM tools t
  INNER JOIN tool_embeddings_orchestrator e ON t.id = e.tool_id
  WHERE t.listing_status = 'ACTIVE'
    AND 1 - (e.description_embedding <=> query_embedding) > match_threshold
  ORDER BY e.description_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## 5. MCP Protocol Implementation

### Protocol Version

MCPJungle implements MCP Protocol version `2024-11-05`.

### Supported Transports

| Transport | Description | Configuration |
|-----------|-------------|---------------|
| **stdio** | Command-line process | `command`, `args`, `env` |
| **streamable-http** | HTTP with streaming | `url`, `bearer_token` |
| **sse** | Server-Sent Events | `url`, `bearer_token` |

### JSON-RPC Message Format

```typescript
// Request
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

// Response (success)
interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id: string | number;
  result: unknown;
}

// Response (error)
interface JsonRpcError {
  jsonrpc: '2.0';
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Error codes
const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR: -32000,
};
```

### Supported Methods

| Method | Description |
|--------|-------------|
| `initialize` | Initialize MCP session |
| `tools/list` | List available tools |
| `tools/call` | Call a specific tool |
| `cancel` | Cancel an in-progress request |

### Tool Schema

```typescript
interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, JSONSchema>;
    required?: string[];
  };
}

interface CallToolRequest {
  method: 'tools/call';
  params: {
    name: string;
    arguments?: Record<string, unknown>;
  };
}

interface CallToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    // ... other content types
  }>;
  isError?: boolean;
}
```

---

## 6. Discovery System (Epic 4)

The Discovery System enables automatic finding and installation of MCP tools based on semantic search.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DISCOVERY FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  User Query: "I need to check weather"                                          │
│                    │                                                            │
│                    ▼                                                            │
│  ┌─────────────────────────────────────┐                                        │
│  │  1. QUERY EXPANSION (HyDE)          │                                        │
│  │  ───────────────────────────────────│                                        │
│  │  Input: "check weather"             │                                        │
│  │  LLM: GPT-4o-mini                   │                                        │
│  │  Output: "A comprehensive weather   │                                        │
│  │  API for getting current conditions │                                        │
│  │  and forecasts by location..."      │                                        │
│  └──────────────────┬──────────────────┘                                        │
│                     │                                                           │
│                     ▼                                                           │
│  ┌─────────────────────────────────────┐                                        │
│  │  2. EMBEDDING GENERATION            │                                        │
│  │  ───────────────────────────────────│                                        │
│  │  Model: text-embedding-3-small      │                                        │
│  │  Dimension: 1536                    │                                        │
│  │  Output: [0.023, -0.041, ...]       │                                        │
│  └──────────────────┬──────────────────┘                                        │
│                     │                                                           │
│                     ▼                                                           │
│  ┌─────────────────────────────────────┐                                        │
│  │  3. VECTOR SEARCH (Supabase)        │                                        │
│  │  ───────────────────────────────────│                                        │
│  │  RPC: match_tools_orchestrator      │                                        │
│  │  Similarity: Cosine distance        │                                        │
│  │  Output: Tools sorted by similarity │                                        │
│  └──────────────────┬──────────────────┘                                        │
│                     │                                                           │
│                     ▼                                                           │
│  ┌─────────────────────────────────────┐                                        │
│  │  4. FILTERING & RANKING             │                                        │
│  │  ───────────────────────────────────│                                        │
│  │  - Apply max_price_cap filter       │                                        │
│  │  - Apply min_rating_threshold       │                                        │
│  │  - Sort by strategy:                │                                        │
│  │    * cheapest: price ASC            │                                        │
│  │    * rating: rating DESC            │                                        │
│  │    * balanced: weighted score       │                                        │
│  └──────────────────┬──────────────────┘                                        │
│                     │                                                           │
│           ┌─────────┴─────────┐                                                 │
│           │                   │                                                 │
│           ▼                   ▼                                                 │
│  ┌────────────────┐  ┌────────────────┐                                         │
│  │  AUTO MODE     │  │  MANUAL MODE   │                                         │
│  │  ─────────────-│  │  ─────────────-│                                         │
│  │  Install top   │  │  Prompt user   │                                         │
│  │  ranked tool   │  │  with options  │                                         │
│  │  automatically │  │  Wait for      │                                         │
│  │                │  │  selection     │                                         │
│  └────────┬───────┘  └────────┬───────┘                                         │
│           │                   │                                                 │
│           └─────────┬─────────┘                                                 │
│                     │                                                           │
│                     ▼                                                           │
│  ┌─────────────────────────────────────┐                                        │
│  │  5. INSTALLATION                    │                                        │
│  │  ───────────────────────────────────│                                        │
│  │  - Write to user_tools_orchestrator │                                        │
│  │  - Generate canonical name          │                                        │
│  │  - Refresh runtime (if applicable)  │                                        │
│  └─────────────────────────────────────┘                                        │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Key Modules

#### Supabase Client

```typescript
// orchestrator/src/discovery/supabase/client.ts
let supabaseClient: SupabaseClient | null = null;

export function initializeSupabaseClient(config?: SupabaseConfig): SupabaseClient {
  const cfg = config || getSupabaseConfig();
  supabaseClient = createClient(cfg.url, cfg.key);
  return supabaseClient;
}

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    return initializeSupabaseClient();
  }
  return supabaseClient;
}
```

#### Query Expansion

```typescript
// orchestrator/src/discovery/search/queryExpansion.ts
export const EXPANSION_SYSTEM_PROMPT = `You are a tool discovery assistant.
Given a user's query about what they want to accomplish, generate an ideal tool description.
Focus on: functionality, input/output, common use cases.
Output ONLY the description, 2-4 sentences.`;

export async function expandQuery(userQuery: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: EXPANSION_SYSTEM_PROMPT },
        { role: 'user', content: userQuery },
      ],
      max_tokens: 300,
      temperature: 0.7,
    }),
  });
  
  const data = await response.json();
  return data.choices[0].message.content.trim();
}
```

#### Embedding Generation

```typescript
// orchestrator/src/discovery/search/embedding.ts
export const DEFAULT_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSION = 1536;

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input: text,
    }),
  });
  
  const data = await response.json();
  return data.data[0].embedding;
}
```

#### Vector Search

```typescript
// orchestrator/src/discovery/search/vectorStore.ts
export async function findSimilarTools(
  embedding: number[],
  options?: VectorSearchOptions
): Promise<ToolWithScore[]> {
  const client = getSupabaseClient();
  
  const { data, error } = await client.rpc('match_tools_orchestrator', {
    query_embedding: embedding,
    match_threshold: options?.matchThreshold ?? 0.5,
    match_count: options?.matchCount ?? 10,
  });
  
  if (error) throw new VectorSearchError(error.message);
  
  return data.map(mapToToolWithScore);
}
```

#### Filtering & Ranking

```typescript
// orchestrator/src/discovery/selection/filters.ts
export function filterTools<T extends FilterableTool>(
  tools: T[],
  prefs: { maxPriceCap?: number | null; minRatingThreshold?: number | null }
): T[] {
  return tools.filter(tool => {
    if (prefs.maxPriceCap != null && tool.price_per_call > prefs.maxPriceCap) {
      return false;
    }
    if (prefs.minRatingThreshold != null && tool.average_rating >= 0 && tool.average_rating < prefs.minRatingThreshold) {
      return false;
    }
    return true;
  });
}

// orchestrator/src/discovery/selection/ranking.ts
export function rankTools<T extends RankableTool>(
  tools: T[],
  strategy: SortStrategy
): T[] {
  const sorted = [...tools];
  
  switch (strategy) {
    case 'cheapest':
      sorted.sort((a, b) => a.price_per_call - b.price_per_call);
      break;
    case 'rating':
      sorted.sort((a, b) => b.average_rating - a.average_rating);
      break;
    case 'balanced':
      sorted.sort((a, b) => calculateBalancedScore(b) - calculateBalancedScore(a));
      break;
  }
  
  return sorted;
}

export function calculateBalancedScore(tool: RankableTool): number {
  const normalizedRating = Math.max(0, tool.average_rating) / 5;
  const normalizedPrice = 1 - Math.min(1, tool.price_per_call / 0.01);
  return (normalizedRating * 0.6) + (normalizedPrice * 0.4);
}
```

#### Main Entry Point

```typescript
// orchestrator/src/discovery/index.ts
export async function resolveMissingTool(
  userId: string,
  query: string
): Promise<ResolveResult> {
  // 1. Search for relevant tools
  const tools = await searchTools(query);
  
  if (tools.length === 0) {
    return { resolved: false, error: 'No matching tools found' };
  }
  
  // 2. Get user preferences
  const prefs = await getUserPreferences(userId);
  
  // 3. Filter and rank
  const selection = selectBestTool(tools, prefs);
  
  if (selection.candidates.length === 0) {
    return { resolved: false, error: 'All tools filtered out' };
  }
  
  // 4. Handle auto vs manual mode
  if (selection.mode === 'manual') {
    const requestId = generateRequestId();
    storePendingChoices(requestId, userId, query, selection.candidates);
    requestUserSelection(requestId, selection.candidates, query);
    return { resolved: false, manualMode: true, requestId };
  }
  
  // 5. Auto-install
  const installResult = await installTool(userId, selection.autoSelected);
  
  return {
    resolved: true,
    selectedTool: selection.autoSelected,
    installResult,
  };
}
```

### Admin API for Manual Mode

```typescript
// orchestrator/src/server/admin.ts
export function createAdminRouter(): Router {
  const router = Router();
  
  // Select a tool from pending choices
  router.post('/select-tool', async (req, res) => {
    const { requestId, toolId, action } = req.body;
    
    const pending = getPendingChoices(requestId);
    if (!pending) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    if (action === 'reject') {
      clearPendingChoices(requestId);
      return res.json({ success: true, message: 'Selection rejected' });
    }
    
    // Install selected tool
    const tool = pending.candidates.find(t => t.id === toolId);
    await installTool(pending.userId, tool);
    clearPendingChoices(requestId);
    
    return res.json({ success: true, message: 'Tool installed' });
  });
  
  // List pending selections
  router.get('/pending', (req, res) => { ... });
  
  // Health check
  router.get('/health', (req, res) => { ... });
  
  return router;
}
```

---

## 7. Routing & Provisioning

### Routing Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `shared` | All users share one Jungle instance | Simple deployments, low traffic |
| `per_user` | Each user gets isolated instance | Multi-tenant, security isolation |

### User-to-Instance Mapping

```typescript
// orchestrator/src/routing/store.ts
type Entry = { baseUrl: string; expiresAt: number };
const map = new Map<string, Entry>();

export function set(userId: string, baseUrl: string, ttlMs?: number): void {
  map.set(userId, { baseUrl, expiresAt: Date.now() + ttl });
}

export function get(userId: string): string | undefined {
  const entry = map.get(userId);
  if (!entry || Date.now() >= entry.expiresAt) {
    map.delete(userId);
    return undefined;
  }
  return entry.baseUrl;
}
```

### Container Provisioning

```typescript
// Docker
const dockerProvisioner = {
  async provision(userId: string) {
    await docker.run(`jungle-${userId}`, 'mcpjungle:latest', { port: '9000' });
    return { baseUrl: `http://localhost:${assignedPort}` };
  },
  async stop(userId: string) {
    await docker.rm(`jungle-${userId}`);
  }
};

// Kubernetes
const k8sProvisioner = {
  async provision(userId: string) {
    await k8s.createDeployment(`jungle-${userId}`, { ... });
    await k8s.createService(`jungle-${userId}`, { ... });
    return { baseUrl: `http://jungle-${userId}.svc.cluster.local:9000` };
  }
};
```

### Future: Lambda Provisioning

**Integration Point for Lambda:**

```typescript
// orchestrator/src/provisioning/lambda.ts (TO BE IMPLEMENTED)
export interface LambdaProvisioner extends Provisioner {
  // For PUBLIC MCPs: use shared Lambda
  invokeShared(toolId: string, params: unknown): Promise<unknown>;
  
  // For PRIVATE MCPs: create dedicated Lambda per user
  provisionPrivate(userId: string, toolId: string): Promise<{ functionArn: string; apiUrl: string }>;
  
  // Manage lifecycle
  warmUp(functionArn: string): Promise<void>;
  teardown(functionArn: string): Promise<void>;
}

// Expected configuration
interface LambdaConfig {
  region: string;
  s3Bucket: string;           // S3 bucket with MCP packages
  executionRole: string;      // IAM role ARN
  vpcConfig?: {
    subnetIds: string[];
    securityGroupIds: string[];
  };
  defaultMemory: number;      // MB
  defaultTimeout: number;     // seconds
}
```

**Required Data Model Extensions:**

```sql
-- New table for MCP package metadata
CREATE TABLE tools_metadata_orchestrator (
  tool_id          UUID PRIMARY KEY REFERENCES tools(id),
  deployment_type  TEXT CHECK (deployment_type IN ('PUBLIC', 'PRIVATE', 'EXTERNAL')),
  s3_package_url   TEXT,          -- s3://bucket/mcps/{merchant}/{tool}/
  lambda_arn       TEXT,          -- For shared public Lambdas
  input_schema     JSONB,         -- MCP tool input schema
  output_schema    JSONB,
  timeout_ms       INT DEFAULT 30000,
  memory_mb        INT DEFAULT 512,
  requires_auth    BOOLEAN DEFAULT FALSE
);

-- Track active Lambda instances
CREATE TABLE lambda_instances_orchestrator (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  tool_id         UUID NOT NULL REFERENCES tools(id),
  function_arn    TEXT NOT NULL,
  api_gateway_url TEXT,
  status          TEXT CHECK (status IN ('CREATING', 'ACTIVE', 'WARMING', 'TERMINATING', 'TERMINATED')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  last_invoked_at TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ
);
```

---

## 8. CodeMode Execution Engine

### Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CODEMODE EXECUTION FLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. AI generates code:                                                      │
│     ```javascript                                                           │
│     const weather = await tools.weather_get({ city: "London" });            │
│     return { temp: weather.temperature };                                   │
│     ```                                                                     │
│                                                                             │
│  2. runCode() is called:                                                    │
│     ┌───────────────────────────────────────────────┐                       │
│     │  orchestrator/src/codemode/runner.ts          │                       │
│     │  ─────────────────────────────────────────────│                       │
│     │  - Build security limits                      │                       │
│     │  - Create tool registry facade               │                       │
│     │  - Initialize IsolatedExecutor               │                       │
│     │  - Wrap code with `const codemode = tools;`  │                       │
│     └───────────────────────────────────────────────┘                       │
│                                                                             │
│  3. IsolatedExecutor runs code:                                             │
│     ┌───────────────────────────────────────────────┐                       │
│     │  codemode-standalone/execution/IsolatedExecutor│                      │
│     │  ─────────────────────────────────────────────│                       │
│     │  - Create V8 isolate with memory limit       │                       │
│     │  - Inject tool proxy                         │                       │
│     │  - Run with timeout                          │                       │
│     └───────────────────────────────────────────────┘                       │
│                                                                             │
│  4. Tool calls bridge back to orchestrator:                                 │
│     ┌───────────────────────────────────────────────┐                       │
│     │  orchestrator/src/codemode/invoker.ts         │                       │
│     │  ─────────────────────────────────────────────│                       │
│     │  - invokeTool() called                       │                       │
│     │  - Route resolved (shared/per_user)          │                       │
│     │  - POST to Jungle /mcp with tools/call       │                       │
│     │  - Response returned to isolate              │                       │
│     └───────────────────────────────────────────────┘                       │
│                                                                             │
│  5. Final result returned                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Security Limits

```typescript
// orchestrator/src/codemode/policy.ts
export interface SecurityLimits {
  maxExecutionTime: number;  // Default: 30000ms
  maxMemoryMB: number;       // Default: 128
  maxToolCalls: number;      // Default: 50
  allowNetworkAccess: boolean;
  allowFileAccess: boolean;
}

export function buildLimits(overrides?: Partial<SecurityLimits>): SecurityLimits {
  return {
    maxExecutionTime: 30000,
    maxMemoryMB: 128,
    maxToolCalls: 50,
    allowNetworkAccess: false,
    allowFileAccess: false,
    ...overrides,
  };
}
```

### Telemetry

```typescript
// orchestrator/src/codemode/telemetry.ts
export function withRunSpan<T>(attrs: Record<string, unknown>, fn: () => Promise<T>): Promise<T>;
export function withCompileSpan<T>(attrs: Record<string, unknown>, fn: () => Promise<T>): Promise<T>;
export function withEvalSpan<T>(attrs: Record<string, unknown>, fn: () => Promise<T>): Promise<T>;
export function withToolCallSpan<T>(name: string, attrs: Record<string, unknown>, fn: () => Promise<T>): Promise<T>;

export function recordCompileMs(ms: number): void;
export function recordEvalMs(ms: number): void;
export function incToolCalls(count: number): void;
export function incErrors(type: string): void;
```

---

## 9. API Reference

### MCPJungle Registry (Go) - Port 8080

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/metadata` | GET | Server version info |
| `/mcp` | POST | MCP JSON-RPC endpoint |
| `/sse` | ANY | SSE transport endpoint |
| `/message` | ANY | SSE message endpoint |
| `/init` | POST | Initialize server (enterprise) |
| `/api/v0/servers` | GET | List registered servers |
| `/api/v0/servers` | POST | Register new server |
| `/api/v0/servers/:name` | DELETE | Deregister server |
| `/api/v0/tools` | GET | List all tools |
| `/api/v0/tools/invoke` | POST | Invoke a tool |
| `/api/v0/tools/enable` | POST | Enable tools |
| `/api/v0/tools/disable` | POST | Disable tools |
| `/api/v0/clients` | GET/POST/DELETE | Manage MCP clients |
| `/api/v0/users` | GET/POST/DELETE | Manage users |
| `/api/v0/tool-groups` | CRUD | Manage tool groups |
| `/v0/groups/:name/mcp` | ANY | Tool group MCP endpoint |

### Orchestrator (TypeScript) - Port 8080

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/healthz` | GET | Health check |
| `/mcp` | POST | MCP JSON-RPC proxy |
| `/admin/select-tool` | POST | Manual tool selection |
| `/admin/pending` | GET | List pending selections |
| `/admin/health` | GET | Admin API health |

### MCP Protocol Methods

| Method | Description |
|--------|-------------|
| `initialize` | Initialize session |
| `tools/list` | List available tools |
| `tools/call` | Call a tool |
| `cancel` | Cancel request |

---

## 10. Integration Points

### Adding a New Provisioner

```typescript
// 1. Implement the Provisioner interface
export class LambdaProvisioner implements Provisioner {
  async provision(userId: string): Promise<{ baseUrl: string }> {
    // Create Lambda function and API Gateway
    const functionArn = await this.createFunction(userId);
    const apiUrl = await this.createApiGateway(functionArn);
    return { baseUrl: apiUrl };
  }
  
  async stop(userId: string): Promise<void> {
    // Teardown Lambda and API Gateway
  }
  
  async isHealthy(baseUrl: string): Promise<boolean> {
    // Check if Lambda is responsive
  }
}

// 2. Register in provisioning/types.ts
export async function getProvisioner(): Promise<Provisioner> {
  switch (cfg.provisioner) {
    case 'lambda':
      return new LambdaProvisioner();
    // ...
  }
}

// 3. Add config schema
PROVISIONER: z.enum(['none', 'docker', 'k8s', 'lambda']),
```

### Adding a New Discovery Source

```typescript
// 1. Create service in discovery/
export async function searchExternalCatalog(query: string): Promise<Tool[]> {
  // Search external tool catalog
}

// 2. Integrate in search/index.ts
export async function searchTools(query: string): Promise<ToolWithScore[]> {
  const [supabaseResults, externalResults] = await Promise.all([
    findSimilarTools(embedding),
    searchExternalCatalog(query),
  ]);
  
  return mergeAndRank(supabaseResults, externalResults);
}
```

### Connecting Lambda Infrastructure

**Expected Interface:**

```typescript
interface LambdaToolInvoker {
  // Invoke a tool hosted on Lambda
  invoke(params: {
    userId: string;
    toolId: string;
    toolName: string;
    deploymentType: 'PUBLIC' | 'PRIVATE';
    arguments: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    result?: unknown;
    error?: string;
  }>;
}

// Integration in orchestrator upstream handling:
async function forwardToLambda(tool: ToolMetadata, args: unknown) {
  const invoker = getLambdaInvoker();
  
  if (tool.deploymentType === 'PUBLIC') {
    // Use shared Lambda
    return invoker.invoke({
      toolId: tool.id,
      deploymentType: 'PUBLIC',
      arguments: args,
    });
  } else {
    // Check if user has active instance
    const instance = await getActiveInstance(userId, tool.id);
    if (!instance) {
      // Provision new instance
      instance = await invoker.provision(userId, tool);
    }
    return invoker.invoke({ ...params, instanceArn: instance.functionArn });
  }
}
```

---

## 11. Security Model

### Authentication Layers

1. **Orchestrator → Jungle**: Bearer token (`JUNGLE_TOKEN`)
2. **AI Agent → Orchestrator**: User ID header (`X-User-Id`)
3. **Jungle Enterprise Mode**: Client access tokens

### Authorization

```go
// Go: Check client access to server
func (c *McpClient) CheckHasServerAccess(serverName string) bool {
    var allowedServers []string
    json.Unmarshal(c.AllowList, &allowedServers)
    for _, allowed := range allowedServers {
        if allowed == serverName {
            return true
        }
    }
    return false
}
```

```typescript
// TypeScript: Method whitelist
const allowed = new Set(['initialize', 'tools/list', 'tools/call', 'cancel']);

export function authorizeMethods() {
  return (req, res, next) => {
    const method = req.body?.method;
    if (!allowed.has(method)) {
      return res.json(MethodNotFound(req.body?.id));
    }
    next();
  };
}
```

### Rate Limiting

```typescript
// orchestrator/src/security/rateLimit.ts
export function simpleRateLimit(max: number, windowMs: number) {
  const requests = new Map<string, number[]>();
  
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const timestamps = requests.get(key) || [];
    const recent = timestamps.filter(t => now - t < windowMs);
    
    if (recent.length >= max) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    
    recent.push(now);
    requests.set(key, recent);
    next();
  };
}
```

### Sandbox Security (CodeMode)

- **Memory Isolation**: V8 isolates with configurable memory limits
- **Execution Timeout**: Configurable max execution time
- **No Direct I/O**: All tool calls go through the proxy
- **Dangerous Pattern Detection**: Block `require()`, `import`, `process.`, etc.

---

## 12. Deployment

### Docker Compose (Local Dev)

```yaml
# orchestrator/docker-compose.yml
version: '3.8'
services:
  orchestrator:
    build: .
    ports:
      - "8080:8080"
    environment:
      - JUNGLE_URL=http://jungle:9000
      - ROUTING_MODE=shared
    depends_on:
      - jungle
  
  jungle:
    image: mcpjungle/mcpjungle:latest
    ports:
      - "9000:9000"
    environment:
      - SERVER_MODE=development
```

### Kubernetes

```yaml
# orchestrator/deploy/k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orchestrator
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: orchestrator
          image: orchestrator:latest
          ports:
            - containerPort: 8080
          env:
            - name: JUNGLE_URL
              value: "http://jungle-service:9000"
            - name: SUPABASE_URL
              valueFrom:
                secretKeyRef:
                  name: supabase-secrets
                  key: url
```

### Environment Variables

```bash
# Core
JUNGLE_URL=http://localhost:9000
PORT=8080
JUNGLE_TOKEN=your-auth-token

# Routing
ROUTING_MODE=shared|per_user
ROUTING_USER_TTL_MS=1800000
PROVISIONER=none|docker|k8s
PROVISION_ON_DEMAND=true

# Discovery
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
OPENAI_API_KEY=sk-...

# CodeMode
CODEMODE_TELEMETRY=true
CODEMODE_PERSIST_CODE=false
```

---

## 13. Extension Guide

### Adding Support for New MCP Transport

**In Go (Registry):**

```go
// 1. Add transport type
// pkg/types/mcp_server.go
const TransportLambda McpServerTransport = "lambda"

// 2. Add config struct
// internal/model/mcp_server.go
type LambdaConfig struct {
    FunctionArn string `json:"function_arn"`
    Region      string `json:"region"`
}

// 3. Add session creator
// internal/service/mcp/util.go
func createLambdaMcpServerConn(ctx context.Context, s *model.McpServer) (*client.Client, error) {
    // Implement Lambda-based MCP client
}

func newMcpServerSession(ctx context.Context, s *model.McpServer) (*client.Client, error) {
    switch s.Transport {
    case types.TransportLambda:
        return createLambdaMcpServerConn(ctx, s)
    // ...
    }
}
```

### Adding a New Selection Strategy

```typescript
// orchestrator/src/discovery/selection/ranking.ts
export function rankTools<T extends RankableTool>(
  tools: T[],
  strategy: SortStrategy
): T[] {
  switch (strategy) {
    case 'similarity':
      // New: sort by semantic similarity
      return tools.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
    case 'custom':
      return customRankingLogic(tools);
    // ...
  }
}
```

### Adding AI-Based Tool Validation

**Future Enhancement:**

```typescript
// orchestrator/src/discovery/validation/aiValidator.ts
export async function validateToolMatch(
  userIntent: string,
  tool: Tool
): Promise<{ confidence: number; reasoning: string }> {
  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    messages: [{
      role: 'user',
      content: `Does this tool match the user's intent?
        
Intent: ${userIntent}

Tool: ${tool.name}
Description: ${tool.description}

Respond with JSON: { "confidence": 0-1, "reasoning": "..." }`
    }],
  });
  
  return JSON.parse(response.content[0].text);
}

// Integration in discovery flow
const candidates = await searchTools(query);
const validated = await Promise.all(
  candidates.map(async (tool) => ({
    ...tool,
    validation: await validateToolMatch(query, tool),
  }))
);
const filtered = validated.filter(t => t.validation.confidence > 0.7);
```

---

## Appendix A: File Map

```
MCPJungle/
├── main.go                          # Go entry point
├── cmd/                             # CLI commands
│   ├── start.go                     # Start server command
│   ├── register.go                  # Register MCP server
│   └── ...
├── internal/                        # Go internal packages
│   ├── api/                         # HTTP handlers
│   ├── db/                          # Database connection
│   ├── model/                       # GORM models
│   ├── service/                     # Business logic
│   │   ├── mcp/                     # MCP service
│   │   └── ...
│   └── telemetry/                   # OpenTelemetry
├── pkg/                             # Public Go packages
│   ├── types/                       # Shared types
│   └── ...
├── orchestrator/                    # TypeScript orchestrator
│   ├── src/
│   │   ├── server/                  # HTTP server
│   │   ├── discovery/               # Tool discovery
│   │   ├── codemode/                # Code execution
│   │   ├── routing/                 # Request routing
│   │   └── provisioning/            # Container provisioning
│   └── ...
├── codemode-standalone/             # Sandboxed executor
│   ├── src/
│   │   ├── core/                    # Engine core
│   │   ├── execution/               # V8 isolate
│   │   └── llm/                     # LLM integration
│   └── ...
└── docs/
    └── ARCHITECTURE.md              # This document
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **MCP** | Model Context Protocol - Standard for AI tool interaction |
| **Jungle** | The Go registry server that manages MCP servers |
| **Orchestrator** | TypeScript gateway layer for routing and discovery |
| **CodeMode** | Sandboxed code execution engine |
| **Tool** | A callable function exposed by an MCP server |
| **Transport** | How to communicate with MCP server (stdio/http/sse) |
| **Canonical Name** | Unique tool identifier: `<server>__<tool>` |
| **HyDE** | Hypothetical Document Embeddings (query expansion technique) |
| **RPC** | Remote Procedure Call (Supabase function) |

---

*Document Version: 1.0*
*Last Updated: January 6, 2026*

