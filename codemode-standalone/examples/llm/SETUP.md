# Anthropic Integration Setup Guide

Complete setup instructions for using Claude with codemode-standalone.

## 📋 Prerequisites

- Node.js 18+ installed
- An Anthropic API account

## 🔑 Step 1: Get Your API Key

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign in or create an account
3. Navigate to **API Keys** in settings
4. Click **Create Key**
5. Copy your API key (starts with `sk-ant-api03-`)

## ⚙️ Step 2: Configure Your Environment

### Option A: Environment Variable (Recommended)

```bash
# In your terminal
export ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# Or add to your shell profile (~/.zshrc, ~/.bashrc)
echo 'export ANTHROPIC_API_KEY=sk-ant-api03-your-key-here' >> ~/.zshrc
source ~/.zshrc
```

### Option B: .env File

```bash
# Copy the example file
cp env.example .env

# Edit .env and add your key
# .env file:
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

**⚠️ Important**: Never commit your `.env` file or API keys to version control!

## 🚀 Step 3: Run Your First Example

```bash
# Make sure dependencies are installed
npm install

# Build the project
npm run build

# Run the basic example
npm run example:anthropic:basic
```

You should see output like:

```
🚀 Anthropic Integration - Basic Example

✅ API key found
🤖 Initializing Claude (claude-3-5-sonnet-20241022)...

🔗 Testing API connection...
✅ Connected successfully

📝 User Request:
   "Check the weather in San Francisco..."

⏳ Generating and executing code with Claude...

[Tool] Getting weather for San Francisco
[Tool] 📬 Sending high priority notification
       Message: "It's 75°F in San Francisco - great weather!"

============================================================
📊 RESULTS
============================================================

✅ Execution successful!
⏱️  Total time: 2847ms (execution: 12ms)

📤 Result:
{
  "weather": {
    "location": "San Francisco",
    "temperature": 75,
    ...
  },
  "sent": true
}
```

## 🎯 Step 4: Try the Advanced Example

```bash
npm run example:anthropic:advanced
```

This example demonstrates:
- Multiple complex workflows
- Cost tracking
- Error handling
- Different tool patterns

## 🛠️ Step 5: Create Your Own Integration

Create a new file (e.g., `my-agent.ts`):

```typescript
import { CodemodeEngine, AnthropicCodeGenerator } from "codemode-standalone";
import { z } from "zod";

// Define your tools
const tools = {
  myTool: {
    name: "myTool",
    description: "Description of what your tool does",
    inputSchema: z.object({
      param: z.string().describe("Parameter description"),
    }),
    execute: async (args: { param: string }) => {
      // Your tool implementation
      return { result: "success" };
    },
  },
};

// Set up Claude
const codeGenerator = new AnthropicCodeGenerator({
  model: "claude-3-5-sonnet-20241022",
  temperature: 0.3,
});

// Create the engine
const engine = new CodemodeEngine({
  generateCode: (prompt) => codeGenerator.generateCode(prompt),
  tools,
  securityPolicy: {
    maxExecutionTime: 5000,
    maxMemoryMB: 64,
  },
});

// Execute a request
async function main() {
  const result = await engine.execute({
    userRequest: "Your natural language request here",
  });

  console.log(result.result.result);
}

main();
```

## 📊 Model Options

### Available Models

| Model | Speed | Intelligence | Cost (per 1M tokens) | Best For |
|-------|-------|--------------|---------------------|----------|
| `claude-3-5-sonnet-20241022` | Medium | Highest | $3 / $15 | Complex code generation |
| `claude-3-5-haiku-20241022` | Fast | High | $0.8 / $4 | Simple tasks, rapid iteration |
| `claude-3-opus-20240229` | Slow | Highest | $15 / $75 | Most complex tasks |

### Configuration Options

```typescript
const codeGenerator = new AnthropicCodeGenerator({
  // Model selection
  model: "claude-3-5-sonnet-20241022",
  
  // Temperature (0-1)
  // Lower = more deterministic, higher = more creative
  temperature: 0.3,
  
  // Max tokens for response
  maxTokens: 2048,
  
  // Optional: Top-p sampling
  topP: 0.9,
  
  // Optional: Stop sequences
  stopSequences: ["</code>"],
});
```

## 💰 Cost Management

### Track Costs

```typescript
import { SimpleCostTracker } from "codemode-standalone";

