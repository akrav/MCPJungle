# Quick Start: Implementation Guide

**Status**: Ready to implement  
**Next**: MCP Integration Tests → LLM Integration

---

## 🎉 What's Done

✅ **All tests now passing!** (51/51 = 100%)
- Fixed TypeGenerator test validation
- All unit tests pass
- All integration tests pass

---

## 🎯 What's Next

You have a detailed plan in `IMPLEMENTATION_PLAN.md` for:
1. **MCP Integration Tests** (3 hours)
2. **Real LLM Integration** (2-3 hours)

---

## 🚀 Quick Start

### Option 1: Start with MCP Tests (Recommended)

```bash
cd codemode-standalone

# Create the mock server file
touch tests/mocks/MockMCPServer.ts
```

Then implement following the plan in `IMPLEMENTATION_PLAN.md` Task 1.1.

**Start here**: Copy this skeleton to `tests/mocks/MockMCPServer.ts`:

```typescript
import type { MCPTool } from "../../src/mcp/types.js";

/**
 * Mock MCP Server for testing
 */
export class MockMCPServer {
  private tools: MCPTool[] = [];
  private serverInfo = {
    name: "mock-mcp-server",
    version: "1.0.0"
  };

  constructor(tools?: MCPTool[]) {
    this.tools = tools || this.getDefaultTools();
  }

  /**
   * Default tools for testing
   */
  private getDefaultTools(): MCPTool[] {
    return [
      {
        name: "filesystem_read",
        description: "Read a file from the filesystem",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Path to file" }
          },
          required: ["path"]
        }
      },
      {
        name: "database_query",
        description: "Query the database",
        inputSchema: {
          type: "object",
          properties: {
            sql: { type: "string", description: "SQL query" },
            params: { 
              type: "array",
              description: "Query parameters",
              items: { type: "string" }
            }
          },
          required: ["sql"]
        }
      }
    ];
  }

  /**
   * List all available tools
   */
  async listTools() {
    return {
      tools: this.tools
    };
  }

  /**
   * Call a tool
   */
  async callTool(name: string, args: any) {
    const tool = this.tools.find(t => t.name === name);
    
    if (!tool) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Tool '${name}' not found`
        }]
      };
    }

    // Mock successful execution
    return {
      isError: false,
      content: [{
        type: "text",
        text: JSON.stringify({
          tool: name,
          args,
          result: `Mock result for ${name}`,
          timestamp: new Date().toISOString()
        })
      }]
    };
  }

  /**
   * Add a tool dynamically
   */
  addTool(tool: MCPTool) {
    this.tools.push(tool);
  }

  /**
   * Get server info
   */
  getServerInfo() {
    return this.serverInfo;
  }
}
```

---

### Option 2: Start with LLM Integration (Faster Results)

This gives you visible results quickly and is more exciting!

```bash
cd codemode-standalone

# Install dependencies
npm install openai dotenv

# Create .env file
echo "OPENAI_API_KEY=your-key-here" > .env

# Create the example file
touch examples/openai-integration.ts
```

Then copy this starter to `examples/openai-integration.ts`:

```typescript
/**
 * OpenAI Integration Example
 * Tests real code generation with GPT-4
 */

import OpenAI from "openai";
import { CodemodeEngine } from "../src/index.js";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate code using OpenAI GPT-4
 */
async function generateCodeWithOpenAI(prompt: string): Promise<string> {
  console.log("\n🤖 Calling OpenAI GPT-4...");
  
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are a code-generating AI assistant. Generate ONLY JavaScript code.

CRITICAL RULES:
- Do NOT wrap code in markdown code blocks
- Do NOT include any explanations or comments outside the code
- Do NOT include \`\`\`javascript or \`\`\` markers
- Output ONLY the JavaScript code that accomplishes the task
- Always include a return statement with the final result`
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.2,
    max_tokens: 2000,
  });

  let code = response.choices[0].message.content || "";
  
  // Clean up any markdown blocks
  code = code.replace(/```javascript\n?/g, "").replace(/```\n?/g, "");
  code = code.trim();
  
  console.log(`✅ Received ${code.length} characters of code`);
  
  return code;
}

