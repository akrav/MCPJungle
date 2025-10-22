# Quick Start Guide

Get up and running with codemode-standalone in 5 minutes.

## Installation

```bash
cd codemode-standalone
npm install
```

## Run Your First Example

```bash
npm run example:basic
```

You should see output like:
```
🚀 Codemode Standalone - Basic Usage Example

[CodemodeEngine] Starting codemode execution...
[Tool] Getting weather for San Francisco
[Tool] Sending low priority notification: It's 75°F in San Francisco - great weather!

✅ Execution Result:
Success: true
Execution Time: 45ms
Result: {
  "weather": { "temperature": 75, ... },
  "temp": 75,
  "sent": true
}
```

## Understanding What Happened

### 1. **Tools Were Defined**
```typescript
const tools = {
  getWeather: { /* ... */ },
  sendNotification: { /* ... */ }
};
```

### 2. **LLM Generated Code**
```javascript
const weather = await tools.getWeather({ location: "San Francisco" });
if (weather.temperature > 70) {
  await tools.sendNotification({ message: "Great weather!" });
}
return { weather, sent: true };
```

### 3. **Code Executed Safely**
- Created isolated V8 environment
- Injected `tools` proxy
- Executed code with security limits
- Returned results

## Your First Custom Implementation

Create a new file `my-first-codemode.ts`:

```typescript
import { CodemodeEngine } from "./src/index.js";
import { z } from "zod";

// Step 1: Define your tools
const myTools = {
  greet: {
    name: "greet",
    description: "Greet a person by name",
    inputSchema: z.object({
      name: z.string(),
    }),
    execute: async (args: { name: string }) => {
      return { message: `Hello, ${args.name}!` };
    },
  },
};

// Step 2: Create a simple code generator (or use a real LLM)
async function generateCode(prompt: string): Promise<string> {
  // For now, return hardcoded code
  // Later, replace with OpenAI/Anthropic API call
  return `
    const result = await tools.greet({ name: "World" });
    return result;
  `;
}

// Step 3: Create the engine
const engine = new CodemodeEngine({
  generateCode,
  tools: myTools,
  verbose: true,
});

// Step 4: Execute!
const response = await engine.execute({
  userRequest: "Greet the world",
});

console.log("Result:", response.result.result);
```

Run it:
```bash
npx tsx my-first-codemode.ts
```

## Next Steps

### 1. Add Real LLM Integration

Install OpenAI SDK:
```bash
npm install openai
```

Update your code generator:
```typescript
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateCode(prompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "Generate JavaScript code. No markdown, just code.",
      },
      { role: "user", content: prompt },
    ],
  });
  return response.choices[0].message.content || "";
}
```

### 2. Connect to MCP Servers

```typescript
import { MCPClient, MCPToolConverter } from "./src/index.js";

// Connect to an MCP server
const client = new MCPClient({
  url: "http://localhost:3000/mcp",
  transport: "sse",
});
await client.connect();

// Convert MCP tools
const converter = new MCPToolConverter();
const mcpTools = converter.convertAllTools(client);

// Use with engine
const engine = new CodemodeEngine({
  generateCode,
  tools: mcpTools,
});
```

### 3. Add Custom Security Policies

```typescript
const engine = new CodemodeEngine({
  generateCode,
  tools,
  securityPolicy: {
    maxExecutionTime: 5000,  // 5 seconds
    maxMemoryMB: 64,          // 64 MB
    allowNetworkAccess: false,
  },
});
```

### 4. Create More Complex Tools

```typescript
const advancedTools = {
  fetchAPI: {
    name: "fetchAPI",
    description: "Fetch data from an API",
    inputSchema: z.object({
      url: z.string().url(),
      method: z.enum(["GET", "POST"]),
    }),
    execute: async (args) => {
      const response = await fetch(args.url, { method: args.method });
      return await response.json();
    },
  },

  processData: {
    name: "processData",
    description: "Process an array of data",
    inputSchema: z.object({
      data: z.array(z.any()),
      operation: z.enum(["sum", "average", "filter"]),
    }),
    execute: async (args) => {
      // Your processing logic
      return { result: "processed data" };
    },
  },
};
```

