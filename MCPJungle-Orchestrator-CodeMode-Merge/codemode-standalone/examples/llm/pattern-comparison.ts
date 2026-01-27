/**
 * PATTERN COMPARISON: Code Generation vs Tool Calling with Execute
 * 
 * This demonstrates TWO different architectural patterns:
 * 
 * PATTERN A: Pure Codemode (current implementation)
 *   - LLM generates JavaScript code as TEXT
 *   - System executes the code in isolated-vm
 *   - Code calls tools
 * 
 * PATTERN B: Tool Calling with ExecuteCode Tool
 *   - LLM uses Anthropic's tool calling feature
 *   - One of the tools is "executeCode"
 *   - LLM calls executeCode tool with JavaScript parameter
 *   - System executes that code in isolated-vm
 *   - Code calls other tools
 * 
 * Both are valid! Pattern B is what the user is suggesting.
 */

import Anthropic from "@anthropic-ai/sdk";
import { IsolatedExecutor, ToolRegistry } from "../../src/index.js";
import { z } from "zod";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Check API key
const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY;
if (!apiKey) {
  console.error("❌ No API key found");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey });

console.log("\n╔════════════════════════════════════════════════════════════════════╗");
console.log("║                                                                    ║");
console.log("║              PATTERN COMPARISON: TWO APPROACHES                    ║");
console.log("║                                                                    ║");
console.log("╚════════════════════════════════════════════════════════════════════╝\n");

// ============================================================
// SETUP: Tools for both patterns
// ============================================================

const tools = {
  calculate: {
    name: "calculate",
    description: "Perform a calculation",
    inputSchema: z.object({
      expression: z.string(),
    }),
    execute: async (args: { expression: string }) => {
      console.log(`   [Tool] calculate("${args.expression}")`);
      const result = eval(args.expression);
      return { result };
    },
  },
  getData: {
    name: "getData",
    description: "Get some data",
    inputSchema: z.object({
      key: z.string(),
    }),
    execute: async (args: { key: string }) => {
      console.log(`   [Tool] getData("${args.key}")`);
      return { value: Math.random(), key: args.key };
    },
  },
};

// ============================================================
// PATTERN A: PURE CODEMODE (Current Implementation)
// ============================================================

async function patternA_PureCodemode() {
  console.log("═".repeat(70));
  console.log("PATTERN A: PURE CODEMODE (Current)");
  console.log("═".repeat(70) + "\n");

  console.log("Architecture:");
  console.log("  User Request → Claude (text gen) → JavaScript code → Execute\n");

  const userRequest = "Calculate 10 + 20, then get data for 'result'";

  // Build prompt
  const prompt = `You are a code generator. Generate JavaScript code to accomplish this task.

Available tools:
- calculate({ expression: string }) - Perform calculation
- getData({ key: string }) - Get data

Rules:
- Use 'await tools.toolName({ args })'
- Return the final result
- No markdown, just plain JavaScript

Task: ${userRequest}

Generate the code:`;

  console.log("📤 Calling Claude API (messages.create - TEXT GENERATION)...\n");

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: prompt,
    }],
  });

  const textBlock = response.content.find(block => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text in response");
  }

  const code = textBlock.text.replace(/```javascript\n?/g, '').replace(/```\n?/g, '').trim();

  console.log("📥 Claude Response:");
  console.log("   Type: TEXT content");
  console.log("   Stop reason:", response.stop_reason);
  console.log("\n   Generated Code:");
  console.log("   " + "─".repeat(66));
  code.split('\n').forEach((line, i) => {
    console.log(`   ${String(i + 1).padStart(2)} │ ${line}`);
  });
  console.log("   " + "─".repeat(66) + "\n");

  console.log("🔧 Executing code in isolated-vm...\n");

  const registry = new ToolRegistry(tools);
  const executor = new IsolatedExecutor(registry, {
    maxExecutionTime: 5000,
    maxMemoryMB: 64,
  });

  const result = await executor.execute(code);

  console.log("\n✅ Result:", JSON.stringify(result.result, null, 2));
  console.log(`⏱️  Execution time: ${result.executionTime}ms`);
  console.log(`💰 Cost: ~$0.002 (single LLM call)\n`);
}

// ============================================================
// PATTERN B: TOOL CALLING WITH EXECUTE CODE
// ============================================================

