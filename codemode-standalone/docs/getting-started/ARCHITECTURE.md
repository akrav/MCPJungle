# Architecture Documentation

## System Overview

Codemode Standalone is built with a modular, layered architecture that separates concerns and enables scalability.

```
┌─────────────────────────────────────────────────────────────┐
│                     CodemodeEngine                          │
│                  (Main Orchestrator)                        │
└─────────────┬───────────────────────────┬───────────────────┘
              │                           │
              │                           │
    ┌─────────▼──────────┐      ┌────────▼────────────┐
    │   TypeGenerator    │      │   ToolRegistry      │
    │                    │      │                     │
    │ - Schema→Types     │      │ - Tool Management   │
    │ - Type Definitions │      │ - Tool Execution    │
    └────────────────────┘      └──────────┬──────────┘
                                           │
                                           │
              ┌────────────────────────────┴──────────────┐
              │                                           │
    ┌─────────▼──────────┐                  ┌────────────▼────────┐
    │  IsolatedExecutor  │                  │  ExecutionContext   │
    │                    │                  │                     │
    │ - Code Validation  │◄─────────────────┤ - Proxy Creation    │
    │ - Isolate Setup    │                  │ - Code Wrapping     │
    │ - Code Execution   │                  │ - Serialization     │
    └─────────┬──────────┘                  └─────────────────────┘
              │
              │
    ┌─────────▼──────────┐
    │  SecurityPolicy    │
    │   Manager          │
    │                    │
    │ - Policy Enforce   │
    │ - Resource Limits  │
    └────────────────────┘
```

## Component Responsibilities

### Core Layer (`src/core/`)

#### CodemodeEngine
**Purpose**: Main orchestrator that coordinates the entire codemode workflow.

**Responsibilities**:
- Coordinate type generation from tool schemas
- Build prompts for the LLM with generated types
- Manage the code generation request to LLM
- Orchestrate code execution
- Cache type definitions for performance

**Key Methods**:
- `execute(request)`: Main entry point for executing a codemode request
- `addTools(tools)`: Dynamically add new tools
- `updateSecurityPolicy(policy)`: Update security constraints

**Design Patterns**: Facade pattern - provides simple interface to complex subsystems

---

#### TypeGenerator
**Purpose**: Convert tool schemas to TypeScript type definitions for the LLM.

**Responsibilities**:
- Convert Zod schemas to TypeScript
- Convert JSON schemas to TypeScript
- Generate function signatures with JSDoc
- Create complete type definition strings

**Key Methods**:
- `generateTypeDefinitions(tools)`: Generate full TS definitions
- `generateToolDescriptions(tools)`: Generate plain text descriptions

**Libraries Used**:
- `json-schema-to-typescript`: JSON Schema → TS conversion
- `zod-to-ts`: Zod → TS conversion

**Design Patterns**: Strategy pattern - different conversion strategies for different schema types

---

#### ToolRegistry
**Purpose**: Central registry for managing tool lifecycle.

**Responsibilities**:
- Register and unregister tools
- Validate tool existence
- Execute tools by name
- Provide tool enumeration

**Key Methods**:
- `registerTool(name, tool)`: Add a tool
- `executeTool(name, args)`: Execute a tool
- `getAllTools()`: Get all registered tools

**Design Patterns**: Registry pattern - centralized storage and lookup

---

### Execution Layer (`src/execution/`)

#### IsolatedExecutor
**Purpose**: Execute generated code in a secure, isolated environment.

**Responsibilities**:
- Create V8 isolates with resource limits
- Inject tool proxy into execution context
- Execute code with timeout enforcement
- Handle errors and return structured results
- Validate code before execution

**Key Methods**:
- `execute(code)`: Execute code in isolate
- `validateCode(code)`: Check for dangerous patterns

**Security Features**:
- Memory limits (configurable MB)
- Execution timeout (configurable ms)
- No access to Node.js built-ins
- No file system access
- Controlled tool access via proxy

**Design Patterns**: Template Method - defines execution skeleton

---

#### ExecutionContext
**Purpose**: Set up the execution environment for generated code.

**Responsibilities**:
- Create JavaScript Proxy for tool interception
- Generate wrapper code for execution
- Handle serialization between isolates
- Manage the bridge between isolated and native context

**Key Methods**:
- `createToolProxy()`: Create proxy object
- `generateWrapperCode(code)`: Wrap user code
- `serializeValue()` / `deserializeValue()`: Handle data transfer

**Design Patterns**: Proxy pattern - intercept and route tool calls

---

#### SecurityPolicyManager
**Purpose**: Manage and enforce security policies.

**Responsibilities**:
- Store security policy configuration
- Validate domain access for network calls
- Provide policy query methods
- Calculate resource limits

