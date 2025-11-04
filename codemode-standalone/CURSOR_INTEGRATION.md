# Cursor Codemode Integration Guide

## ✅ Server Status

Your **Codemode MCP Server** is now running at: **`http://localhost:3457/mcp`**

This server exposes the codemode execution engine as an MCP tool, allowing Cursor to execute complex LLM-generated code workflows.

## 🎯 Integration Steps for Cursor

Note: If you are using the unified Orchestrator + MCPJungle gateway, these codemode tools are also available at your orchestrator endpoint (e.g., `http://localhost:8080/mcp`) when `CODEMODE_ENABLED=true`. You can point Cursor to the orchestrator URL instead of the standalone Codemode server.

### Step 1: Open Cursor Settings

1. Open Cursor
2. Go to **Settings** (Cmd+,)
3. Navigate to **Features** → **MCP**

### Step 2: Add MCP Server

Add the following configuration to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "codemode": {
      "url": "http://localhost:3457/mcp",
      "transport": "sse"
    }
  }
}
```

Or if Cursor uses a different format, try:

```json
{
  "servers": {
    "codemode": {
      "command": "node",
      "args": [],
      "url": "http://localhost:3457/mcp",
      "transport": "sse"
    }
  }
}
```

### Step 3: Test the Connection

Once added, Cursor should show:
- ✅ Connected to `codemode`
- 🔧 3 tools available: `executeCode`, `executeCodeWithTools`, and `listAvailableTools`

## 🔧 Available Tools

Your Codemode MCP server exposes these powerful tools:

### 1. `executeCode` (Full Codemode Pattern with LLM)
**The main codemode execution tool** - Takes natural language requests and automatically generates and executes code.

```typescript
{
  userRequest: string  // Natural language description of what to accomplish
}
```

**How it works:**
1. Your Cursor agent sends a natural language request
2. The codemode engine uses Claude to generate JavaScript code
3. Code is executed in a secure isolated environment
4. Code can call internal tools: calculate, searchWeb, getDateTime, formatData
5. Results are returned to Cursor

**Example request:**
```
"Calculate 25 * 4, then get the current date and time, and format the results as JSON"
```

**Note**: Requires `ANTHROPIC_API_KEY` environment variable to be set.

### 2. `executeCodeWithTools` (Direct Code Execution)
**Direct code execution** - You provide the JavaScript code, it gets executed with access to tools.

```typescript
{
  code: string  // JavaScript code to execute
}
```

**Available tools in code:**
Use the `listAvailableTools` tool to get a complete list of available tools with their inputs, outputs, and examples. Currently includes:
- `tools.calculate({ expression: string })` - Perform math calculations
- `tools.searchWeb({ query: string })` - Search the web (mocked)
- `tools.getDateTime({})` - Get current date/time
- `tools.formatData({ data: any, format: "json"|"table"|"csv" })` - Format data

**Example code:**
```javascript
const calc = await tools.calculate({ expression: "25 * 4" });
const time = await tools.getDateTime({});
return { result: calc.result, timestamp: time.iso };
```

### 3. `listAvailableTools` (Tool Discovery)
**Get descriptions of all available JavaScript tools** - Returns comprehensive information about all tools that can be used in `executeCode` and `executeCodeWithTools`.

```typescript
{
  // No parameters required
}
```

**Returns:**
```json
{
  "tools": [
    {
      "name": "calculate",
      "description": "...",
      "inputs": { ... },
      "outputs": { ... },
      "example": "await tools.calculate({ expression: '2 + 2' })"
    },
    ...
  ],
  "usage": {
    "note": "All tools are accessed through the 'tools' object",
    "pattern": "await tools.toolName({ ...arguments })",
    "async": "All tools are asynchronous and return Promises"
  }
}
```

**Use this to:**
- Discover what tools are available before writing code
- Get accurate parameter names and types
- See output formats and examples
- Learn the correct usage patterns

## 🧪 Testing in Cursor

Once connected, try these test prompts:

### Test 0: Discover Available Tools
```
"Use the listAvailableTools tool to show me what JavaScript tools are available"
```

### Test 1: Simple Calculation
```
"Use the executeCode tool to calculate 125 * 8 and format the result"
```

### Test 2: Multi-Step Workflow
```
"Use executeCode to: 
1. Calculate 50 * 2
2. Get the current date and time
3. Search the web for 'artificial intelligence'
4. Format all results as JSON"
```

### Test 3: Direct Code Execution
```
"Use executeCodeWithTools with this code:
const result = await tools.calculate({ expression: '100 + 50' });
const time = await tools.getDateTime({});
return { calculation: result.result, timestamp: time.formatted };"
```

### Test 4: Complex Logic
```
"Use executeCode to calculate 10 * 5, then if the result is greater than 40, 
search the web for 'machine learning', otherwise search for 'basic math'"
```

## 📊 Server Management

### Check Server Status
```bash
curl http://localhost:3457/health
```

Response:
```json
{
  "status": "ok",
  "service": "codemode-mcp",
  "anthropic_configured": true/false
}
```

### Stop the Server
Press `Ctrl+C` in the terminal where the server is running, or:
```bash
pkill -f "start-codemode-mcp-server"
```

### Restart the Server
```bash
cd /Users/jonahdeykin/Downloads/agents-main/codemode-standalone
npm run mcp:codemode
```

### Configure Anthropic API Key
The `executeCode` tool requires Claude. Set your API key:
```bash
export ANTHROPIC_API_KEY=sk-ant-api03-...
```

Or create a `.env` file:
```bash
echo "ANTHROPIC_API_KEY=sk-ant-api03-..." > .env
```

Then restart the server.

## 🎨 Architecture

```
┌──────────────────────┐
│      Cursor          │
│   (MCP Client)       │
└──────────┬───────────┘
           │ SSE/HTTP
           │
           ▼
