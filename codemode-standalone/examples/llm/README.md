# LLM Integration Examples

This directory contains examples of integrating real LLM providers with codemode-standalone.

## 🔑 Setup

1. **Get an API Key**
   - Anthropic: https://console.anthropic.com/settings/keys
   - OpenAI: https://platform.openai.com/api-keys (coming soon)

2. **Configure Environment**
   ```bash
   # Copy the example env file
   cp .env.example .env
   
   # Edit .env and add your API key
   # ANTHROPIC_API_KEY=sk-ant-api03-...
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

## 📚 Examples

### Anthropic (Claude)

- **`anthropic-basic.ts`** - Simple integration with Claude
  ```bash
  npm run example:anthropic:basic
  ```

- **`anthropic-advanced.ts`** - Advanced features including:
  - Metadata tracking
  - Cost calculation
  - Error handling
  - Different model options
  ```bash
  npm run example:anthropic:advanced
  ```

## 🎯 Key Concepts

### Code Generation Flow

1. **Tool Definition** → Define available tools (functions)
2. **Type Generation** → Generate TypeScript types for tools
3. **Prompt Building** → Combine tool info + user request
4. **LLM Call** → Generate JavaScript code
5. **Code Execution** → Run in isolated sandbox
6. **Return Result** → Get structured output

### Example Tool

```typescript
const tools = {
  getWeather: {
    name: "getWeather",
    description: "Get current weather for a location",
    inputSchema: z.object({
      location: z.string(),
    }),
    execute: async (args) => {
      // Your implementation
      return { temperature: 75, condition: "sunny" };
    },
  },
};
```

### Using with Anthropic

```typescript
import { AnthropicCodeGenerator } from "../../src/llm/AnthropicAdapter.js";
import { CodemodeEngine } from "../../src/index.js";

const codeGenerator = new AnthropicCodeGenerator({
  model: "claude-3-5-sonnet-20241022",
  temperature: 0.3,
});

const engine = new CodemodeEngine({
  generateCode: (prompt) => codeGenerator.generateCode(prompt),
  tools: myTools,
});

const result = await engine.execute({
  userRequest: "Get weather for NYC and tell me if I need a jacket",
});
```

## 🔒 Security

- **Never commit** your `.env` file with API keys
- API keys are loaded from environment variables
- Code execution happens in an isolated sandbox with:
  - Memory limits
  - Timeout limits
  - No file system access
  - Restricted network access

## 💰 Cost Tracking

The Anthropic adapter includes built-in cost tracking:

```typescript
const result = await codeGenerator.generateCodeWithMetadata(prompt);
const cost = codeGenerator.calculateCost(result.tokensUsed);

console.log(`Request cost: $${cost.toFixed(4)}`);
console.log(`Tokens used: ${result.tokensUsed.total}`);
```

## 🐛 Troubleshooting

### "API key is required" error

Make sure you have:
1. Created a `.env` file (copy from `.env.example`)
2. Added your API key to the file
3. Key is in format: `ANTHROPIC_API_KEY=sk-ant-api03-...`

### "No text content in Claude response"

This usually means:
- The prompt was unclear
- Token limit was too low
- API returned an error

Try:
- Increasing `maxTokens` in config
- Simplifying your request
- Checking API status

### Rate Limit Errors

Anthropic has rate limits based on your plan:
- Add delays between requests
- Implement exponential backoff
- Check your tier limits at https://console.anthropic.com/

## 📖 Learn More

- [Anthropic API Documentation](https://docs.anthropic.com/)
- [Prompt Engineering Guide](../../docs/guides/PROMPT_ENGINEERING.md) (coming soon)
- [Main README](../../README.md)






