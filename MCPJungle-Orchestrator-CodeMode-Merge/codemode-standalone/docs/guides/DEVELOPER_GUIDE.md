# Developer Guide

Comprehensive guide for developers working with or extending codemode-standalone.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Writing Tools](#writing-tools)
- [Integrating LLMs](#integrating-llms)
- [Extending the System](#extending-the-system)
- [Testing](#testing)
- [Debugging](#debugging)
- [Performance Optimization](#performance-optimization)
- [Best Practices](#best-practices)

---

## Development Setup

### Prerequisites

```bash
# Required
- Node.js >= 16.0.0
- npm >= 8.0.0

# For building native modules (isolated-vm)
- Python 3.x
- C++ build tools (gcc/clang on Linux/Mac, MSVC on Windows)
```

### Installation

```bash
# Clone and install
cd codemode-standalone
npm install

# Build TypeScript
npm run build

# Verify installation
npm run example:basic
```

### IDE Setup

#### VS Code (Recommended)

Install extensions:
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

Settings (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

---

## Project Structure

### Source Organization

```
src/
├── core/           # Core business logic
│   ├── CodemodeEngine.ts     # Main orchestrator
│   ├── TypeGenerator.ts      # Type generation
│   └── ToolRegistry.ts       # Tool management
│
├── execution/      # Code execution
│   ├── IsolatedExecutor.ts   # V8 isolation
│   ├── ExecutionContext.ts   # Environment
│   └── SecurityPolicy.ts     # Security
│
├── mcp/            # MCP integration
│   ├── MCPClient.ts          # Client
│   ├── MCPToolConverter.ts   # Converter
│   └── types.ts              # Types
│
└── types/          # Shared types
    └── index.ts
```

### Module Dependencies

```
CodemodeEngine
  ↓
TypeGenerator + ToolRegistry + IsolatedExecutor
                                ↓
                        ExecutionContext + SecurityPolicyManager
```

---

## Development Workflow

### 1. Make Changes

```bash
# Watch mode for development
npm run dev

# This will recompile on save
```

### 2. Test Changes

```bash
# Run examples
npm run example:basic
npm run example:mcp
npm run example:advanced

# Or create test file
npx tsx my-test.ts
```

### 3. Build for Production

```bash
npm run build
```

### 4. Check Types

```bash
# TypeScript will check on build
# Or manually:
npx tsc --noEmit
```

---

## Writing Tools

### Basic Tool Structure

```typescript
import { z } from "zod";
import type { Tool } from "./src/types/index.js";

const myTool: Tool = {
  name: "myTool",
  description: "Clear description for the LLM",
  
  // Input schema (Zod or JSON Schema)
  inputSchema: z.object({
    param1: z.string().describe("Description of param1"),
    param2: z.number().optional().describe("Optional param2")
  }),
  
  // Output schema (optional but recommended)
  outputSchema: z.object({
    result: z.string(),
    metadata: z.any().optional()
  }),
  
  // Execution function
  execute: async (args) => {
    // Your tool logic here
    const result = await doSomething(args.param1);
    return { result, metadata: { timestamp: Date.now() } };
  }
};
```

### Tool Best Practices

#### 1. **Clear Descriptions**

```typescript
// ❌ Bad
description: "Gets data"

// ✅ Good
description: "Fetches user profile data from the database by user ID"
```

#### 2. **Strong Input Validation**

```typescript
inputSchema: z.object({
  userId: z.string().uuid().describe("Valid UUID of the user"),
  includeHistory: z.boolean()
    .optional()
    .default(false)
    .describe("Whether to include user's action history")
})
```

#### 3. **Comprehensive Output Types**

```typescript
outputSchema: z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email()
  }),
  history: z.array(z.any()).optional()
})
```

#### 4. **Error Handling**

```typescript
execute: async (args) => {
  try {
    const result = await apiCall(args);
    return { success: true, data: result };
  } catch (error) {
    // Tools should handle errors gracefully
    return {
      success: false,
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    };
  }
}
```

#### 5. **Idempotency**

```typescript
// Tools should be idempotent when possible
execute: async (args) => {
  // Check if already exists
  const existing = await db.findById(args.id);
  if (existing) {
    return existing; // Return existing instead of error
  }
  
  return await db.create(args);
}
```

### Advanced Tool Patterns

#### Stateful Tools

```typescript
class StatefulTool {
  private cache = new Map();
  
  getTool(): Tool {
    return {
      name: "cachedFetch",
      description: "Fetch with caching",
      inputSchema: z.object({ url: z.string() }),
      execute: async (args) => {
        if (this.cache.has(args.url)) {
          return this.cache.get(args.url);
        }
        
        const result = await fetch(args.url);
        const data = await result.json();
        this.cache.set(args.url, data);
        return data;
      }
    };
  }
}

// Usage
const statefulTool = new StatefulTool();
const tools = {
  cachedFetch: statefulTool.getTool()
};
```

#### Async Initialization

```typescript
class DatabaseTool {
  private connection: any;
  
  async initialize() {
    this.connection = await createConnection();
  }
  
  getTool(): Tool {
    return {
      name: "query",
      description: "Query the database",
      inputSchema: z.object({ sql: z.string() }),
      execute: async (args) => {
        if (!this.connection) {
          throw new Error("Tool not initialized");
        }
        return await this.connection.query(args.sql);
      }
    };
  }
}

// Usage
const dbTool = new DatabaseTool();
await dbTool.initialize();

const engine = new CodemodeEngine({
  tools: { query: dbTool.getTool() }
});
```

---

## Integrating LLMs

### OpenAI Integration

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function generateCodeWithOpenAI(prompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are a code-generating AI. Generate ONLY JavaScript code.
Rules:
- No markdown formatting
- No code blocks
- No explanations
- Use async/await
- Return final result with 'return' statement`
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.2,  // Lower = more consistent
    max_tokens: 1000
  });
  
  let code = response.choices[0].message.content || "";
  
  // Clean up any markdown that sneaks through
  code = code.replace(/```javascript\n?/g, "");
  code = code.replace(/```\n?/g, "");
  code = code.trim();
  
  return code;
}

// Use with engine
const engine = new CodemodeEngine({
  generateCode: generateCodeWithOpenAI,
  tools
});
```

### Anthropic Integration

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function generateCodeWithClaude(prompt: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1000,
    system: `You are a code generator. Output ONLY JavaScript code, nothing else.`,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ]
  });
  
  const content = response.content[0];
  if (content.type === "text") {
    return content.text.trim();
  }
  
  throw new Error("Unexpected response format");
}
```

### Prompt Engineering Tips

#### 1. **Be Explicit About Output Format**

```typescript
const systemPrompt = `
Generate JavaScript code that:
1. Uses the 'tools' object to call functions
2. Uses async/await syntax
3. Returns the final result
4. Does NOT use require() or import
5. Does NOT wrap code in functions
6. Does NOT include markdown formatting
`;
```

#### 2. **Provide Examples in Prompt**

```typescript
const promptWithExamples = `
${basePrompt}

Example:
const weather = await tools.getWeather({ location: "NYC" });
return { temperature: weather.temp };

Now generate code for: ${userRequest}
`;
```

#### 3. **Include Type Information**

The system automatically includes type definitions, but you can emphasize them:

```typescript
const enhancedPrompt = `
${basePrompt}

IMPORTANT: Use the provided TypeScript definitions for correct types.
${typeDefinitions}

User request: ${userRequest}
`;
```

---

## Extending the System

### Adding Custom Execution Environment

Create a new executor that implements the execution interface:

```typescript
import type { ExecutionResult } from "./src/types/index.js";

export class CustomExecutor {
  constructor(
    private toolRegistry: ToolRegistry,
    private securityPolicy: SecurityPolicyManager
  ) {}
  
  async execute<T = any>(code: string): Promise<ExecutionResult<T>> {
    const startTime = Date.now();
    
    try {
      // Your custom execution logic
      const result = await this.customExecute(code);
      
      return {
        success: true,
        result,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          stack: error.stack
        },
        executionTime: Date.now() - startTime
      };
    }
  }
  
  private async customExecute(code: string): Promise<any> {
    // Implement your execution strategy
    // Examples: WebAssembly, Deno, different isolation
  }
}
```

### Adding Observability

Extend the engine with event emitters:

```typescript
import { EventEmitter } from "events";
import { CodemodeEngine } from "./src/index.js";

export class ObservableCodemodeEngine extends CodemodeEngine {
  private events = new EventEmitter();
  
  on(event: string, handler: (...args: any[]) => void) {
    this.events.on(event, handler);
    return this;
  }
  
  async execute(request: CodemodeRequest) {
    this.events.emit("execution:start", {
      timestamp: Date.now(),
      request
    });
    
    try {
      const result = await super.execute(request);
      
      this.events.emit("execution:complete", {
        timestamp: Date.now(),
        request,
        result
      });
      
      return result;
    } catch (error) {
      this.events.emit("execution:error", {
        timestamp: Date.now(),
        request,
        error
      });
      throw error;
    }
  }
}

// Usage
const engine = new ObservableCodemodeEngine(options);

engine.on("execution:start", (data) => {
  console.log("Started:", data.request.userRequest);
});

engine.on("execution:complete", (data) => {
  console.log("Completed in:", data.result.result.executionTime, "ms");
});
```

### Adding Result Caching

```typescript
import { CodemodeEngine, CodemodeRequest, CodemodeResponse } from "./src/index.js";

export class CachedCodemodeEngine extends CodemodeEngine {
  private cache = new Map<string, CodemodeResponse>();
  
  async execute(request: CodemodeRequest): Promise<CodemodeResponse> {
    const cacheKey = this.getCacheKey(request);
    
    if (this.cache.has(cacheKey)) {
      console.log("Cache hit!");
      return this.cache.get(cacheKey)!;
    }
    
    const result = await super.execute(request);
    this.cache.set(cacheKey, result);
    
    return result;
  }
  
  private getCacheKey(request: CodemodeRequest): string {
    return JSON.stringify({
      request: request.userRequest,
      context: request.context,
      tools: Object.keys(this.toolRegistry.getAllTools()).sort()
    });
  }
  
  clearCache() {
    this.cache.clear();
  }
}
```

---

## Testing

### Unit Testing Setup

```typescript
// test/tool-registry.test.ts
import { describe, it, expect } from "vitest";
import { ToolRegistry } from "../src/core/ToolRegistry";
import { z } from "zod";

describe("ToolRegistry", () => {
  it("should register and retrieve tools", () => {
    const registry = new ToolRegistry();
    
    const tool = {
      name: "test",
      description: "Test tool",
      inputSchema: z.object({}),
      execute: async () => ({ result: "success" })
    };
    
    registry.registerTool("test", tool);
    
    expect(registry.hasTool("test")).toBe(true);
    expect(registry.getTool("test")).toBe(tool);
  });
  
  it("should throw on duplicate registration", () => {
    const registry = new ToolRegistry();
    const tool = { /* ... */ };
    
    registry.registerTool("test", tool);
    
    expect(() => {
      registry.registerTool("test", tool);
    }).toThrow("already registered");
  });
});
```

### Integration Testing

```typescript
// test/integration.test.ts
import { CodemodeEngine } from "../src/index";
import { z } from "zod";

describe("CodemodeEngine Integration", () => {
  it("should execute simple tool call", async () => {
    const tools = {
      add: {
        name: "add",
        description: "Add two numbers",
        inputSchema: z.object({
          a: z.number(),
          b: z.number()
        }),
        execute: async (args) => ({ result: args.a + args.b })
      }
    };
    
    const engine = new CodemodeEngine({
      generateCode: async (prompt) => {
        return `
          const result = await tools.add({ a: 5, b: 3 });
          return result.result;
        `;
      },
      tools
    });
    
    const response = await engine.execute({
      userRequest: "Add 5 and 3"
    });
    
    expect(response.result.success).toBe(true);
    expect(response.result.result).toBe(8);
  });
});
```

---

## Debugging

### Enable Verbose Logging

```typescript
const engine = new CodemodeEngine({
  // ...
  verbose: true  // Logs all steps
});
```

### Debug Generated Code

```typescript
const response = await engine.execute(request);

console.log("Generated Code:");
console.log(response.code);

console.log("\nType Definitions:");
console.log(response.typeDefinitions);
```

### Debug Tool Execution

```typescript
const tools = {
  myTool: {
    // ...
    execute: async (args) => {
      console.log("Tool called with:", args);
      const result = await doSomething(args);
      console.log("Tool returning:", result);
      return result;
    }
  }
};
```

### Debug Isolate Errors

```typescript
const result = await engine.execute(request);

if (!result.result.success) {
  console.error("Execution failed:");
  console.error("Message:", result.result.error?.message);
  console.error("Stack:", result.result.error?.stack);
  console.error("Generated code:", result.code);
}
```

---

## Performance Optimization

### 1. Cache Type Definitions

Type definitions are automatically cached, but you can precompute them:

```typescript
const engine = new CodemodeEngine(options);

// Trigger type generation
await engine.execute({ userRequest: "return true" });

// Now subsequent calls are faster
```

### 2. Reuse Tool Connections

```typescript
class ConnectionPool {
  private connections = new Map();
  
  async getConnection(key: string) {
    if (!this.connections.has(key)) {
      this.connections.set(key, await createConnection());
    }
    return this.connections.get(key);
  }
}

const pool = new ConnectionPool();

const tools = {
  query: {
    execute: async (args) => {
      const conn = await pool.getConnection("db");
      return await conn.query(args.sql);
    }
  }
};
```

### 3. Batch Operations

```typescript
// Instead of multiple executions
for (const item of items) {
  await engine.execute({ userRequest: `Process ${item}` });
}

// Batch in one execution
await engine.execute({
  userRequest: `Process all items: ${items.join(", ")}`
});
```

### 4. Optimize Security Policy

```typescript
// Don't make timeout too high
securityPolicy: {
  maxExecutionTime: 5000,  // Just enough
  maxMemoryMB: 64          // Only what you need
}
```

---

## Best Practices

### 1. **Always Validate Input**

```typescript
const tool = {
  execute: async (args) => {
    // Validate even though schema does too
    if (!args.userId || typeof args.userId !== "string") {
      throw new Error("Invalid userId");
    }
    // ...
  }
};
```

### 2. **Use TypeScript Generics**

```typescript
interface UserData {
  id: string;
  name: string;
}

const response = await engine.execute<UserData>({
  userRequest: "Get user data"
});

// response.result.result is typed as UserData
```

### 3. **Handle Cleanup**

```typescript
class ResourceManager {
  private resources: any[] = [];
  
  addResource(resource: any) {
    this.resources.push(resource);
  }
  
  async cleanup() {
    for (const resource of this.resources) {
      await resource.close();
    }
  }
}

const manager = new ResourceManager();

try {
  // Use resources
} finally {
  await manager.cleanup();
}
```

### 4. **Document Your Tools**

```typescript
/**
 * Fetches user profile from the database
 * 
 * @param userId - UUID of the user
 * @returns User profile with full details
 * @throws {Error} If user not found
 */
const getUserTool = {
  name: "getUser",
  description: "Fetch user profile by ID",
  // ...
};
```

### 5. **Monitor Resource Usage**

```typescript
const response = await engine.execute(request);

console.log(`Execution took ${response.result.executionTime}ms`);

if (response.result.executionTime > 5000) {
  console.warn("Slow execution detected!");
}
```

---

## Next Steps

- See [API_REFERENCE.md](./API_REFERENCE.md) for detailed API docs
- See [SECURITY.md](./SECURITY.md) for security guidelines
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment guide
- Join discussions or contribute on GitHub