**Key Methods**:
- `isDomainAllowed(domain)`: Check network access
- `getMaxExecutionTime()`: Get timeout
- `getMaxMemoryBytes()`: Get memory limit

**Design Patterns**: Policy pattern - encapsulate security rules

---

### MCP Layer (`src/mcp/`)

#### MCPClient
**Purpose**: Connect to and communicate with MCP servers.

**Responsibilities**:
- Establish connection to MCP servers
- Discover available tools from server
- Execute tool calls on the server
- Manage connection lifecycle

**Key Methods**:
- `connect()`: Establish connection
- `callTool(name, args)`: Execute remote tool
- `getTools()`: List available tools
- `disconnect()`: Clean up connection

**Supported Transports**:
- SSE (Server-Sent Events) - for HTTP-based servers
- STDIO - for local process-based servers

**Design Patterns**: Adapter pattern - adapts MCP protocol to our interface

---

#### MCPToolConverter
**Purpose**: Convert MCP tools to the internal Tool format.

**Responsibilities**:
- Transform MCP tool schemas to our schema format
- Create execution wrappers that call MCP client
- Handle multiple MCP servers with namespacing

**Key Methods**:
- `convertTool(mcpTool, client)`: Convert single tool
- `convertAllTools(client)`: Convert all from one client
- `convertMultipleClients(clients)`: Handle multiple servers

**Design Patterns**: Adapter pattern - converts between interfaces

---

## Data Flow

### 1. Setup Phase
```
User → CodemodeEngine(config)
  ├─→ Create TypeGenerator
  ├─→ Create ToolRegistry(tools)
  ├─→ Create SecurityPolicyManager(policy)
  └─→ Store generateCode function
```

### 2. Execution Phase
```
User Request
  │
  ├─→ CodemodeEngine.execute()
  │    │
  │    ├─→ TypeGenerator.generateTypeDefinitions()
  │    │    └─→ Returns TS type definitions
  │    │
  │    ├─→ Build LLM prompt with types
  │    │
  │    ├─→ generateCode(prompt)
  │    │    └─→ LLM returns JavaScript code
  │    │
  │    └─→ IsolatedExecutor.execute(code)
  │         │
  │         ├─→ Create new isolate
  │         ├─→ ExecutionContext.createToolProxy()
  │         ├─→ Inject proxy into isolate
  │         ├─→ Execute wrapped code
  │         │    │
  │         │    └─→ Code calls tools.myTool(args)
  │         │         │
  │         │         ├─→ Proxy intercepts call
  │         │         ├─→ Bridges to native context
  │         │         ├─→ ToolRegistry.executeTool()
  │         │         ├─→ Tool.execute(args)
  │         │         └─→ Return result to isolate
  │         │
  │         └─→ Return ExecutionResult
  │
  └─→ Return CodemodeResponse
```

### 3. MCP Integration Flow
```
MCPClient.connect()
  │
  ├─→ Establish transport (SSE/STDIO)
  ├─→ Discover tools from server
  └─→ Store tool list

MCPToolConverter.convertAllTools(client)
  │
  └─→ For each MCP tool:
       ├─→ Create Tool wrapper
       ├─→ execute() → calls client.callTool()
       └─→ Add to ToolSet

CodemodeEngine receives ToolSet
  │
  └─→ Register with ToolRegistry
```

## Security Architecture

### Isolation Layers

1. **V8 Isolate** (Primary)
   - Separate V8 instance per execution
   - Memory limits enforced by V8
   - No shared state between executions

2. **Proxy Layer** (Tool Access)
   - Tools only accessible via proxy
   - All calls must go through registry
   - Type checking and validation

3. **Policy Enforcement** (Resource Control)
   - Execution timeout enforced
   - Memory limits enforced
   - Network access controlled

4. **Code Validation** (Static Analysis)
   - Pattern matching for dangerous code
   - Blocks require/import statements
   - Blocks process/filesystem access

### Threat Model

| Threat | Mitigation |
|--------|-----------|
| Infinite loops | Execution timeout |
| Memory exhaustion | Memory limits in isolate |
| File system access | No fs module access |
| Network attacks | Optional network disable |
| Module injection | No require/import allowed |
| Process access | No process object |

## Extensibility Points

### 1. Adding New Tool Sources
Implement a converter similar to `MCPToolConverter`:

```typescript
class CustomToolConverter {
  convertToToolSet(customSource): ToolSet {
    // Convert your format to Tool format
  }
}
```

### 2. Custom Execution Environments
Extend `IsolatedExecutor` or create alternative:

```typescript
class WebAssemblyExecutor implements Executor {
  async execute(code: string): Promise<ExecutionResult> {
    // Your WASM execution logic
  }
}
```

### 3. Custom Security Policies
Extend `SecurityPolicyManager`:

```typescript
class EnhancedSecurityPolicy extends SecurityPolicyManager {
  validateCodeContent(code: string): boolean {
    // Additional security checks
  }
}
```

