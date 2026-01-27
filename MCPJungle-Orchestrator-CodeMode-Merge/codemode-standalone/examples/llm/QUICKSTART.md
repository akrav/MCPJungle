# 🚀 Anthropic Integration - Quick Start

Get Claude running with codemode in 60 seconds.

## ⚡ Fast Track

```bash
# 1. Get your API key from https://console.anthropic.com/
# 2. Set it in your environment
export ANTHROPIC_API_KEY=sk-ant-api03-...

# 3. Run the example
npm run example:anthropic:basic
```

That's it! ✨

## 📝 Quick Example

```typescript
import { CodemodeEngine, AnthropicCodeGenerator } from "codemode-standalone";
import { z } from "zod";

// Define a tool
const tools = {
  calculate: {
    name: "calculate",
    description: "Calculate a math expression",
    inputSchema: z.object({
      expression: z.string(),
    }),
    execute: async ({ expression }) => {
      return { result: eval(expression) };
    },
  },
};

// Setup Claude
const codeGenerator = new AnthropicCodeGenerator({
  model: "claude-3-5-sonnet-20241022",
  temperature: 0.3,
});

// Create engine
const engine = new CodemodeEngine({
  generateCode: (prompt) => codeGenerator.generateCode(prompt),
  tools,
});

// Execute!
const result = await engine.execute({
  userRequest: "What is 25 * 4 + 100?",
});

console.log(result.result.result);
// { result: 200 }
```

## 🎨 Available Models

| Model | Code | Speed | Cost |
|-------|------|-------|------|
| **Sonnet** (recommended) | `claude-3-5-sonnet-20241022` | ⚡⚡ | 💰💰 |
| **Haiku** (fast) | `claude-3-5-haiku-20241022` | ⚡⚡⚡ | 💰 |
| **Opus** (powerful) | `claude-3-opus-20240229` | ⚡ | 💰💰💰💰 |

## 💡 Pro Tips

1. **Use Sonnet** for most tasks (best balance)
2. **Keep temperature low** (0.3) for consistent code
3. **Track costs** with `SimpleCostTracker`
4. **Test connection** with `generator.testConnection()`

## 📚 Next Steps

- Read **[SETUP.md](./SETUP.md)** for detailed instructions
- Try **[anthropic-advanced.ts](./anthropic-advanced.ts)** for complex examples
- Check **[README.md](./README.md)** for complete documentation

## ❓ Problems?

```bash
# Not working? Check your API key:
echo $ANTHROPIC_API_KEY

# Should show: sk-ant-api03-...
# If empty:
export ANTHROPIC_API_KEY=your-key-here
```

See **[SETUP.md#troubleshooting](./SETUP.md#-troubleshooting)** for more help.

---

**Happy coding with Claude!** 🤖✨