## Common Patterns

### Pattern 1: Sequential Tool Calls
```javascript
// LLM generates:
const user = await tools.getUser({ id: 123 });
const preferences = await tools.getPreferences({ userId: user.id });
const recommendations = await tools.generateRecommendations({ preferences });
return recommendations;
```

### Pattern 2: Conditional Logic
```javascript
// LLM generates:
const data = await tools.fetchData({ source: "api" });
if (data.length > 100) {
  await tools.summarizeData({ data });
} else {
  await tools.displayAll({ data });
}
```

### Pattern 3: Error Handling
```javascript
// LLM generates:
try {
  const result = await tools.riskyOperation({ params });
  return { success: true, result };
} catch (error) {
  await tools.logError({ error: error.message });
  return { success: false };
}
```

### Pattern 4: Data Transformation
```javascript
// LLM generates:
const rawData = await tools.getData({ source: "db" });
const transformed = rawData.map(item => ({
  id: item.id,
  name: item.full_name.toUpperCase(),
  score: item.value * 100
}));
await tools.saveData({ data: transformed });
return transformed;
```

## Troubleshooting

### Problem: "Cannot find module"
**Solution**: Make sure you've built the project
```bash
npm run build
```

### Problem: "isolated-vm" won't install
**Solution**: Install build tools
```bash
# macOS
xcode-select --install

# Ubuntu/Debian
sudo apt-get install build-essential python3

# Windows
npm install --global windows-build-tools
```

### Problem: Code execution times out
**Solution**: Increase timeout in security policy
```typescript
securityPolicy: {
  maxExecutionTime: 60000, // 60 seconds
}
```

### Problem: Tools not accessible in generated code
**Solution**: Check that tools are registered
```typescript
// Verify tools are registered
console.log(Object.keys(engine.getAllTools()));
```

## Examples Reference

| Example | Description | Run Command |
|---------|-------------|-------------|
| `basic-usage.ts` | Simple tool calling | `npm run example:basic` |
| `with-mcp-server.ts` | MCP integration | `npm run example:mcp` |
| `advanced-llm-integration.ts` | Real LLM setup | `npm run example:advanced` |

## Architecture Overview

```
┌─────────────────────────────────────────┐
│         Your Application                │
│  ┌──────────────────────────────────┐  │
│  │   CodemodeEngine                 │  │
│  │                                  │  │
│  │  Tools → Types → LLM → Execute   │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
           ↓              ↓
    ┌──────────┐    ┌──────────┐
    │   LLM    │    │  Tools   │
    │ (OpenAI) │    │ (Yours)  │
    └──────────┘    └──────────┘
```

## Best Practices

1. **Start Simple**: Begin with 1-2 tools, then expand
2. **Test Tools Independently**: Verify tools work before using with codemode
3. **Use Strong Types**: Leverage Zod schemas for better LLM code generation
4. **Add Descriptions**: Clear descriptions help the LLM generate better code
5. **Set Timeouts**: Always configure reasonable execution limits
6. **Monitor Execution**: Use `verbose: true` during development
7. **Handle Errors**: Tools should handle and report errors gracefully

## Need Help?

- 📖 Read the full [README.md](./README.md)
- 🏗️ Check [ARCHITECTURE.md](./ARCHITECTURE.md) for deep dive
- 🔍 See [COMPARISON.md](./COMPARISON.md) for CF vs Standalone
- 💡 Browse `examples/` directory for more patterns

## What's Next?

Once you're comfortable with the basics:

1. ✅ Integrate with your preferred LLM (OpenAI, Anthropic, etc.)
2. ✅ Connect to MCP servers for rich tool ecosystems
3. ✅ Build custom tools for your use case
4. ✅ Deploy to production with proper security policies
5. ✅ Extend the architecture for your specific needs

Happy coding! 🚀

