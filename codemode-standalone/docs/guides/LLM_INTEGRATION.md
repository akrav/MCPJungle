# LLM Integration Guide

Complete guide to integrating Large Language Models with codemode-standalone.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Anthropic Claude Integration](#anthropic-claude-integration)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Cost Management](#cost-management)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

Codemode-standalone uses a unique "code execution" pattern where LLMs generate JavaScript code that orchestrates tools, rather than calling tools directly. This provides maximum flexibility for complex workflows.

### Supported LLMs

- ✅ **Anthropic Claude** (built-in, recommended)
- 🔄 OpenAI GPT (planned)
- 🔄 Custom LLMs (via adapter pattern)

---

## Anthropic Claude Integration

### Quick Start

```typescript
import { ToolCallingEngine } from "codemode-standalone";
import { z } from "zod";

// Define your tools
const tools = {
  calculate: {
    name: "calculate",
    description: "Perform a calculation",
    inputSchema: z.object({
      expression: z.string(),
    }),
    execute: async (args) => {
      return { result: eval(args.expression) };
    },
  },
};

// Create engine
const engine = new ToolCallingEngine({
  tools,
  enableCodeExecution: true,
});

// Execute
const result = await engine.execute({
  userRequest: "Calculate 25 * 4",
});
```

### How It Works

1. **User makes request** in natural language
2. **Claude receives** list of tools and `executeCode` capability
3. **Claude generates** JavaScript code using tool_use block
4. **Code executes** in isolated-vm sandbox
5. **Tools called** from within the code
6. **Results returned** to user

### Tool Calling Pattern

The system uses Anthropic's native tool calling:

```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_...",
      "name": "executeCode",
      "input": {
        "code": "const result = await tools.calculate({expression: '25 * 4'}); return result;",
        "description": "Calculate 25 times 4"
      }
    }
  ]
}
```

---

## Architecture

### Execution Flow

```
User Request
     ↓
ToolCallingEngine
     ↓
Claude API (tool calling)
     ↓
tool_use: executeCode
     ↓
Isolated-VM Sandbox
  - Memory limits
  - Timeout limits
  - No filesystem access
  - No network access
     ↓
Code calls registered tools
     ↓
Tool Registry (proxy)
     ↓
Real tool implementations
     ↓
Results flow back
```

### Why This Pattern?

**Traditional Tool Calling**:
```
LLM → tool_call → execute → LLM → tool_call → execute → ...
```
- Multiple LLM calls
- Higher cost
- Limited logic

**Codemode Pattern**:
```
LLM → generates code → code executes all tools → done
```
- Single LLM call
- Lower cost
- Full JavaScript capabilities
- Complex logic (loops, conditionals, etc.)

---

## Getting Started

### 1. Installation

```bash
npm install @anthropic-ai/sdk
```

### 2. Set API Key

```bash
# In your environment
export ANTHROPIC_API_KEY=sk-ant-api03-...

# Or in .env file
echo "ANTHROPIC_API_KEY=sk-ant-api03-..." > .env
```

### 3. Create Engine

```typescript
import { ToolCallingEngine } from "codemode-standalone";

const engine = new ToolCallingEngine({
  tools: yourTools,
  enableCodeExecution: true,
  securityPolicy: {
    maxExecutionTime: 5000,  // 5 seconds
    maxMemoryMB: 64,          // 64 MB
  },
  verbose: true,  // Enable logging
});
```

### 4. Execute Requests

```typescript
const result = await engine.execute({
  userRequest: "Your natural language request",
  context: "Optional additional context",
});

console.log(result.result);      // Final answer
console.log(result.toolCalls);   // Tools that were called
console.log(result.cost);         // Cost in USD
console.log(result.totalTokens); // Tokens used
```

---

## Cost Management

### Tracking Costs

The engine automatically tracks costs:

```typescript
const result = await engine.execute({...});

console.log(`Cost: $${result.cost.toFixed(4)}`);
console.log(`Tokens: ${result.totalTokens.toLocaleString()}`);
```

### Cost Calculator

```typescript
import { SimpleCostTracker } from "codemode-standalone";

const tracker = new SimpleCostTracker();

// After each request
tracker.addRequest(result.totalTokens, result.cost);

// View aggregated stats
const stats = tracker.getStats();
console.log(`Total: $${stats.totalCost.toFixed(4)}`);
console.log(`Average: $${stats.avgCostPerRequest.toFixed(4)}`);
```

### Pricing (as of Oct 2024)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| Claude 3.5 Sonnet | $3.00 | $15.00 |
| Claude 3.5 Haiku | $0.80 | $4.00 |

**Typical Request**:
- Input: ~500-1,000 tokens (prompt + tool definitions)
- Output: ~100-500 tokens (generated code)
- **Cost**: ~$0.001 - $0.005 per request

**At Scale**:
- 1,000 requests/day ≈ $5-10/day
- 100,000 requests/day ≈ $500-1,000/day

### Cost Optimization

1. **Cache prompts** when possible
2. **Use Haiku** for simple tasks
3. **Use Sonnet** for complex orchestration
4. **Batch requests** where applicable
5. **Monitor token usage** regularly

---

## Best Practices

### 1. Tool Definitions

**Good**: Clear, specific descriptions

```typescript
{
  name: "getWeather",
  description: "Get current weather for a city. Returns temperature in Fahrenheit, condition (sunny/cloudy/rainy), and humidity percentage.",
  inputSchema: z.object({
    location: z.string().describe("City name (e.g., 'San Francisco')"),
  }),
}
```

**Bad**: Vague descriptions

```typescript
{
  name: "getWeather",
  description: "Gets weather",
  inputSchema: z.object({
    location: z.string(),
  }),
}
```

### 2. Error Handling

Claude can adapt when code fails:

```typescript
const result = await engine.execute({
  userRequest: "Your request",
});

if (result.result === null) {
  console.log("Claude reached max turns or encountered error");
  console.log("Tool calls made:", result.toolCalls);
}
```

### 3. Security

Always configure security policies:

```typescript
const engine = new ToolCallingEngine({
  tools,
  securityPolicy: {
    maxExecutionTime: 5000,      // Prevent infinite loops
    maxMemoryMB: 64,              // Limit memory usage
    allowNetworkAccess: false,    // Disable network from code
  },
});
```

### 4. Complex Workflows

Claude excels at complex orchestration:

```typescript
// Single request for multi-step workflow
const result = await engine.execute({
  userRequest: `
    1. Query the database for all users
    2. Filter to only active users
    3. For each active user, get their profile data
    4. Calculate aggregate statistics
    5. Send a summary email to admins
  `,
});
```

Claude will generate code with loops, conditionals, and proper error handling.

### 5. Observability

Enable verbose logging for debugging:

```typescript
const engine = new ToolCallingEngine({
  tools,
  verbose: true,  // See all tool calls and execution details
});
```

Output:
```
[ToolCallingEngine] Starting execution...
[ToolCallingEngine] Tool called: executeCode
[ToolCallingEngine] Executing code in isolated-vm...
[Tool] calculate("25 * 4")
[ToolCallingEngine] Execution time: 4ms
```

---

## Advanced Usage

### Multi-Turn Conversations

The engine supports multi-turn conversations automatically:

```typescript
const engine = new ToolCallingEngine({
  tools,
  maxTurns: 10,  // Allow up to 10 back-and-forth exchanges
});
```

Claude can:
- Fix errors in generated code
- Try alternative approaches
- Request clarification (via error messages)

### Model Selection

```typescript
const engine = new ToolCallingEngine({
  tools,
  model: "claude-3-5-haiku-20241022",  // Faster, cheaper
  // or
  model: "claude-3-5-sonnet-20241022", // More capable (default)
});
```

### Temperature Control

```typescript
const engine = new ToolCallingEngine({
  tools,
  temperature: 0.3,  // Lower = more deterministic (default)
  // or
  temperature: 0.7,  // Higher = more creative
});
```

---

## Troubleshooting

### "API key required" Error

```bash
# Check if key is set
echo $ANTHROPIC_API_KEY

# Should output: sk-ant-api03-...
# If empty:
export ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

### Rate Limit Errors

```
Error: rate_limit_error
```

**Solutions**:
1. Add delays between requests
2. Check your tier at console.anthropic.com
3. Implement exponential backoff

### Code Execution Failures

If generated code consistently fails:

1. **Check tool descriptions** - Are they clear?
2. **Check return values** - Do tools return what's documented?
3. **Enable verbose mode** - See what code Claude generates
4. **Review error messages** - Claude sees them too

### Cost Concerns

If costs are higher than expected:

1. Check `maxTokens` setting (lower if possible)
2. Use Haiku for simple tasks
3. Implement caching
4. Review tool descriptions (shorter = fewer tokens)

---

## Examples

### Example 1: Simple Calculation

```typescript
const result = await engine.execute({
  userRequest: "What is 15 * 8?",
});
// Claude generates: return await tools.calculate({expression: "15 * 8"});
```

### Example 2: Conditional Logic

```typescript
const result = await engine.execute({
  userRequest: "Get weather for NYC. If temp > 80, send alert.",
});
// Claude generates code with if statement
```

### Example 3: Loops

```typescript
const result = await engine.execute({
  userRequest: "Calculate factorial for numbers 1 through 5",
});
// Claude generates code with for loop
```

### Example 4: Data Transformation

```typescript
const result = await engine.execute({
  userRequest: "Query users table, filter admins, get count",
});
// Claude generates code with filter and processing
```

---

## Performance

| Metric | Value |
|--------|-------|
| API Response Time | 1-2 seconds |
| Code Execution | 3-20ms |
| Average Tokens | ~3,500 per request |
| Average Cost | ~$0.018 per request |

---

## Next Steps

- **[Quick Start](../getting-started/QUICKSTART.md)** - Get started in 5 minutes
- **[Examples](../../examples/llm/)** - See working examples
- **[API Reference](../reference/API_REFERENCE.md)** - Complete API docs
- **[Security Guide](../operations/SECURITY.md)** - Secure your deployment

---

## Additional Resources

- [Anthropic API Documentation](https://docs.anthropic.com/)
- [Claude Models Overview](https://docs.anthropic.com/claude/docs/models-overview)
- [Tool Calling Best Practices](https://docs.anthropic.com/claude/docs/tool-use)
- [Example Code](../../examples/llm/)

---

**Questions?** Check our [Troubleshooting Guide](../operations/TROUBLESHOOTING.md) or open an issue.





