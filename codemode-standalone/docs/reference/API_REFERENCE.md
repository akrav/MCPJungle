# API Reference

Complete API documentation for all public classes and methods in codemode-standalone.

## Table of Contents

- [Core Classes](#core-classes)
  - [CodemodeEngine](#codemodeengine)
  - [TypeGenerator](#typegenerator)
  - [ToolRegistry](#toolregistry)
- [Execution Classes](#execution-classes)
  - [IsolatedExecutor](#isolatedexecutor)
  - [ExecutionContext](#executioncontext)
  - [SecurityPolicyManager](#securitypolicymanager)
- [MCP Classes](#mcp-classes)
  - [MCPClient](#mcpclient)
  - [MCPToolConverter](#mcptoolconverter)
- [Types](#types)
- [Constants](#constants)

---

## Core Classes

### CodemodeEngine

Main orchestrator for the codemode system. Coordinates type generation, code generation, and execution.

#### Constructor

```typescript
constructor(options: CodemodeOptions)
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options.generateCode` | `(prompt: string) => Promise<string>` | Yes | Function that generates code from LLM |
| `options.tools` | `ToolSet` | Yes | Available tools for execution |
| `options.securityPolicy` | `Partial<SecurityPolicy>` | No | Security constraints (defaults used if not provided) |
| `options.verbose` | `boolean` | No | Enable verbose logging (default: false) |

**Example:**

```typescript
const engine = new CodemodeEngine({
  generateCode: async (prompt) => {
    // Your LLM integration
    return generatedCode;
  },
  tools: {
    myTool: { /* tool definition */ }
  },
  securityPolicy: {
    maxExecutionTime: 5000,
    maxMemoryMB: 64
  },
  verbose: true
});
```

---

#### execute()

Execute a codemode request by generating and running code.

```typescript
async execute<T = any>(request: CodemodeRequest): Promise<CodemodeResponse<T>>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `request.userRequest` | `string` | Yes | User's natural language request |
| `request.context` | `string` | No | Additional context for the LLM |

**Returns:**

```typescript
{
  code: string;              // Generated JavaScript code
  result: ExecutionResult<T>; // Execution outcome
  typeDefinitions: string;    // TypeScript definitions provided to LLM
}
```

**Example:**

```typescript
const response = await engine.execute({
  userRequest: "Get the weather in San Francisco",
  context: "User wants to plan outdoor activities"
});

if (response.result.success) {
  console.log(response.result.result);
} else {
  console.error(response.result.error);
}
```

**Throws:**
- Error if code generation fails
- Error if critical system failure occurs

---

#### addTools()

Dynamically add new tools to the engine.

```typescript
addTools(tools: ToolSet): void
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `tools` | `ToolSet` | Object mapping tool names to tool definitions |

**Example:**

```typescript
engine.addTools({
  newTool: {
    name: "newTool",
    description: "A new tool",
    inputSchema: z.object({ param: z.string() }),
    execute: async (args) => { /* ... */ }
  }
});
```

**Note:** Invalidates cached type definitions.

---

#### removeTool()

Remove a tool from the engine.

```typescript
removeTool(name: string): void
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `name` | `string` | Name of the tool to remove |

**Example:**

```typescript
engine.removeTool("oldTool");
```

---

#### updateSecurityPolicy()

Update the security policy dynamically.

```typescript
updateSecurityPolicy(policy: Partial<SecurityPolicy>): void
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `policy` | `Partial<SecurityPolicy>` | Security policy updates |

**Example:**

```typescript
engine.updateSecurityPolicy({
  maxExecutionTime: 10000, // Increase to 10 seconds
  allowNetworkAccess: true
});
```

---

#### getSecurityPolicy()

Get the current security policy.

```typescript
getSecurityPolicy(): SecurityPolicy
```

**Returns:** Current security policy configuration

**Example:**

```typescript
const policy = engine.getSecurityPolicy();
console.log(`Timeout: ${policy.maxExecutionTime}ms`);
```

---

### TypeGenerator

Generates TypeScript type definitions from tool schemas.

#### generateTypeDefinitions()

Generate complete TypeScript definitions for all tools.

```typescript
async generateTypeDefinitions(tools: ToolSet): Promise<string>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `tools` | `ToolSet` | Tools to generate types for |

**Returns:** String containing TypeScript type definitions

**Example:**

```typescript
const generator = new TypeGenerator();
const types = await generator.generateTypeDefinitions({
  myTool: {
    inputSchema: z.object({ name: z.string() }),
    outputSchema: z.object({ result: z.string() })
  }
});
```

**Output Example:**

```typescript
interface MyToolInput {
  name: string;
}
interface MyToolOutput {
  result: string;
}
declare const tools: {
  myTool: (input: MyToolInput) => Promise<MyToolOutput>;
};
```

---

#### generateToolDescriptions()

Generate plain text descriptions of tools.

```typescript
generateToolDescriptions(tools: ToolSet): string
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `tools` | `ToolSet` | Tools to describe |

**Returns:** Formatted string with tool descriptions

**Example:**

```typescript
const descriptions = generator.generateToolDescriptions(tools);
// Returns: "- myTool: Does something useful\n- otherTool: ..."
```

---

### ToolRegistry

Manages tool registration and execution.

#### Constructor

```typescript
constructor(initialTools?: ToolSet)
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `initialTools` | `ToolSet` | Optional initial set of tools |

---

#### registerTool()

Register a single tool.

```typescript
registerTool(name: string, tool: Tool): void
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `name` | `string` | Unique tool name |
| `tool` | `Tool` | Tool definition |

**Throws:** Error if tool name already exists

**Example:**

```typescript
registry.registerTool("myTool", {
  name: "myTool",
  description: "Does something",
  inputSchema: z.object({ /* ... */ }),
  execute: async (args) => { /* ... */ }
});
```

---

#### registerTools()

Register multiple tools at once.

```typescript
registerTools(tools: ToolSet): void
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `tools` | `ToolSet` | Multiple tools to register |

---

#### unregisterTool()

Remove a tool from the registry.

```typescript
unregisterTool(name: string): boolean
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `name` | `string` | Tool name to remove |

**Returns:** `true` if tool was removed, `false` if not found

---

#### getTool()

Get a specific tool by name.

```typescript
getTool(name: string): Tool | undefined
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `name` | `string` | Tool name |

**Returns:** Tool definition or `undefined` if not found

---

#### getAllTools()

Get all registered tools.

```typescript
getAllTools(): ToolSet
```

**Returns:** Object containing all tools

---

#### hasTool()

Check if a tool exists.

```typescript
hasTool(name: string): boolean
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `name` | `string` | Tool name to check |

**Returns:** `true` if tool exists

---

#### executeTool()

Execute a tool by name.

```typescript
async executeTool<TInput = any, TOutput = any>(
  name: string,
  args: TInput
): Promise<TOutput>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `name` | `string` | Tool name |
| `args` | `TInput` | Tool arguments |

**Returns:** Tool execution result

**Throws:**
- Error if tool not found
- Error if tool execution fails

---

#### getToolNames()

Get list of all tool names.

```typescript
getToolNames(): string[]
```

**Returns:** Array of tool names

---

#### clear()

Remove all tools from registry.

```typescript
clear(): void
```

---

#### size

Get the number of registered tools.

```typescript
get size(): number
```

**Returns:** Number of tools

---

## Execution Classes

### IsolatedExecutor

Executes code in an isolated V8 environment.

#### Constructor

```typescript
constructor(
  toolRegistry: ToolRegistry,
  securityPolicy: SecurityPolicyManager
)
```

---

#### execute()

Execute code in isolation.

```typescript
async execute<T = any>(code: string): Promise<ExecutionResult<T>>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `code` | `string` | JavaScript code to execute |

**Returns:**

```typescript
{
  success: boolean;
  result?: T;
  error?: {
    message: string;
    stack?: string;
  };
  executionTime: number;
}
```

**Example:**

```typescript
const executor = new IsolatedExecutor(registry, policyManager);
const result = await executor.execute(`
  const weather = await tools.getWeather({ location: "NYC" });
  return weather;
`);

if (result.success) {
  console.log(result.result);
  console.log(`Took ${result.executionTime}ms`);
}
```

---

#### validateCode()

Validate code before execution.

```typescript
validateCode(code: string): { valid: boolean; reason?: string }
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `code` | `string` | Code to validate |

**Returns:** Validation result with optional reason if invalid

**Example:**

```typescript
const validation = executor.validateCode("const x = require('fs');");
if (!validation.valid) {
  console.error(validation.reason); // "require() is not allowed"
}
```

---

### ExecutionContext

Sets up the execution environment.

#### Constructor

```typescript
constructor(toolRegistry: ToolRegistry)
```

---

#### createToolProxy()

Create a proxy object for tool interception.

```typescript
createToolProxy(): any
```

**Returns:** Proxy object that routes tool calls

---

#### generateWrapperCode()

Generate wrapper code for execution.

```typescript
generateWrapperCode(generatedCode: string): string
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `generatedCode` | `string` | User's generated code |

**Returns:** Wrapped code ready for execution

---

#### serializeValue()

Serialize a value for isolate transfer.

```typescript
serializeValue(value: any): string
```

**Throws:** Error if value cannot be serialized

---

#### deserializeValue()

Deserialize a value from isolate.

```typescript
deserializeValue(serialized: string): any
```

**Throws:** Error if deserialization fails

---

### SecurityPolicyManager

Manages security policies and enforcement.

#### Constructor

```typescript
constructor(policy?: Partial<SecurityPolicy>)
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `policy` | `Partial<SecurityPolicy>` | Optional policy overrides |

---

#### getPolicy()

Get current security policy.

```typescript
getPolicy(): SecurityPolicy
```

**Returns:** Complete security policy

---

#### updatePolicy()

Update security policy.

```typescript
updatePolicy(updates: Partial<SecurityPolicy>): void
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `updates` | `Partial<SecurityPolicy>` | Policy updates to apply |

---

#### isDomainAllowed()

Check if a domain is allowed for network access.

```typescript
isDomainAllowed(domain: string): boolean
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `domain` | `string` | Domain to check |

**Returns:** `true` if domain is allowed

**Example:**

```typescript
const manager = new SecurityPolicyManager({
  allowNetworkAccess: true,
  allowedDomains: ['api.example.com', '*.github.com']
});

console.log(manager.isDomainAllowed('api.example.com'));  // true
console.log(manager.isDomainAllowed('api.github.com'));   // true
console.log(manager.isDomainAllowed('evil.com'));         // false
```

---

#### getMaxExecutionTime()

Get maximum execution time in milliseconds.

```typescript
getMaxExecutionTime(): number
```

---

#### getMaxMemoryBytes()

Get maximum memory in bytes.

```typescript
getMaxMemoryBytes(): number
```

---

## MCP Classes

### MCPClient

Connects to and communicates with MCP servers.

#### Constructor

```typescript
constructor(config: MCPServerConfig)
```

**Parameters:**

```typescript
{
  url: string;              // Server URL or command
  transport: "sse" | "stdio"; // Transport type
  headers?: Record<string, string>; // Optional HTTP headers
}
```

---

#### connect()

Establish connection to MCP server.

```typescript
async connect(): Promise<void>
```

**Throws:** Error if connection fails

**Example:**

```typescript
const client = new MCPClient({
  url: "http://localhost:3000/mcp",
  transport: "sse"
});

await client.connect();
```

---

#### callTool()

Execute a tool on the MCP server.

```typescript
async callTool(name: string, args: Record<string, any>): Promise<any>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `name` | `string` | Tool name |
| `args` | `Record<string, any>` | Tool arguments |

**Returns:** Tool execution result

**Throws:**
- Error if not connected
- Error if tool call fails

---

#### getTools()

Get all available tools from server.

```typescript
getTools(): MCPTool[]
```

**Returns:** Array of tool definitions

---

#### getStatus()

Get connection status.

```typescript
getStatus(): MCPConnectionStatus
```

**Returns:**

```typescript
{
  connected: boolean;
  error?: string;
  toolCount: number;
}
```

---

#### disconnect()

Disconnect from MCP server.

```typescript
async disconnect(): Promise<void>
```

---

#### isConnected()

Check if connected.

```typescript
isConnected(): boolean
```

---

### MCPToolConverter

Converts MCP tools to internal format.

#### convertTool()

Convert a single MCP tool.

```typescript
convertTool(mcpTool: MCPTool, client: MCPClient): Tool
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `mcpTool` | `MCPTool` | MCP tool definition |
| `client` | `MCPClient` | Connected MCP client |

**Returns:** Tool in internal format

---

#### convertAllTools()

Convert all tools from an MCP client.

```typescript
convertAllTools(client: MCPClient): ToolSet
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `client` | `MCPClient` | Connected MCP client |

**Returns:** ToolSet with all converted tools

**Example:**

```typescript
const converter = new MCPToolConverter();
const tools = converter.convertAllTools(client);

// Tools are prefixed with "mcp_"
// e.g., "mcp_listFiles", "mcp_readFile"
```

---

#### convertMultipleClients()

Convert tools from multiple MCP clients.

```typescript
convertMultipleClients(clients: Map<string, MCPClient>): ToolSet
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `clients` | `Map<string, MCPClient>` | Map of client ID to client |

**Returns:** ToolSet with namespaced tools

**Example:**

```typescript
const clients = new Map([
  ['filesystem', fsClient],
  ['database', dbClient]
]);

const tools = converter.convertMultipleClients(clients);
// Tools are prefixed: "mcp_filesystem_listFiles", "mcp_database_query"
```

---

## Types

### Tool

```typescript
interface Tool<TInput = any, TOutput = any> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput> | JSONSchema;
  outputSchema?: z.ZodType<TOutput> | JSONSchema;
  execute: (args: TInput) => Promise<TOutput>;
}
```

---

### ToolSet

```typescript
type ToolSet = Record<string, Tool>;
```

---

### SecurityPolicy

```typescript
interface SecurityPolicy {
  maxExecutionTime: number;    // Milliseconds
  maxMemoryMB: number;          // Megabytes
  allowNetworkAccess: boolean;
  allowedDomains?: string[];    // Optional whitelist
}
```

---

### ExecutionResult

```typescript
interface ExecutionResult<T = any> {
  success: boolean;
  result?: T;
  error?: {
    message: string;
    stack?: string;
  };
  executionTime: number;
}
```

---

### CodemodeOptions

```typescript
interface CodemodeOptions {
  generateCode: (prompt: string) => Promise<string>;
  tools: ToolSet;
  securityPolicy?: Partial<SecurityPolicy>;
  verbose?: boolean;
}
```

---

### CodemodeRequest

```typescript
interface CodemodeRequest {
  userRequest: string;
  context?: string;
}
```

---

### CodemodeResponse

```typescript
interface CodemodeResponse<T = any> {
  code: string;
  result: ExecutionResult<T>;
  typeDefinitions: string;
}
```

---

### MCPServerConfig

```typescript
interface MCPServerConfig {
  url: string;
  transport: "sse" | "stdio";
  headers?: Record<string, string>;
}
```

---

### MCPConnectionStatus

```typescript
interface MCPConnectionStatus {
  connected: boolean;
  error?: string;
  toolCount: number;
}
```

---

## Constants

### DEFAULT_SECURITY_POLICY

```typescript
const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  maxExecutionTime: 30000,  // 30 seconds
  maxMemoryMB: 128,         // 128 MB
  allowNetworkAccess: false,
  allowedDomains: []
};
```

**Usage:**

```typescript
import { DEFAULT_SECURITY_POLICY } from './src/index.js';

const customPolicy = {
  ...DEFAULT_SECURITY_POLICY,
  maxExecutionTime: 60000  // Override just timeout
};
```

---

## Error Handling

All async methods may throw errors. Always wrap in try-catch:

```typescript
try {
  const response = await engine.execute(request);
  // Handle success
} catch (error) {
  console.error('Execution failed:', error.message);
  // Handle error
}
```

### Common Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `Tool 'X' not found` | Tool not registered | Check tool name and registration |
| `Tool execution failed` | Tool threw error | Check tool implementation |
| `Code validation failed` | Dangerous code pattern | Review generated code |
| `Execution timeout` | Code took too long | Increase timeout or optimize code |
| `Failed to connect to MCP server` | Connection issue | Check server URL and status |

---

## Best Practices

### 1. Always Set Timeouts

```typescript
const engine = new CodemodeEngine({
  // ...
  securityPolicy: {
    maxExecutionTime: 10000  // Don't let code run forever
  }
});
```

### 2. Use Strong Types

```typescript
// Good
const tool: Tool<{ name: string }, { greeting: string }> = {
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ greeting: z.string() }),
  execute: async (args) => ({ greeting: `Hello, ${args.name}` })
};
```

### 3. Handle Errors Gracefully

```typescript
const result = await engine.execute(request);
if (!result.result.success) {
  logger.error('Execution failed', result.result.error);
  notifyUser('Something went wrong');
}
```

### 4. Clean Up Resources

```typescript
const client = new MCPClient(config);
try {
  await client.connect();
  // Use client
} finally {
  await client.disconnect();
}
```

---

## Version Compatibility

- **Node.js**: >= 16.0.0
- **TypeScript**: >= 5.0.0
- **isolated-vm**: ^5.0.1
- **MCP SDK**: ^1.20.0

---

## Next Steps

- See [QUICKSTART.md](../QUICKSTART.md) for practical examples
- See [ARCHITECTURE.md](../ARCHITECTURE.md) for system design
- See [examples/](../examples/) for complete working code

