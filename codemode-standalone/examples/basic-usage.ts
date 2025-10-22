/**
 * Basic usage example of codemode-standalone
 * Demonstrates how to set up tools and execute generated code
 */

import { CodemodeEngine } from "../src/index.js";
import { z } from "zod";

// Simulate an LLM code generation function
// In production, this would call OpenAI, Anthropic, etc.
async function simulateLLMCodeGeneration(prompt: string): Promise<string> {
  console.log("\n=== LLM Prompt ===");
  console.log(prompt);
  console.log("=== End Prompt ===\n");

  // For this example, we'll return pre-written code
  // In production, you'd call your LLM API here
  return `
    const weather = await tools.getWeather({ location: "San Francisco" });
    const temp = weather.temperature;
    
    if (temp > 70) {
      await tools.sendNotification({
        message: \`It's \${temp}°F in San Francisco - great weather!\`,
        priority: "low"
      });
    }
    
    return { weather, temp, sent: temp > 70 };
  `;
}

// Define some example tools
const tools = {
  getWeather: {
    name: "getWeather",
    description: "Get the current weather for a location",
    inputSchema: z.object({
      location: z.string().describe("The city name"),
    }),
    execute: async (args: { location: string }) => {
      console.log(`[Tool] Getting weather for ${args.location}`);
      // Simulate API call
      return {
        location: args.location,
        temperature: 75,
        condition: "sunny",
        humidity: 45,
      };
    },
  },

  sendNotification: {
    name: "sendNotification",
    description: "Send a notification message",
    inputSchema: z.object({
      message: z.string().describe("The notification message"),
      priority: z.enum(["low", "medium", "high"]).describe("Message priority"),
    }),
    execute: async (args: { message: string; priority: string }) => {
      console.log(`[Tool] Sending ${args.priority} priority notification: ${args.message}`);
      return {
        sent: true,
        timestamp: new Date().toISOString(),
      };
    },
  },

  calculateSum: {
    name: "calculateSum",
    description: "Calculate the sum of an array of numbers",
    inputSchema: z.object({
      numbers: z.array(z.number()).describe("Array of numbers to sum"),
    }),
    execute: async (args: { numbers: number[] }) => {
      console.log(`[Tool] Calculating sum of ${args.numbers.length} numbers`);
      const sum = args.numbers.reduce((a, b) => a + b, 0);
      return { sum, count: args.numbers.length };
    },
  },
};

async function main() {
  console.log("🚀 Codemode Standalone - Basic Usage Example\n");

  // Create the codemode engine
  const engine = new CodemodeEngine({
    generateCode: simulateLLMCodeGeneration,
    tools,
    securityPolicy: {
      maxExecutionTime: 5000, // 5 seconds
      maxMemoryMB: 64, // 64 MB
      allowNetworkAccess: false,
    },
    verbose: true,
  });

  // Execute a codemode request
  const request = {
    userRequest: "Check the weather in San Francisco and send a notification if it's nice out",
    context: "The user wants to know if they should go outside today",
  };

  console.log("📝 User Request:", request.userRequest);
  console.log("");

  try {
    const response = await engine.execute(request);

    console.log("\n✅ Execution Result:");
    console.log("Success:", response.result.success);
    console.log("Execution Time:", response.result.executionTime + "ms");
    
    if (response.result.success) {
      console.log("Result:", JSON.stringify(response.result.result, null, 2));
    } else {
      console.log("Error:", response.result.error?.message);
      if (response.result.error?.stack) {
        console.log("Stack:", response.result.error.stack);
      }
    }

    console.log("\n📄 Generated Code:");
    console.log(response.code);

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

main().catch(console.error);






