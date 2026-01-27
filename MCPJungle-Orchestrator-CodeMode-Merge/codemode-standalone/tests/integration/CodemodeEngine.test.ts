/**
 * Integration tests for the full CodemodeEngine
 * Tests end-to-end functionality
 */

import { CodemodeEngine } from "../../src/core/CodemodeEngine.js";
import { z } from "zod";

async function runTests() {
  console.log("🧪 Testing CodemodeEngine (End-to-End)...\n");

  let passedTests = 0;
  let totalTests = 0;

  // Setup tools
  const tools = {
    getWeather: {
      name: "getWeather",
      description: "Get weather for a location",
      inputSchema: z.object({
        location: z.string(),
      }),
      outputSchema: z.object({
        temperature: z.number(),
        condition: z.string(),
      }),
      execute: async (args: { location: string }) => {
        return {
          location: args.location,
          temperature: 72,
          condition: "sunny",
        };
      },
    },
    calculateSum: {
      name: "calculateSum",
      description: "Sum an array of numbers",
      inputSchema: z.object({
        numbers: z.array(z.number()),
      }),
      execute: async (args: { numbers: number[] }) => {
        return { sum: args.numbers.reduce((a, b) => a + b, 0) };
      },
    },
    sendNotification: {
      name: "sendNotification",
      description: "Send a notification",
      inputSchema: z.object({
        message: z.string(),
        priority: z.enum(["low", "medium", "high"]),
      }),
      execute: async (args: { message: string; priority: string }) => {
        return { sent: true, timestamp: new Date().toISOString() };
      },
    },
  };

  // Mock LLM function that generates test code
  const mockLLM = (scenario: string) => async (prompt: string) => {
    if (scenario === "simple") {
      return `return { result: "simple" };`;
    } else if (scenario === "weather") {
      return `
        const weather = await tools.getWeather({ location: "New York" });
        return { temperature: weather.temperature };
      `;
    } else if (scenario === "multi-tool") {
      return `
        const weather = await tools.getWeather({ location: "Boston" });
        const sum = await tools.calculateSum({ numbers: [1, 2, 3] });
        const notification = await tools.sendNotification({ 
          message: "Test", 
          priority: "low" 
        });
        return { weather, sum, notification };
      `;
    } else if (scenario === "conditional") {
      return `
        const weather = await tools.getWeather({ location: "Seattle" });
        if (weather.temperature > 70) {
          await tools.sendNotification({ 
            message: "Nice weather!", 
            priority: "low" 
          });
          return { sent: true, temp: weather.temperature };
        } else {
          return { sent: false, temp: weather.temperature };
        }
      `;
    } else if (scenario === "data-processing") {
      return `
        const numbers = [10, 20, 30, 40];
        const doubled = numbers.map(n => n * 2);
        const sum = await tools.calculateSum({ numbers: doubled });
        return { doubled, sum: sum.sum };
      `;
    }
    return `return { error: "unknown scenario" };`;
  };

  // Test 1: Create engine
  totalTests++;
  try {
    const engine = new CodemodeEngine({
      generateCode: mockLLM("simple"),
      tools,
    });
    console.log("✅ Test 1: Create CodemodeEngine");
    passedTests++;
  } catch (error) {
    console.log(`❌ Test 1: Create CodemodeEngine - ${error}`);
  }

  // Test 2: Execute simple request
  totalTests++;
  try {
    const engine = new CodemodeEngine({
      generateCode: mockLLM("simple"),
      tools,
    });
    const response = await engine.execute({
      userRequest: "Return a simple result",
    });
    if (response.result.success && response.result.result?.result === "simple") {
      console.log("✅ Test 2: Execute simple request");
      passedTests++;
    } else {
      console.log("❌ Test 2: Simple request failed");
      console.log("Response:", response);
    }
  } catch (error) {
    console.log(`❌ Test 2: Execute simple request - ${error}`);
  }

  // Test 3: Execute request with tool call
  totalTests++;
  try {
    const engine = new CodemodeEngine({
      generateCode: mockLLM("weather"),
      tools,
    });
    const response = await engine.execute({
      userRequest: "Get the weather",
    });
    if (response.result.success && response.result.result?.temperature === 72) {
      console.log("✅ Test 3: Execute request with tool call");
      passedTests++;
    } else {
      console.log("❌ Test 3: Tool call request failed");
      console.log("Response:", response);
    }
  } catch (error) {
    console.log(`❌ Test 3: Execute request with tool call - ${error}`);
  }

  // Test 4: Execute request with multiple tool calls
  totalTests++;
  try {
    const engine = new CodemodeEngine({
      generateCode: mockLLM("multi-tool"),
      tools,
    });
    const response = await engine.execute({
      userRequest: "Use multiple tools",
    });
    if (
      response.result.success &&
      response.result.result?.weather &&
      response.result.result?.sum &&
      response.result.result?.notification
    ) {
      console.log("✅ Test 4: Execute request with multiple tool calls");
      passedTests++;
    } else {
      console.log("❌ Test 4: Multiple tool calls failed");
      console.log("Response:", response);
    }
  } catch (error) {
    console.log(`❌ Test 4: Execute request with multiple tool calls - ${error}`);
  }

  // Test 5: Execute request with conditional logic
  totalTests++;
  try {
    const engine = new CodemodeEngine({
      generateCode: mockLLM("conditional"),
      tools,
    });
    const response = await engine.execute({
      userRequest: "Check weather and notify if nice",
    });
    if (response.result.success && typeof response.result.result?.sent === "boolean") {
      console.log("✅ Test 5: Execute request with conditional logic");
      passedTests++;
    } else {
      console.log("❌ Test 5: Conditional logic failed");
      console.log("Response:", response);
    }
  } catch (error) {
    console.log(`❌ Test 5: Execute request with conditional logic - ${error}`);
  }

  // Test 6: Execute request with data processing
  totalTests++;
  try {
    const engine = new CodemodeEngine({
      generateCode: mockLLM("data-processing"),
      tools,
    });
    const response = await engine.execute({
      userRequest: "Process some data",
    });
    if (
      response.result.success &&
      response.result.result?.sum === 200 &&
      Array.isArray(response.result.result?.doubled)
    ) {
      console.log("✅ Test 6: Execute request with data processing");
      passedTests++;
    } else {
      console.log("❌ Test 6: Data processing failed");
      console.log("Response:", response);
    }
  } catch (error) {
    console.log(`❌ Test 6: Execute request with data processing - ${error}`);
  }

  // Test 7: Type definitions are generated
  totalTests++;
  try {
    const engine = new CodemodeEngine({
      generateCode: mockLLM("simple"),
      tools,
    });
    const response = await engine.execute({
      userRequest: "Test types",
    });
    if (
      response.typeDefinitions &&
      response.typeDefinitions.includes("declare const tools")
    ) {
      console.log("✅ Test 7: Type definitions are generated");
      passedTests++;
    } else {
      console.log("❌ Test 7: Type definitions not generated");
    }
  } catch (error) {
    console.log(`❌ Test 7: Type definitions generation - ${error}`);
  }

  // Test 8: Generated code is returned
  totalTests++;
  try {
    const engine = new CodemodeEngine({
      generateCode: mockLLM("simple"),
      tools,
    });
    const response = await engine.execute({
      userRequest: "Test code return",
    });
    if (response.code && response.code.includes("return")) {
      console.log("✅ Test 8: Generated code is returned");
      passedTests++;
    } else {
      console.log("❌ Test 8: Generated code not returned");
    }
  } catch (error) {
    console.log(`❌ Test 8: Generated code return - ${error}`);
  }

  // Test 9: Add tools dynamically
  totalTests++;
  try {
    const engine = new CodemodeEngine({
      generateCode: mockLLM("simple"),
      tools: { getWeather: tools.getWeather },
    });
    
    // Add more tools
    engine.addTools({
      newTool: {
        name: "newTool",
        description: "A new tool",
        inputSchema: z.object({}),
        execute: async () => ({ success: true }),
      },
    });

    const response = await engine.execute({
      userRequest: "Test",
    });
    
    if (response.result.success) {
      console.log("✅ Test 9: Add tools dynamically");
      passedTests++;
    } else {
      console.log("❌ Test 9: Dynamic tool addition failed");
    }
  } catch (error) {
    console.log(`❌ Test 9: Add tools dynamically - ${error}`);
  }

  // Test 10: Remove tools
  totalTests++;
  try {
    const engine = new CodemodeEngine({
      generateCode: mockLLM("simple"),
      tools,
    });
    
    engine.removeTool("calculateSum");
    
    const response = await engine.execute({
      userRequest: "Test",
    });
    
    // Type definitions should not include the removed tool
    if (response.typeDefinitions && !response.typeDefinitions.includes("calculateSum")) {
      console.log("✅ Test 10: Remove tools");
      passedTests++;
    } else {
      console.log("❌ Test 10: Tool removal failed");
    }
  } catch (error) {
    console.log(`❌ Test 10: Remove tools - ${error}`);
  }

  // Test 11: Custom security policy
  totalTests++;
  try {
    const engine = new CodemodeEngine({
      generateCode: mockLLM("simple"),
      tools,
      securityPolicy: {
        maxExecutionTime: 10000,
        maxMemoryMB: 256,
        allowNetworkAccess: false,
      },
    });
    
    const policy = engine.getSecurityPolicy();
    if (policy.maxExecutionTime === 10000 && policy.maxMemoryMB === 256) {
      console.log("✅ Test 11: Custom security policy");
      passedTests++;
    } else {
      console.log("❌ Test 11: Security policy not set correctly");
    }
  } catch (error) {
    console.log(`❌ Test 11: Custom security policy - ${error}`);
  }

  // Test 12: Update security policy
  totalTests++;
  try {
    const engine = new CodemodeEngine({
      generateCode: mockLLM("simple"),
      tools,
    });
    
    engine.updateSecurityPolicy({ maxExecutionTime: 15000 });
    const policy = engine.getSecurityPolicy();
    
    if (policy.maxExecutionTime === 15000) {
      console.log("✅ Test 12: Update security policy");
      passedTests++;
    } else {
      console.log("❌ Test 12: Security policy update failed");
    }
  } catch (error) {
    console.log(`❌ Test 12: Update security policy - ${error}`);
  }

  // Test 13: Verbose mode doesn't crash
  totalTests++;
  try {
    const engine = new CodemodeEngine({
      generateCode: mockLLM("simple"),
      tools,
      verbose: true, // Enable verbose logging
    });
    
    const response = await engine.execute({
      userRequest: "Test verbose",
    });
    
    if (response.result.success) {
      console.log("✅ Test 13: Verbose mode works");
      passedTests++;
    } else {
      console.log("❌ Test 13: Verbose mode failed");
    }
  } catch (error) {
    console.log(`❌ Test 13: Verbose mode - ${error}`);
  }

  // Test 14: Request with context
  totalTests++;
  try {
    const engine = new CodemodeEngine({
      generateCode: async (prompt) => {
        // Verify context is in prompt
        if (prompt.includes("ADDITIONAL CONTEXT") && prompt.includes("Test context")) {
          return `return { hasContext: true };`;
        }
        return `return { hasContext: false };`;
      },
      tools,
    });
    
    const response = await engine.execute({
      userRequest: "Test",
      context: "Test context",
    });
    
    if (response.result.success && response.result.result?.hasContext) {
      console.log("✅ Test 14: Request with context");
      passedTests++;
    } else {
      console.log("❌ Test 14: Context not passed to LLM");
    }
  } catch (error) {
    console.log(`❌ Test 14: Request with context - ${error}`);
  }

  // Test 15: Error handling for bad generated code
  totalTests++;
  try {
    const engine = new CodemodeEngine({
      generateCode: async () => {
        // Generate code with error
        return `throw new Error("Test error");`;
      },
      tools,
    });
    
    const response = await engine.execute({
      userRequest: "Test error",
    });
    
    if (!response.result.success && response.result.error) {
      console.log("✅ Test 15: Error handling for bad generated code");
      passedTests++;
    } else {
      console.log("❌ Test 15: Error should have been caught");
    }
  } catch (error) {
    console.log(`❌ Test 15: Error handling - ${error}`);
  }

  console.log(`\n📊 Results: ${passedTests}/${totalTests} tests passed`);
  return passedTests === totalTests;
}

runTests()
  .then((success) => {
    console.log(
      `\n${success ? "✅ All tests passed!" : "⚠️  Some tests failed - see above for details"}`
    );
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Test suite failed:", error);
    process.exit(1);
  });