// Define test tools
const tools = {
  fetchUser: {
    name: "fetchUser",
    description: "Fetch a user by ID from the database",
    inputSchema: z.object({
      userId: z.string().describe("The user ID to fetch"),
    }),
    execute: async (args: { userId: string }) => {
      console.log(`[Tool] Fetching user ${args.userId}`);
      return {
        id: args.userId,
        name: "John Doe",
        email: "john@example.com",
        role: "admin"
      };
    },
  },
  sendEmail: {
    name: "sendEmail",
    description: "Send an email to a user",
    inputSchema: z.object({
      to: z.string().describe("Email address"),
      subject: z.string().describe("Email subject"),
      body: z.string().describe("Email body"),
    }),
    execute: async (args: { to: string; subject: string; body: string }) => {
      console.log(`[Tool] Sending email to ${args.to}: ${args.subject}`);
      return {
        sent: true,
        messageId: "msg_" + Date.now(),
        timestamp: new Date().toISOString()
      };
    },
  },
};

// Test scenarios
const scenarios = [
  {
    name: "Simple tool call",
    request: "Fetch user with ID '123'",
  },
  {
    name: "Multiple tools with data passing",
    request: "Fetch user '456', then send them an email with subject 'Welcome' and body 'Hello from our system'",
  },
];

async function main() {
  console.log("🚀 OpenAI Integration Test\n");
  console.log("=" .repeat(80));

  const engine = new CodemodeEngine({
    generateCode: generateCodeWithOpenAI,
    tools,
    securityPolicy: {
      maxExecutionTime: 10000,
      maxMemoryMB: 128,
    },
    verbose: false,
  });

  for (const scenario of scenarios) {
    console.log(`\n📋 Scenario: ${scenario.name}`);
    console.log(`   Request: ${scenario.request}`);
    console.log("-".repeat(80));

    try {
      const response = await engine.execute({
        userRequest: scenario.request,
      });

      if (response.result.success) {
        console.log("✅ Success!");
        console.log("\n💻 Generated Code:");
        console.log(response.code);
        console.log("\n📦 Result:");
        console.log(JSON.stringify(response.result.result, null, 2));
      } else {
        console.log("❌ Failed!");
        console.log("Error:", response.result.error?.message);
        console.log("\n💻 Generated Code:");
        console.log(response.code);
      }
    } catch (error) {
      console.log("❌ Exception:", error);
    }

    console.log("=".repeat(80));
  }

  console.log("\n✨ Test complete!");
}

main().catch(console.error);
```

**Run it**:
```bash
npx tsx examples/openai-integration.ts
```

---

## 📋 Implementation Order

### Fastest Path (Get Results Quick)
1. ✅ **LLM Integration** - Start here for immediate feedback
2. Then **MCP Tests** - More thorough but less exciting

### Most Logical Path (Recommended)
1. ✅ **MCP Tests** - Foundation first
2. Then **LLM Integration** - Build on solid base

---

## 💡 Tips

### For MCP Tests
- Start simple with the mock server
- Test connection before tools
- Add tools incrementally
- Use console.log liberally for debugging

### For LLM Integration
- Start with small prompts
- Test with GPT-3.5 first (cheaper)
- Move to GPT-4 when confident
- Save interesting generated code examples

---

## 📊 Time Estimates

| Task | Time | Complexity |
|------|------|-----------|
| Mock MCP Server | 1 hour | Medium |
| MCP Client Tests | 45 min | Medium |
| MCP Converter Tests | 30 min | Easy |
| MCP End-to-End | 45 min | Medium |
| OpenAI Integration | 45 min | Easy |
| Anthropic Integration | 45 min | Easy |
| Prompt Guide | 30 min | Easy |
| LLM Comparison | 30 min | Medium |

**Total: 5-6 hours**

---

## 🎯 Success Metrics

### You'll Know It's Working When:

**MCP Tests**:
- Mock server can be instantiated ✓
- Tools are discovered ✓
- Tools execute successfully ✓
- All tests pass ✓

**LLM Integration**:
- No API errors ✓
- Code executes without syntax errors ✓
- Tools are called correctly ✓
- Results match expectations ✓

---

## 🆘 Troubleshooting

### "Cannot find module 'openai'"
```bash
npm install openai
```

### "Invalid API key"
Check your .env file:
```bash
cat .env
# Should show: OPENAI_API_KEY=sk-...
```

### "A non-transferable value was passed"
This was the bug we fixed! Make sure you pulled latest code.

### Generated code has syntax errors
- Check the system prompt
- Look for markdown code blocks in output
- Try different temperature (lower = more conservative)

---

## 📞 Need Help?

- **Detailed plan**: See `IMPLEMENTATION_PLAN.md`
- **Architecture**: See `ARCHITECTURE.md`
- **Existing tests**: Look in `tests/` folder for patterns
- **Code examples**: Check `examples/` folder

---

## 🎉 When You're Done

1. Run all tests: `npm test`
2. Update test count in README
3. Commit your changes
4. Celebrate! 🎊

---

**Ready?** Pick your path above and start coding! 🚀

