/**
 * Advanced example showing how to integrate with real LLM APIs
 * Demonstrates OpenAI integration with proper prompt engineering
 */

import { CodemodeEngine } from "../src/index.js";
import { z } from "zod";

// This is a template - you'll need to add your actual API integration
// Uncomment and configure when ready to use with a real LLM:
/*
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateCodeWithOpenAI(prompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a code-generating AI. Generate ONLY JavaScript code, no markdown, no explanations."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.2, // Lower temperature for more consistent code
  });
  
  let code = response.choices[0].message.content || "";
  
  // Clean up any markdown code blocks if the LLM added them
  code = code.replace(/```javascript\n?/g, "").replace(/```\n?/g, "");
  
  return code.trim();
}
*/

// For this example, we'll use a mock that shows what the integration looks like
async function generateCodeMock(prompt: string): Promise<string> {
  console.log("\n📝 Prompt sent to LLM:");
  console.log("─".repeat(80));
  console.log(prompt.substring(0, 500) + "...\n");
  console.log("─".repeat(80));

  // Simulate LLM response
  return `
    // First, get the current weather
    const weather = await tools.getWeather({ location: "New York" });
    
    // Check if it's good weather for outdoor activities
    const isGoodWeather = weather.temperature > 60 && weather.temperature < 80;
    
    if (isGoodWeather) {
      // Calculate multiple days
      const forecast = [];
      for (let i = 0; i < 3; i++) {
        const temp = weather.temperature + Math.random() * 10 - 5;
        forecast.push({ day: i, temperature: Math.round(temp) });
      }
      
      // Send notification
      await tools.sendNotification({
        message: \`Good weather in New York! \${weather.temperature}°F\`,
        priority: "low"
      });
      
      return {
        currentWeather: weather,
        forecast,
        recommendation: "Great weather for outdoor activities!"
      };
    } else {
      await tools.sendNotification({
        message: "Weather not ideal for outdoor activities",
        priority: "medium"
      });
      
      return {
        currentWeather: weather,
        recommendation: "Maybe stay indoors today"
      };
    }
  `;
}

// Define comprehensive tools for the example
const tools = {
  getWeather: {
    name: "getWeather",
    description: "Get the current weather for a specific location",
    inputSchema: z.object({
      location: z.string().describe("The city name or location"),
    }),
    outputSchema: z.object({
      location: z.string(),
      temperature: z.number(),
      condition: z.string(),
      humidity: z.number(),
    }),
    execute: async (args: { location: string }) => {
      console.log(`[Tool Executed] getWeather(${args.location})`);
      // Simulate weather API call
      return {
        location: args.location,
        temperature: 72,
        condition: "partly cloudy",
        humidity: 65,
      };
    },
  },

  sendNotification: {
    name: "sendNotification",
    description: "Send a notification to the user",
    inputSchema: z.object({
      message: z.string().describe("The notification message"),
      priority: z.enum(["low", "medium", "high"]).describe("Message priority"),
    }),
    outputSchema: z.object({
      sent: z.boolean(),
      timestamp: z.string(),
    }),
    execute: async (args: { message: string; priority: string }) => {
      console.log(`[Tool Executed] sendNotification(priority=${args.priority})`);
      console.log(`  Message: ${args.message}`);
      return {
        sent: true,
        timestamp: new Date().toISOString(),
      };
    },
  },

  searchDatabase: {
    name: "searchDatabase",
    description: "Search a database for records matching criteria",
    inputSchema: z.object({
      table: z.string().describe("The table name"),
      query: z.string().describe("Search query"),
      limit: z.number().optional().describe("Maximum results to return"),
    }),
    outputSchema: z.object({
      results: z.array(z.any()),
      count: z.number(),
    }),
    execute: async (args: { table: string; query: string; limit?: number }) => {
      console.log(`[Tool Executed] searchDatabase(table=${args.table})`);
      // Simulate database search
      return {
        results: [
          { id: 1, name: "Record 1" },
          { id: 2, name: "Record 2" },
        ],
        count: 2,
      };
    },
  },
};

async function main() {
  console.log("🚀 Advanced LLM Integration Example\n");

  // Create the codemode engine with comprehensive configuration
  const engine = new CodemodeEngine({
    generateCode: generateCodeMock, // Replace with generateCodeWithOpenAI when ready
    tools,
    securityPolicy: {
      maxExecutionTime: 10000, // 10 seconds
      maxMemoryMB: 128,
      allowNetworkAccess: false, // Tools handle external calls
    },
    verbose: true,
  });

  // Example 1: Simple request
  console.log("\n" + "=".repeat(80));
  console.log("Example 1: Weather Check with Conditional Logic");
  console.log("=".repeat(80));

  const request1 = {
    userRequest: "Check the weather in New York and let me know if it's good for outdoor activities",
    context: "The user is planning their day and wants weather-based recommendations",
  };

  try {
    const response = await engine.execute(request1);

    console.log("\n✅ Execution Complete!");
    console.log("─".repeat(80));
    console.log("Success:", response.result.success);
    console.log("Execution Time:", response.result.executionTime + "ms");

    if (response.result.success) {
      console.log("\n📦 Result:");
      console.log(JSON.stringify(response.result.result, null, 2));
    } else {
      console.log("\n❌ Error:", response.result.error?.message);
    }

    console.log("\n💻 Generated Code:");
    console.log("─".repeat(80));
    console.log(response.code);
    console.log("─".repeat(80));
  } catch (error) {
    console.error("❌ Error:", error);
  }

  // Example 2: Show type definitions that were generated
  console.log("\n" + "=".repeat(80));
  console.log("Generated TypeScript Definitions (provided to LLM):");
  console.log("=".repeat(80));

  // Get the type definitions by executing a simple request
  const typeCheck = await engine.execute({
    userRequest: "return true",
  });

  console.log("\n" + typeCheck.typeDefinitions);
  console.log("=".repeat(80));

  // Example 3: Demonstrate error handling
  console.log("\n" + "=".repeat(80));
  console.log("Example 2: Error Handling");
  console.log("=".repeat(80));

  // Create an engine with intentionally bad code to show error handling
  const errorEngine = new CodemodeEngine({
    generateCode: async () => {
      // Generate code with an error
      return `
        const result = await tools.nonExistentTool({ foo: "bar" });
        return result;
      `;
    },
    tools,
    securityPolicy: {
      maxExecutionTime: 5000,
      maxMemoryMB: 64,
    },
  });

  try {
    const response = await errorEngine.execute({
      userRequest: "test error handling",
    });

    console.log("\n📊 Error Handling Result:");
    console.log("Success:", response.result.success);
    if (!response.result.success) {
      console.log("Error Message:", response.result.error?.message);
    }
  } catch (error) {
    console.error("❌ Caught Error:", error);
  }

  console.log("\n✨ Examples complete!");
  console.log("\nTo use with a real LLM:");
  console.log("1. Uncomment the OpenAI integration code at the top");
  console.log("2. Install: npm install openai");
  console.log("3. Set OPENAI_API_KEY environment variable");
  console.log("4. Replace generateCodeMock with generateCodeWithOpenAI");
}

main().catch(console.error);






