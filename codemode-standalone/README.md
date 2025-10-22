# Codemode Standalone

A modular, scalable implementation of LLM-generated code execution with MCP (Model Context Protocol) integration. This is a Cloudflare-independent version of the codemode pattern that can run in any Node.js environment.

## 🎯 What is Codemode?

Codemode is a pattern where instead of having an LLM directly call predefined tools, you have the LLM **generate JavaScript code** that orchestrates multiple tool calls with complex logic. This is particularly powerful for:

- **Complex workflows** that require multiple tool calls
- **Conditional logic** based on tool results
- **Data transformation** between tool calls
- **Error handling and retry logic**
- **MCP server orchestration** across multiple services

## 🏗️ Architecture

This implementation is designed with modularity and scalability in mind:

```
src/
├── core/
│   ├── CodemodeEngine.ts      # Main orchestrator
│   ├── TypeGenerator.ts       # Generates TS types from tool schemas
│   └── ToolRegistry.ts        # Manages tool lifecycle
├── execution/
│   ├── IsolatedExecutor.ts    # Secure code execution using isolated-vm
│   ├── ExecutionContext.ts    # Execution environment setup
│   └── SecurityPolicy.ts      # Security constraints and policies
├── mcp/
│   ├── MCPClient.ts           # MCP server connection
│   ├── MCPToolConverter.ts    # Converts MCP tools to internal format
│   └── types.ts               # MCP-specific types
└── types/
    └── index.ts               # Shared TypeScript types
```

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Basic Usage

```typescript
import { CodemodeEngine } from "./src/index.js";
import { z } from "zod";

// Define your tools
const tools = {
  getWeather: {
    name: "getWeather",
    description: "Get weather for a location",
    inputSchema: z.object({
      location: z.string(),
    }),
    execute: async (args) => {
      return { temperature: 75, condition: "sunny" };
    },
  },
};

// Create engine
const engine = new CodemodeEngine({
  generateCode: async (prompt) => {
    // Call your LLM here (OpenAI, Anthropic, etc.)
    return generatedCode;
  },
  tools,
  securityPolicy: {
    maxExecutionTime: 5000,
    maxMemoryMB: 64,
  },
});

// Execute a request
const response = await engine.execute({
  userRequest: "What's the weather in San Francisco?",
});

console.log(response.result);
```

### With MCP Servers

```typescript
import { CodemodeEngine, MCPClient, MCPToolConverter } from "./src/index.js";

// Connect to MCP server
const mcpClient = new MCPClient({
  url: "http://localhost:3000/mcp",
  transport: "sse",
});
await mcpClient.connect();

// Convert MCP tools
const converter = new MCPToolConverter();
const mcpTools = converter.convertAllTools(mcpClient);

// Use with codemode engine
const engine = new CodemodeEngine({
  generateCode: yourLLMFunction,
  tools: mcpTools,
});
```

### Hot-Reload Pattern (Vercel-Style Development)

The system supports dynamic tool updates, allowing agents to modify code and immediately test it:

```typescript
// Initial setup
const mockServer = new MockMCPServer({ port: 3456 });
await mockServer.startServer();

// Agent detects a bug and wants to fix it
mockServer.registerTool({
  name: "calculate",
  description: "Fixed calculation tool",
  inputSchema: { /* ... */ },
  handler: async (args) => {
    // Updated implementation
    return { result: eval(args.expression) };
  },
});

// Tools are immediately available - no restart needed!
const updatedTools = converter.convertAllTools(mcpClient);
const newEngine = new CodemodeEngine({
  generateCode: yourLLMFunction,
  tools: updatedTools,
});

// Agent can now test the fixed tool
const result = await newEngine.execute({
  userRequest: "Calculate 2 + 2",
});
```

This pattern enables:
- **Agent self-improvement**: Fix bugs in tool implementations
- **Rapid iteration**: Test changes immediately
- **Dynamic tool creation**: Add new capabilities on the fly

## 🔒 Security

The isolated execution environment provides multiple layers of security:

- **Memory limits**: Configurable maximum memory per execution
- **Timeout limits**: Automatic termination of long-running code
- **No file system access**: Code cannot access the file system
- **No network access**: Configurable network restrictions
- **Process isolation**: Code runs in a separate V8 isolate

### Security Policy Configuration

```typescript
const engine = new CodemodeEngine({
  // ...
  securityPolicy: {
    maxExecutionTime: 30000,  // 30 seconds max
    maxMemoryMB: 128,          // 128 MB max
    allowNetworkAccess: false, // No network by default
    allowedDomains: ['api.example.com'], // Optional whitelist
  },
});
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:mcp          # MCP integration tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
```

**Test Coverage**: 91 tests across 8 test suites, 100% passing

See **[MCP Testing Guide](docs/guides/MCP_TESTING.md)** for detailed information about testing strategies and the hot-reload pattern.

## 📋 Examples

```bash
# Core Examples
npm run example:basic                  # Basic usage example
npm run example:mcp                    # MCP integration example  
npm run example:advanced               # Advanced LLM integration

# Anthropic Claude Examples (Recommended)
npm run example:code-only              # Production pattern (code-only execution)
npm run example:tool-calling           # Basic tool calling example
npm run example:anthropic:advanced     # Advanced features & cost tracking
```

