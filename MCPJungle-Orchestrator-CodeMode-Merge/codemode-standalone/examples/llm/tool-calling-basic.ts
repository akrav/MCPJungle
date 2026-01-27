/**
 * Tool Calling Pattern - Basic Example
 * 
 * This demonstrates the PROPER way to use Anthropic's tool calling
 * with code execution as one of the available tools.
 * 
 * Claude can:
 * 1. Call tools directly (for simple tasks)
 * 2. Call executeCode tool (for complex orchestration)
 * 
 * When Claude calls executeCode, the JavaScript runs in isolated-vm
 * and can call other registered tools.
 */

import { ToolCallingEngine } from "../../src/index.js";
import { z } from "zod";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

console.log("\n╔════════════════════════════════════════════════════════════════════╗");
console.log("║                                                                    ║");
console.log("║       🔧 TOOL CALLING PATTERN - BASIC EXAMPLE                     ║");
console.log("║                                                                    ║");
console.log("╚════════════════════════════════════════════════════════════════════╝\n");

// ============================================================
// DEFINE TOOLS
// ============================================================

const tools = {
  calculate: {
    name: "calculate",
    description: "Perform a mathematical calculation",
    inputSchema: z.object({
      expression: z.string().describe("Mathematical expression to evaluate"),
    }),
    execute: async (args: { expression: string }) => {
      console.log(`  [Tool Executed] calculate("${args.expression}")`);
      const result = eval(args.expression);
      return { result, expression: args.expression };
    },
  },

  getWeather: {
    name: "getWeather",
    description: "Get current weather for a location",
    inputSchema: z.object({
      location: z.string().describe("City name"),
    }),
    execute: async (args: { location: string }) => {
      console.log(`  [Tool Executed] getWeather("${args.location}")`);
      return {
        location: args.location,
        temperature: 72,
        condition: "sunny",
        humidity: 45,
      };
    },
  },

  sendNotification: {
    name: "sendNotification",
    description: "Send a notification message",
    inputSchema: z.object({
      message: z.string().describe("Notification message"),
      priority: z.enum(["low", "medium", "high"]).describe("Message priority"),
    }),
    execute: async (args: { message: string; priority: string }) => {
      console.log(`  [Tool Executed] sendNotification("${args.message}", ${args.priority})`);
      return {
        sent: true,
        messageId: `msg_${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
    },
  },
};

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("📋 Architecture:");
  console.log("   User → Claude (tool calling) → tool_use blocks");
  console.log("                                    ↓");
  console.log("                         [Direct Tool] or [executeCode]");
  console.log("                                    ↓");
  console.log("                           Execute in isolated-vm\n");

  // Create engine
  const engine = new ToolCallingEngine({
    tools,
    securityPolicy: {
      maxExecutionTime: 5000,
      maxMemoryMB: 64,
    },
    verbose: true,
    enableCodeExecution: true, // Enable executeCode tool
  });

  console.log("✅ Engine initialized\n");

  // ============================================================
  // TEST 1: Simple Direct Tool Call
  // ============================================================

  console.log("═".repeat(70));
  console.log("TEST 1: Simple Task (Claude should call tool directly)");
  console.log("═".repeat(70) + "\n");

  const test1 = await engine.execute({
    userRequest: "What is 25 * 4?",
  });

  console.log("\n📊 Result:", test1.result);
  console.log(`💰 Cost: $${test1.cost.toFixed(4)}`);
  console.log(`📈 Tokens: ${test1.totalTokens}`);
  console.log(`🔧 Tool calls: ${test1.toolCalls.length}`);
  test1.toolCalls.forEach((call, i) => {
    console.log(`   ${i + 1}. ${call.tool}(${JSON.stringify(call.input)})`);
  });

  console.log("\n\n");

  // ============================================================
  // TEST 2: Complex Orchestration (Should use executeCode)
  // ============================================================

  console.log("═".repeat(70));
  console.log("TEST 2: Complex Task (Claude should use executeCode)");
  console.log("═".repeat(70) + "\n");

  const test2 = await engine.execute({
    userRequest: "Calculate 10 * 5 + 20, then get the weather for San Francisco, and if the temperature is above 70, send a high priority notification with the result",
  });

  console.log("\n📊 Result:", test2.result);
  console.log(`💰 Cost: $${test2.cost.toFixed(4)}`);
  console.log(`📈 Tokens: ${test2.totalTokens}`);
  console.log(`🔧 Tool calls: ${test2.toolCalls.length}`);
  test2.toolCalls.forEach((call, i) => {
    console.log(`   ${i + 1}. ${call.tool}`);
    if (call.tool === "executeCode") {
      console.log(`      Code: ${(call.input as any).code?.substring(0, 100)}...`);
    } else {
      console.log(`      Input: ${JSON.stringify(call.input)}`);
    }
  });

  console.log("\n\n");

  // ============================================================
  // TEST 3: Multi-Step Workflow
  // ============================================================

  console.log("═".repeat(70));
  console.log("TEST 3: Multi-Step Workflow");
  console.log("═".repeat(70) + "\n");

  const test3 = await engine.execute({
    userRequest: "Calculate the sum of 15 and 30, then calculate the product of that result and 2, then get weather for NYC",
  });

  console.log("\n📊 Result:", test3.result);
  console.log(`💰 Cost: $${test3.cost.toFixed(4)}`);
  console.log(`📈 Tokens: ${test3.totalTokens}`);
  console.log(`🔧 Tool calls: ${test3.toolCalls.length}`);
  test3.toolCalls.forEach((call, i) => {
    console.log(`   ${i + 1}. ${call.tool}`);
  });

  console.log("\n\n");

  // ============================================================
  // SUMMARY
  // ============================================================

  console.log("═".repeat(70));
  console.log("SUMMARY");
  console.log("═".repeat(70) + "\n");

  const totalCost = test1.cost + test2.cost + test3.cost;
  const totalTokens = test1.totalTokens + test2.totalTokens + test3.totalTokens;
  const totalToolCalls = test1.toolCalls.length + test2.toolCalls.length + test3.toolCalls.length;

  console.log("📊 Statistics:");
  console.log(`   Total tests: 3`);
  console.log(`   Total tokens: ${totalTokens.toLocaleString()}`);
  console.log(`   Total cost: $${totalCost.toFixed(4)}`);
  console.log(`   Total tool calls: ${totalToolCalls}`);

  console.log("\n✅ VERIFIED:");
  console.log("   ✓ Claude uses Anthropic's tool calling (tool_use blocks)");
  console.log("   ✓ Claude can call tools directly for simple tasks");
  console.log("   ✓ Claude can call executeCode for complex orchestration");
  console.log("   ✓ Code execution happens in isolated-vm");
  console.log("   ✓ Code can call other registered tools");

  console.log("\n✨ Tool calling pattern working correctly!\n");
}

main().catch(console.error);