┌──────────────────────────────────┐
│   Codemode MCP Server            │
│   localhost:3457                 │
│                                  │
│   Tools:                         │
│   • executeCode                  │
│   • executeCodeWithTools         │
│   • listAvailableTools           │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│   Codemode Engine                │
│                                  │
│   ┌─────────────┐               │
│   │ Claude LLM  │ (for          │
│   │ (Anthropic) │  executeCode) │
│   └──────┬──────┘               │
│          │                       │
│          ▼                       │
│   ┌─────────────────┐           │
│   │ Code Generator  │           │
│   └──────┬──────────┘           │
│          │                       │
│          ▼                       │
│   ┌─────────────────┐           │
│   │ isolated-vm     │           │
│   │ (Secure Sandbox)│           │
│   └──────┬──────────┘           │
│          │                       │
│          ▼                       │
│   ┌─────────────────┐           │
│   │  Tool Registry  │           │
│   │                 │           │
│   │  • calculate    │           │
│   │  • searchWeb    │           │
│   │  • getDateTime  │           │
│   │  • formatData   │           │
│   └─────────────────┘           │
└──────────────────────────────────┘
```

## 🔒 Security Notes

This is a **development/testing server**. For production use:
- ✅ Add authentication
- ✅ Implement rate limiting
- ✅ Validate all inputs
- ✅ Run tools in isolated environments
- ✅ Use HTTPS instead of HTTP

## 🐛 Troubleshooting

### "Connection failed"
- ✅ Check server is running: `curl http://localhost:3457/health`
- ✅ Verify port 3457 is not blocked by firewall
- ✅ Check Cursor MCP settings are correct
- ✅ Ensure URL is exactly `http://localhost:3457/mcp` (note port 3457)

### "Tools not showing up"
- ✅ Restart Cursor after adding the MCP server
- ✅ Check Cursor logs for connection errors
- ✅ Verify the transport type is "sse" or "SSE"
- ✅ Look for all 3 tools: `executeCode`, `executeCodeWithTools`, and `listAvailableTools`
- ✅ If you only see 2 tools, restart Cursor completely (not just reload) to clear the cache

### "executeCode fails with API key error"
- ✅ Set `ANTHROPIC_API_KEY` environment variable
- ✅ Check `.env` file exists with valid API key
- ✅ Restart the server after setting the API key
- ✅ Alternatively, use `executeCodeWithTools` which doesn't need an API key

### "Code execution timeout"
- ✅ Default timeout is 10 seconds
- ✅ Complex operations may need optimization
- ✅ Check server logs for detailed error messages

### "Tool not found in generated code"
- ✅ Ensure you're using the correct tool names: calculate, searchWeb, getDateTime, formatData
- ✅ Tools are accessed via `tools.toolName({ args })`
- ✅ All tool calls must be awaited: `await tools.calculate(...)`

## 📚 Next Steps

1. **Integrate with Anthropic Claude**: See `examples/llm/` for examples
2. **Add Custom Tools**: Modify `tests/mocks/MockMCPServer.ts`
3. **Test Agent Workflows**: Use the hot-reload pattern to test agent self-improvement
4. **Deploy to Production**: See `docs/operations/DEPLOYMENT.md`

## 💡 Example Agentic Workflows

Try these prompts in Cursor to test the full agentic system:

### Workflow 1: Data Processing Pipeline
```
"Use executeCode to:
1. Calculate the sum of 100 and 250
2. Calculate 10% of that result
3. Get the current timestamp
4. Search the web for 'data processing'
5. Format everything as a structured report in JSON"
```

### Workflow 2: Conditional Logic
```
"Use executeCode to calculate 150 * 3. If the result is greater than 400, 
get the current date/time and search for 'high performance computing'. 
If it's less than or equal to 400, search for 'basic computing'. 
Format the final results nicely."
```

### Workflow 3: Multiple Calculations
```
"Use executeCode to:
- Calculate 25 squared
- Calculate the square root of 144
- Calculate 2 to the power of 8
- Sum all three results
- Format as a table"
```

### Workflow 4: Direct Code (No LLM)
```
"Use executeCodeWithTools to run this code:
const nums = [10, 20, 30, 40, 50];
const results = [];
for (const num of nums) {
  const calc = await tools.calculate({ expression: num + ' * 2' });
  results.push(calc.result);
}
const formatted = await tools.formatData({ data: results, format: 'json' });
return formatted;"
```

## 🚀 What Makes This Powerful

The codemode pattern enables:

1. **Complex Multi-Step Workflows**: Chain multiple tool calls with conditional logic
2. **Data Transformation**: Process and transform data between steps
3. **Error Handling**: Generated code includes try-catch for robustness
4. **Dynamic Logic**: If/else, loops, and complex control flow
5. **Tool Orchestration**: Coordinate multiple tools in sophisticated ways

This goes beyond simple tool calling - it's **code-level orchestration** of tools!

---

**Server running at**: `http://localhost:3457/mcp`

**Ready to integrate! 🚀**

---

## 📝 Quick Reference

| Feature | Port | URL |
|---------|------|-----|
| **Codemode MCP Server** | 3457 | `http://localhost:3457/mcp` |
| Health Check | 3457 | `http://localhost:3457/health` |
| Basic Tools Server | 3456 | `http://localhost:3456/mcp` |

| NPM Command | Purpose |
|-------------|---------|
| `npm run mcp:codemode` | Start codemode execution server (port 3457) |
| `npm run mcp:server` | Start basic tools server (port 3456) |
| `npm run mcp:test` | Test MCP connection |