See **[Quick Start Guide](docs/getting-started/QUICKSTART.md)** and **[LLM Examples](examples/llm/)** for detailed tutorials.

## 🔄 Cloudflare Version Comparison

This is a standalone implementation that works in any Node.js environment, independent of Cloudflare infrastructure.

| Feature | Cloudflare | Standalone |
|---------|-----------|------------|
| **Execution** | Workers (proprietary) | isolated-vm (open source) |
| **Deployment** | Cloudflare only | Any Node.js environment |
| **MCP Integration** | ✅ Via SDK | ✅ Via SDK |
| **Type Generation** | ✅ | ✅ Same approach |

See **[Comparison Guide](docs/guides/COMPARISON.md)** for detailed differences and migration guidance.

## 🧩 Modular Design

Each component is designed to be independently usable:

### ToolRegistry
Manages tools and their execution independently of the engine.

```typescript
const registry = new ToolRegistry();
registry.registerTool("myTool", toolDefinition);
await registry.executeTool("myTool", args);
```

### TypeGenerator
Generates TypeScript definitions from Zod or JSON schemas.

```typescript
const generator = new TypeGenerator();
const types = await generator.generateTypeDefinitions(tools);
```

### IsolatedExecutor
Executes code in a secure sandbox.

```typescript
const executor = new IsolatedExecutor(toolRegistry, securityPolicy);
const result = await executor.execute(code);
```

### MCPClient
Connects to and manages MCP servers.

```typescript
const client = new MCPClient(config);
await client.connect();
const tools = client.getTools();
```

## 🔧 Configuration Options

### CodemodeEngine Options

```typescript
interface CodemodeOptions {
  generateCode: (prompt: string) => Promise<string>;
  tools: ToolSet;
  securityPolicy?: Partial<SecurityPolicy>;
  verbose?: boolean;
}
```

### SecurityPolicy Options

```typescript
interface SecurityPolicy {
  maxExecutionTime: number;    // milliseconds
  maxMemoryMB: number;          // megabytes
  allowNetworkAccess: boolean;
  allowedDomains?: string[];    // optional whitelist
}
```

## 📚 Type Definitions

The system automatically generates TypeScript type definitions for all tools, which are provided to the LLM to help it generate correctly-typed code. This includes:

- Input parameter types
- Output/return types
- JSDoc comments with descriptions
- Enum types and constraints

## 🤝 Integrating with LLMs

### Anthropic Claude (Built-in) ✅

The system includes production-ready support for Anthropic's Claude models with tool calling:

```typescript
import { ToolCallingEngine } from "codemode-standalone";
import { z } from "zod";

// Define your tools
const tools = {
  calculate: {
    name: "calculate",
    description: "Perform calculations",
    inputSchema: z.object({
      expression: z.string(),
    }),
    execute: async (args) => {
      return { result: eval(args.expression) };
    },
  },
};

// Create engine (API key from ANTHROPIC_API_KEY env var)
const engine = new ToolCallingEngine({
  tools,
  enableCodeExecution: true,
});

// Execute natural language requests
const result = await engine.execute({
  userRequest: "What is 25 * 4?",
});

console.log(result.result);      // "100"
console.log(result.cost);         // 0.0042
console.log(result.totalTokens);  // 1250
```

**Quick Start:**
```bash
# Set your API key
export ANTHROPIC_API_KEY=sk-ant-api03-...

# Run examples
npm run example:code-only        # Production pattern
npm run example:tool-calling     # Basic example
```

See **[LLM Integration Guide](docs/guides/LLM_INTEGRATION.md)** for complete documentation and **[examples/llm/](examples/llm/)** for working examples.

### Other LLMs

You can integrate any LLM by providing a `generateCode` function:

```typescript
async function generateCode(prompt: string): Promise<string> {
  // Call your LLM API here (OpenAI, etc.)
  const response = await yourLLM.generate(prompt);
  return response.code;
}
```

## 📚 Documentation

Complete documentation is available in the **[docs/](docs/)** directory organized by topic and role.

### 🚀 Getting Started - New to Codemode?

Start here in order:

1. **[Quick Start](docs/getting-started/QUICKSTART.md)** (5 minutes) - Install and run your first example
2. **[Architecture Overview](docs/getting-started/ARCHITECTURE.md)** (30 minutes) - Deep dive into system design
3. **[Developer Guide](docs/guides/DEVELOPER_GUIDE.md)** (1-2 hours) - Development best practices

### 📖 Documentation by Role

#### 👨‍💻 For Developers
**Building with Codemode**:
- [Quick Start](docs/getting-started/QUICKSTART.md) - Get up and running
- [Architecture](docs/getting-started/ARCHITECTURE.md) - Understand the system
- [LLM Integration Guide](docs/guides/LLM_INTEGRATION.md) - Integrate LLMs (Anthropic Claude)
- [Developer Guide](docs/guides/DEVELOPER_GUIDE.md) - Best practices
- [API Reference](docs/reference/API_REFERENCE.md) - Complete API docs

