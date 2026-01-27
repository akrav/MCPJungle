# Troubleshooting Guide

Solutions to common issues when using codemode-standalone.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Runtime Errors](#runtime-errors)
- [Performance Issues](#performance-issues)
- [Integration Issues](#integration-issues)
- [Debugging Tips](#debugging-tips)
- [Getting Help](#getting-help)

---

## Installation Issues

### Issue: `isolated-vm` Won't Install

**Symptoms**:
```
npm ERR! code 1
npm ERR! path node_modules/isolated-vm
npm ERR! command failed
```

**Cause**: Missing build tools for native modules

**Solution**:

**macOS**:
```bash
xcode-select --install
```

**Ubuntu/Debian**:
```bash
sudo apt-get update
sudo apt-get install -y build-essential python3 make g++
```

**Windows**:
```bash
npm install --global windows-build-tools
# Or install Visual Studio Build Tools manually
```

**Alpine Linux (Docker)**:
```dockerfile
RUN apk add --no-cache python3 make g++
```

---

### Issue: TypeScript Compilation Errors

**Symptoms**:
```
error TS2307: Cannot find module 'X' or its corresponding type declarations.
```

**Solutions**:

1. **Ensure dependencies are installed**:
```bash
rm -rf node_modules package-lock.json
npm install
```

2. **Check TypeScript version**:
```bash
npm list typescript
# Should be >= 5.0.0
```

3. **Verify tsconfig.json**:
```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```

---

### Issue: Module Resolution Errors

**Symptoms**:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
```

**Cause**: ES modules vs CommonJS mismatch

**Solution**:

1. **Check package.json**:
```json
{
  "type": "module"  // Must be set
}
```

2. **Use .js extensions in imports**:
```typescript
// ✅ Good
import { Tool } from "./types/index.js";

// ❌ Bad
import { Tool } from "./types/index";
```

3. **Build before running**:
```bash
npm run build
npx tsx src/your-file.ts
```

---

## Runtime Errors

### Issue: "Tool not found"

**Symptoms**:
```
Error: Tool 'myTool' not found
```

**Causes & Solutions**:

1. **Tool not registered**:
```typescript
// Verify registration
const registry = new ToolRegistry();
registry.registerTool("myTool", myTool);

// Check registration
console.log(registry.getToolNames());
```

2. **Typo in tool name**:
```typescript
// Generated code uses wrong name
await tools.myTol({ ... });  // Typo!

// Check tool names in type definitions
console.log(typeDefinitions);
```

3. **Tools not passed to engine**:
```typescript
const engine = new CodemodeEngine({
  generateCode,
  tools: { myTool }  // Make sure tools are passed
});
```

---

### Issue: Execution Timeout

**Symptoms**:
```
Error: Script execution timed out
```

**Causes & Solutions**:

1. **Tool takes too long**:
```typescript
// Optimize your tool
const tool = {
  execute: async (args) => {
    // Add timeout to external calls
    return await Promise.race([
      externalAPI.call(args),
      timeout(4000)
    ]);
  }
};
```

2. **Infinite loop in generated code**:
```typescript
// Check generated code
console.log(response.code);

// LLM generated:
// while (true) { ... }  // This will timeout
```

3. **Increase timeout**:
```typescript
const engine = new CodemodeEngine({
  // ...
  securityPolicy: {
    maxExecutionTime: 30000  // Increase to 30 seconds
  }
});
```

---

### Issue: Memory Limit Exceeded

**Symptoms**:
```
Error: Isolate was disposed during execution
RangeError: Out of memory
```

**Causes & Solutions**:

1. **Tool returns large data**:
```typescript
// ❌ Bad: Return huge dataset
const tool = {
  execute: async () => {
    return await getAllDataFromDatabase();  // 1GB of data
  }
};

// ✅ Good: Paginate or filter
const tool = {
  execute: async (args) => {
    return await getPagedData(args.page, 100);  // 100 items
  }
};
```

2. **Generated code creates large structures**:
```typescript
// LLM generated:
const bigArray = new Array(10000000);  // Too large!
```

3. **Increase memory limit**:
```typescript
securityPolicy: {
  maxMemoryMB: 256  // Increase limit
}
```

---

### Issue: "Cannot access X before initialization"

**Symptoms**:
```
ReferenceError: Cannot access 'tools' before initialization
```

**Cause**: Incorrect code generation by LLM

**Solution**:

1. **Check generated code**:
```typescript
console.log(response.code);
```

2. **Improve LLM prompt**:
```typescript
const prompt = `
Generate JavaScript code using these rules:
1. Declare variables before using them
2. Use 'const' or 'let', not 'var'
3. Don't reference variables before declaration
`;
```

3. **Validate code before execution**:
```typescript
const validation = executor.validateCode(code);
if (!validation.valid) {
  // Regenerate code
}
```

---

## Performance Issues

### Issue: Slow Type Generation

**Symptoms**: First execution takes 1-2 seconds

**Cause**: Type generation is compute-intensive

**Solutions**:

1. **Type definitions are cached automatically**:
```typescript
// First call: slow
await engine.execute(request1);  // ~1000ms

// Subsequent calls: fast
await engine.execute(request2);  // ~50ms
```

2. **Pre-generate types**:
```typescript
// Trigger type generation once
await engine.execute({ userRequest: "return true" });

// Now all future calls are fast
```

3. **Reduce number of tools**:
```typescript
// Only register tools you need
const essentialTools = {
  tool1: tools.tool1,
  tool2: tools.tool2
  // Don't include unused tools
};
```

---

### Issue: High Memory Usage

**Symptoms**: Process memory grows over time

**Causes & Solutions**:

1. **Isolates not being disposed**:
```typescript
// The library handles this automatically
// But if extending, ensure proper cleanup:

class MyExecutor extends IsolatedExecutor {
  async execute(code: string) {
    const isolate = new ivm.Isolate({ ... });
    try {
      return await super.execute(code);
    } finally {
      isolate.dispose();  // Always dispose
    }
  }
}
```

2. **Tool connections not closed**:
```typescript
const tools = {
  database: {
    execute: async (args) => {
      const conn = await db.connect();
      try {
        return await conn.query(args);
      } finally {
        await conn.close();  // Always close
      }
    }
  }
};
```

3. **Monitor memory**:
```typescript
setInterval(() => {
  const usage = process.memoryUsage();
  console.log(`Heap: ${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  
  if (usage.heapUsed > 500 * 1024 * 1024) {  // 500 MB
    console.warn('High memory usage detected');
  }
}, 10000);
```

---

### Issue: Slow LLM Response

**Symptoms**: Each execution takes 10+ seconds

**Cause**: LLM API latency

**Solutions**:

1. **Use faster model**:
```typescript
// ❌ Slow
model: "gpt-4"

// ✅ Faster
model: "gpt-3.5-turbo"
```

2. **Reduce prompt size**:
```typescript
// Only include relevant type definitions
const relevantTools = filterRelevantTools(request, allTools);
const types = await generateTypes(relevantTools);
```

3. **Cache LLM responses**:
```typescript
const llmCache = new Map();

async function generateCodeWithCache(prompt: string) {
  const hash = hashPrompt(prompt);
  
  if (llmCache.has(hash)) {
    return llmCache.get(hash);
  }
  
  const code = await llm.generate(prompt);
  llmCache.set(hash, code);
  return code;
}
```

---

## Integration Issues

### Issue: MCP Server Won't Connect

**Symptoms**:
```
Error: Failed to connect to MCP server
```

**Causes & Solutions**:

1. **Server not running**:
```bash
# Check if server is running
curl http://localhost:3000/mcp

# Start the server
npm start --prefix path/to/mcp-server
```

2. **Wrong transport type**:
```typescript
// For HTTP servers, use SSE
const client = new MCPClient({
  url: "http://localhost:3000/mcp",
  transport: "sse"  // Not "stdio"
});

// For local processes, use STDIO
const client = new MCPClient({
  url: "npx my-mcp-server",
  transport: "stdio"
});
```

3. **CORS issues** (if browser-based):
```typescript
// Server needs CORS headers
res.setHeader('Access-Control-Allow-Origin', '*');
```

---

### Issue: OpenAI API Errors

**Symptoms**:
```
Error: 429 Rate limit exceeded
Error: 401 Invalid API key
```

**Solutions**:

1. **Invalid API key**:
```bash
# Verify environment variable
echo $OPENAI_API_KEY

# Should start with sk-
```

2. **Rate limits**:
```typescript
// Implement exponential backoff
async function generateWithRetry(prompt: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await openai.chat.completions.create({ ... });
    } catch (error) {
      if (error.status === 429 && i < retries - 1) {
        await sleep(Math.pow(2, i) * 1000);  // 1s, 2s, 4s
        continue;
      }
      throw error;
    }
  }
}
```

3. **Quota exceeded**:
```
# Check your OpenAI account usage
# Add payment method if needed
# Or reduce request frequency
```

---

### Issue: Generated Code Doesn't Work

**Symptoms**: Code executes but doesn't do what user asked

**Causes & Solutions**:

1. **Ambiguous user request**:
```typescript
// ❌ Vague
const request = {
  userRequest: "Do something with the data"
};

// ✅ Clear
const request = {
  userRequest: "Fetch user data for ID 123, filter active users, and return count",
  context: "User wants to see how many active users exist"
};
```

2. **LLM misunderstood tool purpose**:
```typescript
// Improve tool descriptions
const tool = {
  description: "Fetch user by ID. Returns null if user not found. Throws error if database unavailable."
  // Not just: "Get user"
};
```

3. **Missing type information**:
```typescript
// Add output schema for clarity
outputSchema: z.object({
  user: z.object({
    id: z.string(),
    name: z.string()
  }).nullable()
})
```

---

## Debugging Tips

### Enable Verbose Logging

```typescript
const engine = new CodemodeEngine({
  // ...
  verbose: true  // Logs all steps
});
```

### Inspect Generated Code

```typescript
const response = await engine.execute(request);

console.log("=== Generated Code ===");
console.log(response.code);
console.log("=== Type Definitions ===");
console.log(response.typeDefinitions);
console.log("=== Result ===");
console.log(response.result);
```

### Debug Tool Execution

```typescript
const tools = {
  myTool: {
    // ...
    execute: async (args) => {
      console.log("[Tool] Called with:", args);
      
      try {
        const result = await actualWork(args);
        console.log("[Tool] Returning:", result);
        return result;
      } catch (error) {
        console.error("[Tool] Error:", error);
        throw error;
      }
    }
  }
};
```

### Debug Isolate Execution

```typescript
class DebugExecutor extends IsolatedExecutor {
  async execute(code: string) {
    console.log("=== Executing Code ===");
    console.log(code);
    
    const result = await super.execute(code);
    
    console.log("=== Execution Result ===");
    console.log(result);
    
    return result;
  }
}
```

### Use Node.js Debugger

```bash
# Run with debugger
node --inspect-brk dist/your-app.js

# Connect with Chrome DevTools
# chrome://inspect
```

### Check Environment

```typescript
console.log("Node version:", process.version);
console.log("Platform:", process.platform);
console.log("Memory:", process.memoryUsage());
console.log("Environment:", process.env.NODE_ENV);
```

---

## Common Error Messages

| Error Message | Meaning | Solution |
|--------------|---------|----------|
| `Tool 'X' not found` | Tool not registered | Check tool registration |
| `Script execution timed out` | Code took too long | Increase timeout or optimize |
| `Out of memory` | Memory limit exceeded | Increase limit or reduce data |
| `Cannot find module` | Import/build issue | Run `npm run build` |
| `Isolate was disposed` | Isolate cleanup issue | Check async/await usage |
| `Failed to connect` | MCP connection failed | Check server is running |
| `Rate limit exceeded` | API quota hit | Add retry logic |
| `Invalid API key` | LLM auth failed | Check environment variables |

---

## Performance Benchmarks

Expected performance (reference):

| Operation | Time | Notes |
|-----------|------|-------|
| Type generation | 50-200ms | Cached after first call |
| LLM code generation | 1-5s | Depends on API |
| Code execution | 10-500ms | Depends on tools |
| Tool call | 10-1000ms | Depends on tool |
| Total request | 1-10s | End-to-end |

If you're seeing significantly worse performance, investigate.

---

## Getting Help

### Before Asking for Help

1. Check this troubleshooting guide
2. Review relevant documentation
3. Search existing GitHub issues
4. Try enabling verbose logging
5. Create minimal reproduction

### When Asking for Help

Include:

1. **Environment**:
```
Node.js version: X.X.X
npm version: X.X.X
OS: macOS/Linux/Windows
codemode version: X.X.X
```

2. **Error message** (full text)

3. **Code snippet** (minimal reproduction)

4. **What you tried** already

5. **Expected vs actual behavior**

### Where to Ask

- **Bug reports**: GitHub Issues
- **Questions**: GitHub Discussions
- **Security issues**: security@yourcompany.com (private)
- **General chat**: Discord/Slack

---

## Still Having Issues?

1. Create a [minimal reproduction](https://stackoverflow.com/help/minimal-reproducible-example)
2. Open a GitHub issue with all details
3. Be patient and respectful
4. We'll help as soon as possible!

---

**Pro tip**: 90% of issues are solved by:
1. Reading error messages carefully
2. Checking documentation
3. Enabling verbose logging
4. Creating minimal reproductions

Good luck! 🍀