async function patternB_ToolCallingWithExecute() {
  console.log("═".repeat(70));
  console.log("PATTERN B: TOOL CALLING WITH EXECUTE CODE (User's Suggestion)");
  console.log("═".repeat(70) + "\n");

  console.log("Architecture:");
  console.log("  User Request → Claude (tool calling) → tool_use: executeCode");
  console.log("                                           ↓");
  console.log("                                   Execute in isolated-vm\n");

  const userRequest = "Calculate 10 + 20, then get data for 'result'";

  // Define tools for Anthropic (including executeCode)
  const anthropicTools = [
    {
      name: "executeCode",
      description: "Execute JavaScript code in a secure isolated environment. The code has access to 'tools.calculate()' and 'tools.getData()' functions.",
      input_schema: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "JavaScript code to execute. Use 'await tools.calculate({expression})' and 'await tools.getData({key})'. Must return a value."
          },
          description: {
            type: "string",
            description: "Brief description of what this code does"
          }
        },
        required: ["code"]
      }
    }
  ];

  console.log("📤 Calling Claude API (messages.create - TOOL CALLING)...\n");

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    tools: anthropicTools,
    messages: [{
      role: "user",
      content: userRequest,
    }],
  });

  console.log("📥 Claude Response:");
  console.log("   Type: TOOL USE (not plain text)");
  console.log("   Stop reason:", response.stop_reason);
  console.log();

  // Find tool use block
  const toolUseBlock = response.content.find(block => block.type === "tool_use");

  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    console.log("❌ No tool_use block found");
    console.log("   Response content:", JSON.stringify(response.content, null, 2));
    return;
  }

  console.log("   Tool Called:", toolUseBlock.name);
  console.log("   Tool Input:");
  console.log(JSON.stringify(toolUseBlock.input, null, 2).split('\n').map(l => '   ' + l).join('\n'));
  console.log();

  const code = (toolUseBlock.input as any).code;

  console.log("   Extracted Code:");
  console.log("   " + "─".repeat(66));
  code.split('\n').forEach((line: string, i: number) => {
    console.log(`   ${String(i + 1).padStart(2)} │ ${line}`);
  });
  console.log("   " + "─".repeat(66) + "\n");

  console.log("🔧 Executing code in isolated-vm (via executeCode tool)...\n");

  const registry = new ToolRegistry(tools);
  const executor = new IsolatedExecutor(registry, {
    maxExecutionTime: 5000,
    maxMemoryMB: 64,
  });

  const result = await executor.execute(code);

  console.log("\n✅ Result:", JSON.stringify(result.result, null, 2));
  console.log(`⏱️  Execution time: ${result.executionTime}ms`);
  console.log(`💰 Cost: ~$0.002 (single LLM call with tool calling)\n`);

  console.log("📝 Would send back to Claude:");
  console.log("   role: 'user'");
  console.log("   content: [");
  console.log("     {");
  console.log(`       type: 'tool_result',`);
  console.log(`       tool_use_id: '${toolUseBlock.id}',`);
  console.log(`       content: ${JSON.stringify(JSON.stringify(result.result))}`);
  console.log("     }");
  console.log("   ]\n");
}

// ============================================================
// COMPARISON
// ============================================================

async function showComparison() {
  console.log("═".repeat(70));
  console.log("KEY DIFFERENCES");
  console.log("═".repeat(70) + "\n");

  console.log("PATTERN A (Pure Codemode):");
  console.log("  ✅ Claude generates code as TEXT");
  console.log("  ✅ System decides when to execute");
  console.log("  ✅ Simpler prompt");
  console.log("  ✅ Direct execution");
  console.log("  ❌ Not using Anthropic's tool calling feature\n");

  console.log("PATTERN B (Tool Calling with Execute):");
  console.log("  ✅ Uses Anthropic's native tool calling");
  console.log("  ✅ Claude decides to call 'executeCode' tool");
  console.log("  ✅ More explicit in API responses");
  console.log("  ✅ Could mix direct tool calls with code execution");
  console.log("  ❌ Slightly more complex\n");

  console.log("Both patterns:");
  console.log("  ✅ Execute code in isolated-vm");
  console.log("  ✅ Secure sandbox");
  console.log("  ✅ Code calls registered tools");
  console.log("  ✅ Same cost (~$0.002 per request)");
  console.log("  ✅ Same security guarantees\n");

  console.log("═".repeat(70));
  console.log("WHICH IS BETTER?");
  console.log("═".repeat(70) + "\n");

  console.log("Pattern A (Current) is better if:");
  console.log("  - You want ALL requests to generate code");
  console.log("  - You want simpler prompts");
  console.log("  - You want direct control over execution\n");

  console.log("Pattern B (User's suggestion) is better if:");
  console.log("  - You want to use Anthropic's tool calling properly");
  console.log("  - You want Claude to decide when to use code vs direct tools");
  console.log("  - You want to mix code execution with direct tool calls");
  console.log("  - You want explicit tool_use blocks in API responses\n");

  console.log("═".repeat(70));
  console.log("HYBRID PATTERN C (Best of Both):");
  console.log("═".repeat(70) + "\n");

  console.log("Claude has access to:");
  console.log("  1. Direct tools: calculate(), getData()");
  console.log("  2. Meta tool: executeCode(code)");
  console.log();
  console.log("Claude can:");
  console.log("  - Call calculate() directly for simple tasks");
  console.log("  - Call executeCode() for complex orchestration");
  console.log();
  console.log("This gives maximum flexibility!\n");
}

// ============================================================
// RUN ALL PATTERNS
// ============================================================

async function main() {
  try {
    await patternA_PureCodemode();
    console.log("\n\n");
    await patternB_ToolCallingWithExecute();
    console.log("\n\n");
    await showComparison();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();