**Testing**:
- [MCP Testing Guide](docs/guides/MCP_TESTING.md) - Test MCP integration
- [Developer Guide: Testing](docs/guides/DEVELOPER_GUIDE.md#testing) - General testing

#### 🔧 For DevOps Engineers
- [Deployment Guide](docs/operations/DEPLOYMENT.md) - Production deployment
- [Security Guide](docs/operations/SECURITY.md) - Secure your deployment
- [Troubleshooting](docs/operations/TROUBLESHOOTING.md) - Common issues

#### 🏗️ For Architects
- [Architecture](docs/getting-started/ARCHITECTURE.md) - System design
- [File Structure](docs/guides/FILE_STRUCTURE.md) - Navigate the codebase
- [Comparison](docs/guides/COMPARISON.md) - Cloudflare vs Standalone

#### 🤝 For Contributors
- [Contributing Guide](CONTRIBUTING.md) - How to contribute
- [Developer Guide](docs/guides/DEVELOPER_GUIDE.md) - Development setup
- [File Structure](docs/guides/FILE_STRUCTURE.md) - Understand the codebase

### 🎯 Quick Links by Task

| I want to... | Go to... |
|--------------|----------|
| **Get started in 5 minutes** | [Quick Start](docs/getting-started/QUICKSTART.md) |
| **Understand the architecture** | [Architecture](docs/getting-started/ARCHITECTURE.md) |
| **Integrate an LLM** | [LLM Integration Guide](docs/guides/LLM_INTEGRATION.md) |
| **Test MCP integration** | [MCP Testing Guide](docs/guides/MCP_TESTING.md) |
| **Compare with Cloudflare** | [Comparison Guide](docs/guides/COMPARISON.md) |
| **Find an API method** | [API Reference](docs/reference/API_REFERENCE.md) |
| **Deploy to production** | [Deployment Guide](docs/operations/DEPLOYMENT.md) |
| **Secure my deployment** | [Security Guide](docs/operations/SECURITY.md) |
| **Fix an issue** | [Troubleshooting](docs/operations/TROUBLESHOOTING.md) |
| **Contribute code** | [Contributing](CONTRIBUTING.md) |
| **Navigate the codebase** | [File Structure](docs/guides/FILE_STRUCTURE.md) |

### 📑 Complete Documentation Index

**Getting Started**
- [Quick Start](docs/getting-started/QUICKSTART.md) - 5-minute tutorial
- [Architecture](docs/getting-started/ARCHITECTURE.md) - System design deep dive

**Guides**
- [Developer Guide](docs/guides/DEVELOPER_GUIDE.md) - Development best practices
- [LLM Integration Guide](docs/guides/LLM_INTEGRATION.md) - Integrate Anthropic Claude and other LLMs
- [MCP Testing Guide](docs/guides/MCP_TESTING.md) - Testing MCP integration
- [Comparison Guide](docs/guides/COMPARISON.md) - Cloudflare vs Standalone
- [File Structure](docs/guides/FILE_STRUCTURE.md) - Navigate the codebase

**Reference**
- [API Reference](docs/reference/API_REFERENCE.md) - Complete API documentation

**Operations**
- [Deployment Guide](docs/operations/DEPLOYMENT.md) - Production deployment
- [Security Guide](docs/operations/SECURITY.md) - Security guidelines
- [Troubleshooting](docs/operations/TROUBLESHOOTING.md) - Common issues and solutions

## 🛣️ Roadmap

**Completed**:
- ✅ Core engine with isolated execution
- ✅ MCP integration and testing (Phase 1)
- ✅ Hot-reload pattern support
- ✅ Anthropic Claude integration with tool calling (Phase 2)
- ✅ Code-only execution pattern
- ✅ Comprehensive test suite (91 tests, 100% passing)
- ✅ Cost tracking and monitoring
- ✅ Production-ready LLM integration

**In Progress**:
- 🔄 OpenAI integration
- 🔄 Enhanced observability dashboard

**Planned**:
- [ ] Prompt engineering guide
- [ ] Tool call result caching
- [ ] Python code execution support
- [ ] Support for other runtimes (Deno, Bun)
- [ ] Streaming execution results

## 📄 License

MIT

## 🙏 Acknowledgments

This implementation is inspired by Cloudflare's Agents framework and adapts their codemode pattern for use in standard Node.js environments. It uses:

- `isolated-vm` for secure code execution
- `@modelcontextprotocol/sdk` for MCP integration
- `json-schema-to-typescript` and `zod-to-ts` for type generation
- Vercel's AI SDK patterns for tool definitions

## 🐛 Troubleshooting

### "Cannot find module" errors

Make sure you've built the project:
```bash
npm run build
```

### isolated-vm installation issues

`isolated-vm` requires native compilation. Ensure you have:
- Node.js development headers
- Python (for node-gyp)
- C++ build tools

### MCP connection failures

- Verify the MCP server is running
- Check the URL and transport type
- Ensure network access is allowed in security policy

## 💬 Contributing

Contributions are welcome! See **[CONTRIBUTING.md](CONTRIBUTING.md)** for guidelines on how to contribute to this project.