### 4. Observability
Add hooks to `CodemodeEngine`:

```typescript
class ObservableCodemodeEngine extends CodemodeEngine {
  async execute(request) {
    this.emit('execution:start', request);
    const result = await super.execute(request);
    this.emit('execution:complete', result);
    return result;
  }
}
```

## LLM Integration Architecture

### ToolCallingEngine

The `ToolCallingEngine` provides a production-ready integration with LLMs using Anthropic's tool calling API.

```
┌──────────────────────────────────────────────────────────────┐
│                      User Request                            │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                   ToolCallingEngine                          │
│  - Builds system prompt with tool definitions                │
│  - Manages multi-turn conversation                           │
│  - Tracks costs and token usage                              │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                  Anthropic Claude API                        │
│  - Receives tools: [executeCode]                             │
│  - Generates tool_use block                                  │
│  - Returns JavaScript code as tool input                     │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                 Isolated-VM Sandbox                          │
│  - Memory limits (64-128 MB)                                 │
│  - Timeout limits (5-10 seconds)                             │
│  - No filesystem/network access                              │
│  - Only registered tools callable                            │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│              Code Calls Registered Tools                     │
│  tools.calculate(), tools.getWeather(), etc.                 │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    Tool Registry                             │
│  - Intercepts tool calls via proxy                           │
│  - Executes real tool implementations                        │
│  - Returns results to code                                   │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                  Results Flow Back                           │
│  Code → Claude → Tool Result → User                          │
└──────────────────────────────────────────────────────────────┘
```

### Code-Only Pattern

The `ToolCallingEngine` uses a "code-only" pattern:

**Traditional Tool Calling**:
```
LLM → toolA → LLM → toolB → LLM → toolC → result
(Multiple API calls, higher cost)
```

**Code-Only Pattern**:
```
LLM → generates code → code calls toolA + toolB + toolC → result
(Single API call, lower cost, full JavaScript capabilities)
```

### Key Design Decisions

1. **Single Tool Exposure**: Claude only sees `executeCode` tool
   - Simpler mental model
   - Consistent execution path
   - All orchestration logic visible in code

2. **Tool Calling over Text Generation**: Uses Anthropic's native `tool_use` blocks
   - Structured responses
   - Better error handling
   - Production-ready API usage

3. **Isolated Execution**: All code runs in isolated-vm
   - Complete security
   - Fast execution (3-20ms)
   - Resource limits enforced

### Multi-Turn Conversation Flow

```
Turn 1:
  User → "Calculate 25 * 4"
  Engine → Claude API (with tools)
  Claude → tool_use: executeCode(code: "...")
  Engine → Execute code in sandbox
  Code → calls tools.calculate()
  Engine → Return tool_result to Claude
  
Turn 2 (if needed):
  Claude → Analyzes result, generates final answer
  Engine → Returns to user
```

### Cost Tracking

The engine automatically tracks:
- Input tokens
- Output tokens  
- Cached tokens (if applicable)
- Cost in USD
- Time metrics

```typescript
{
  result: "The answer is 100",
  toolCalls: ["executeCode"],
  totalTokens: 1250,
  cost: 0.0042,
  executionTime: 1876
}
```

## Performance Considerations

### Caching
- **Type Definitions**: Cached after first generation
- **Tool Registry**: In-memory map for O(1) lookup
- **Isolate Creation**: ~10ms overhead per execution

### Optimization Strategies
1. **Reuse Type Definitions**: Don't regenerate unless tools change
2. **Tool Batching**: Execute multiple operations in one isolate
3. **Connection Pooling**: Reuse MCP connections
4. **Lazy Loading**: Only connect to MCP servers when needed

### Scalability
- **Horizontal**: Multiple engine instances per node
- **Vertical**: Increase memory/timeout limits
- **Distributed**: Deploy across multiple nodes with shared tool registry

## Testing Strategy

### Unit Tests
- Each component tested in isolation
- Mock dependencies (e.g., mock LLM responses)
- Test edge cases and error conditions

### Integration Tests
- Test component interactions
- Real MCP server connections
- End-to-end execution flows

### Security Tests
- Attempt to break isolation
- Resource limit enforcement
- Malicious code detection

## Future Enhancements

### Planned Features
1. **Multi-language Support**: Python, TypeScript execution
2. **Persistent Isolates**: Reuse isolates for performance
3. **Distributed Execution**: Execute across cluster
4. **Enhanced Observability**: Tracing, metrics, logging
5. **Tool Versioning**: Support multiple tool versions
6. **Result Caching**: Cache tool execution results

### Extension Ideas
1. **Plugin System**: Load execution extensions
2. **Custom Transports**: Additional MCP transport types
3. **Streaming Results**: Stream execution progress
4. **Collaborative Execution**: Multiple agents sharing tools