const tracker = new SimpleCostTracker();

// After each request
const result = await codeGenerator.generateCodeWithMetadata(prompt);
const cost = codeGenerator.calculateCost(result.tokensUsed);
tracker.addRequest(result.tokensUsed.total, cost);

// View stats
console.log(tracker.formatCost());
// Output: $0.0234 (15,420 tokens, 5 requests)
```

### Estimated Costs

Typical code generation request:
- Input: ~500-1000 tokens (prompt + tool definitions)
- Output: ~100-500 tokens (generated code)
- Cost per request: **$0.001 - $0.005** (with Sonnet)

For 100 requests/day: **~$0.10 - $0.50/day**

## 🔒 Security Best Practices

### 1. Protect Your API Key

```bash
# ✅ Good - Use environment variables
export ANTHROPIC_API_KEY=...

# ❌ Bad - Hardcoded in code
const key = "sk-ant-api03-..."
```

### 2. Use .gitignore

Make sure `.env` is in your `.gitignore`:

```gitignore
.env
.env.local
*.key
```

### 3. Rate Limiting

Anthropic has rate limits based on your tier. Implement delays:

```typescript
// Add delay between requests
await new Promise(resolve => setTimeout(resolve, 1000));
```

### 4. Error Handling

```typescript
try {
  const result = await engine.execute({ userRequest });
  if (!result.result.success) {
    console.error("Execution failed:", result.result.error);
  }
} catch (error) {
  if (error.message.includes("rate_limit")) {
    // Handle rate limit
  } else if (error.message.includes("invalid_api_key")) {
    // Handle auth error
  }
}
```

## 🐛 Troubleshooting

### "API key is required" Error

```bash
# Check if key is set
echo $ANTHROPIC_API_KEY

# Should output: sk-ant-api03-...
# If empty, set it:
export ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

### Rate Limit Errors

```
Error: Anthropic API error: rate_limit_error
```

**Solutions:**
- Add delays between requests
- Check your API tier at console.anthropic.com
- Implement exponential backoff

### Connection Errors

```typescript
// Test your connection
const generator = new AnthropicCodeGenerator({ model: "claude-3-5-sonnet-20241022" });
const connected = await generator.testConnection();
console.log("Connected:", connected);
```

### Generated Code Errors

If Claude generates invalid code:
- Try lowering the temperature (more deterministic)
- Simplify your request
- Check that tool definitions are clear
- Increase maxTokens if code is being cut off

## 📈 Next Steps

1. **Read the examples**: Check out `anthropic-basic.ts` and `anthropic-advanced.ts`
2. **Explore tools**: Define custom tools for your use case
3. **Test thoroughly**: Use the test suite as a reference
4. **Monitor costs**: Track token usage and costs
5. **Optimize**: Experiment with models and temperatures

## 📚 Additional Resources

- [Anthropic API Documentation](https://docs.anthropic.com/)
- [Claude Models Overview](https://docs.anthropic.com/claude/docs/models-overview)
- [Prompt Engineering Guide](https://docs.anthropic.com/claude/docs/prompt-engineering)
- [Main README](../../README.md)
- [Examples Directory](./README.md)

## 🆘 Getting Help

If you run into issues:

1. Check the [troubleshooting section](#-troubleshooting) above
2. Review the example files in this directory
3. Check Anthropic's [status page](https://status.anthropic.com/)
4. Verify your API key is valid at [console.anthropic.com](https://console.anthropic.com/)

## ✅ Checklist

Before running examples, make sure you have:

- [ ] Node.js 18+ installed (`node --version`)
- [ ] Dependencies installed (`npm install`)
- [ ] Project built (`npm run build`)
- [ ] Anthropic API key obtained
- [ ] API key set in environment or .env file
- [ ] Connection tested successfully

Once all items are checked, you're ready to go! 🚀






