/**
 * Basic Anthropic (Claude) Integration Example
 * 
 * This example demonstrates:
 * - Setting up the Anthropic adapter
 * - Generating code with Claude
 * - Executing the generated code
 * - Handling the results
 * 
 * Prerequisites:
 * 1. Set ANTHROPIC_API_KEY in your environment or .env file
 * 2. Run: npm install
 * 
 * Usage:
 * npm run example:anthropic:basic
 */

import { CodemodeEngine } from "../../src/index.js";
import { AnthropicCodeGenerator } from "../../src/llm/AnthropicAdapter.js";
import { z } from "zod";

// Define example tools
const tools = {
  getWeather: {
    name: "getWeather",
    description: "Get the current weather for a location",
    inputSchema: z.object({
      location: z.string().describe("The city name (e.g., 'San Francisco', 'London')"),
      units: z.enum(["fahrenheit", "celsius"]).optional().describe("Temperature units"),
    }),
    execute: async (args: { location: string; units?: string }) => {
      console.log(`[Tool] Getting weather for ${args.location}`);
      
      // Simulate an API call
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const temp = args.units === "celsius" ? 24 : 75;
      return {
        location: args.location,
        temperature: temp,
        units: args.units || "fahrenheit",
        condition: "sunny",
        humidity: 45,
        windSpeed: 8,
      };
    },
  },

  sendNotification: {
    name: "sendNotification",
    description: "Send a notification message to the user",
    inputSchema: z.object({
      message: z.string().describe("The notification message to send"),
      priority: z.enum(["low", "medium", "high"]).describe("Message priority level"),
    }),
    execute: async (args: { message: string; priority: string }) => {
      console.log(`[Tool] 📬 Sending ${args.priority} priority notification`);
      console.log(`       Message: "${args.message}"`);
      
      return {
        sent: true,
        timestamp: new Date().toISOString(),
        messageId: `msg_${Date.now()}`,
      };
    },
  },

  logEvent: {
    name: "logEvent",
    description: "Log an event for tracking purposes",
    inputSchema: z.object({
      event: z.string().describe("Event name"),
      data: z.record(z.any()).optional().describe("Event metadata"),
    }),
    execute: async (args: { event: string; data?: Record<string, any> }) => {
      console.log(`[Tool] 📝 Logging event: ${args.event}`);
      if (args.data) {
        console.log(`       Data:`, JSON.stringify(args.data, null, 2));
      }
      return { logged: true, timestamp: new Date().toISOString() };
    },
  },
};

async function main() {
  console.log("🚀 Anthropic Integration - Basic Example\n");

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ Error: ANTHROPIC_API_KEY environment variable is not set");
    console.error("\nPlease set it in your environment or create a .env file:");
    console.error("  ANTHROPIC_API_KEY=sk-ant-api03-...\n");
    process.exit(1);
  }

  console.log("✅ API key found");
  console.log("🤖 Initializing Claude (claude-3-5-sonnet-20241022)...\n");

  try {
    // Initialize the Anthropic code generator
    const codeGenerator = new AnthropicCodeGenerator({
      model: "claude-3-5-sonnet-20241022",
      temperature: 0.3, // Lower temperature for more deterministic code generation
      maxTokens: 2048,
    });

    // Test the connection
    console.log("🔗 Testing API connection...");
    const connected = await codeGenerator.testConnection();
    if (!connected) {
      throw new Error("Failed to connect to Anthropic API");
    }
    console.log("✅ Connected successfully\n");

    // Create the codemode engine
    const engine = new CodemodeEngine({
      generateCode: (prompt) => codeGenerator.generateCode(prompt),
      tools,
      securityPolicy: {
        maxExecutionTime: 5000, // 5 seconds
        maxMemoryMB: 64, // 64 MB
        allowNetworkAccess: false,
      },
      verbose: false, // Set to true to see detailed logs
    });

    // Example request
    const userRequest = 
      "Check the weather in San Francisco. If it's above 70°F and sunny, send a high priority notification saying it's a great day to go outside.";

    console.log("📝 User Request:");
    console.log(`   "${userRequest}"\n`);
    console.log("⏳ Generating and executing code with Claude...\n");

    // Execute the request
    const startTime = Date.now();
    const response = await engine.execute({
      userRequest,
      context: "The user wants to know if they should go outside today",
    });

    const totalTime = Date.now() - startTime;

    // Display results
    console.log("\n" + "=".repeat(60));
    console.log("📊 RESULTS");
    console.log("=".repeat(60) + "\n");

    if (response.result.success) {
      console.log("✅ Execution successful!");
      console.log(`⏱️  Total time: ${totalTime}ms (execution: ${response.result.executionTime}ms)\n`);
      
      console.log("📤 Result:");
      console.log(JSON.stringify(response.result.result, null, 2));
      
      console.log("\n" + "-".repeat(60));
      console.log("Generated Code:");
      console.log("-".repeat(60));
      console.log(response.code);
      console.log("-".repeat(60));
    } else {
      console.log("❌ Execution failed");
      console.log(`Error: ${response.result.error?.message}`);
      if (response.result.error?.stack) {
        console.log(`Stack: ${response.result.error.stack}`);
      }
    }

    console.log("\n✨ Done!\n");

  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the example
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});






