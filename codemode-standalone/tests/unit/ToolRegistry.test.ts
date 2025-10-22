/**
 * Unit tests for ToolRegistry
 */

import { ToolRegistry } from "../../src/core/ToolRegistry.js";
import { z } from "zod";
import type { Tool, ToolSet } from "../../src/types/index.js";

// Test tool definitions
const testTools: ToolSet = {
  testTool1: {
    name: "testTool1",
    description: "A test tool",
    inputSchema: z.object({
      value: z.string(),
    }),
    execute: async (args: { value: string }) => {
      return { result: `Processed: ${args.value}` };
    },
  },
  testTool2: {
    name: "testTool2",
    description: "Another test tool",
    inputSchema: z.object({
      count: z.number(),
    }),
    execute: async (args: { count: number }) => {
      return { count: args.count * 2 };
    },
  },
};

async function runTests() {
  console.log("🧪 Testing ToolRegistry...\n");

  let passedTests = 0;
  let totalTests = 0;

  // Test 1: Create empty registry
  totalTests++;
  try {
    const registry = new ToolRegistry();
    if (registry.size === 0) {
      console.log("✅ Test 1: Create empty registry");
      passedTests++;
    } else {
      console.log("❌ Test 1: Create empty registry - Expected size 0");
    }
  } catch (error) {
    console.log(`❌ Test 1: Create empty registry - ${error}`);
  }

  // Test 2: Create registry with initial tools
  totalTests++;
  try {
    const registry = new ToolRegistry(testTools);
    if (registry.size === 2) {
      console.log("✅ Test 2: Create registry with initial tools");
      passedTests++;
    } else {
      console.log(`❌ Test 2: Expected size 2, got ${registry.size}`);
    }
  } catch (error) {
    console.log(`❌ Test 2: Create registry with initial tools - ${error}`);
  }

  // Test 3: Register a single tool
  totalTests++;
  try {
    const registry = new ToolRegistry();
    const tool: Tool = {
      name: "newTool",
      description: "New tool",
      inputSchema: z.object({}),
      execute: async () => ({ success: true }),
    };
    registry.registerTool("newTool", tool);
    if (registry.size === 1 && registry.hasTool("newTool")) {
      console.log("✅ Test 3: Register a single tool");
      passedTests++;
    } else {
      console.log("❌ Test 3: Register a single tool - Tool not found");
    }
  } catch (error) {
    console.log(`❌ Test 3: Register a single tool - ${error}`);
  }

  // Test 4: Prevent duplicate tool registration
  totalTests++;
  try {
    const registry = new ToolRegistry();
    const tool: Tool = {
      name: "dupeTool",
      description: "Test",
      inputSchema: z.object({}),
      execute: async () => ({}),
    };
    registry.registerTool("dupeTool", tool);
    let errorThrown = false;
    try {
      registry.registerTool("dupeTool", tool);
    } catch (e) {
      errorThrown = true;
    }
    if (errorThrown) {
      console.log("✅ Test 4: Prevent duplicate tool registration");
      passedTests++;
    } else {
      console.log("❌ Test 4: Should throw error on duplicate registration");
    }
  } catch (error) {
    console.log(`❌ Test 4: Prevent duplicate tool registration - ${error}`);
  }

  // Test 5: Get a tool
  totalTests++;
  try {
    const registry = new ToolRegistry(testTools);
    const tool = registry.getTool("testTool1");
    if (tool && tool.name === "testTool1") {
      console.log("✅ Test 5: Get a tool");
      passedTests++;
    } else {
      console.log("❌ Test 5: Get a tool - Tool not found or incorrect");
    }
  } catch (error) {
    console.log(`❌ Test 5: Get a tool - ${error}`);
  }

  // Test 6: Get non-existent tool
  totalTests++;
  try {
    const registry = new ToolRegistry(testTools);
    const tool = registry.getTool("nonExistent");
    if (tool === undefined) {
      console.log("✅ Test 6: Get non-existent tool returns undefined");
      passedTests++;
    } else {
      console.log("❌ Test 6: Should return undefined for non-existent tool");
    }
  } catch (error) {
    console.log(`❌ Test 6: Get non-existent tool - ${error}`);
  }

  // Test 7: Execute a tool
  totalTests++;
  try {
    const registry = new ToolRegistry(testTools);
    const result = await registry.executeTool("testTool1", { value: "test" });
    if (result.result === "Processed: test") {
      console.log("✅ Test 7: Execute a tool");
      passedTests++;
    } else {
      console.log(`❌ Test 7: Unexpected result: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    console.log(`❌ Test 7: Execute a tool - ${error}`);
  }

  // Test 8: Execute non-existent tool throws error
  totalTests++;
  try {
    const registry = new ToolRegistry(testTools);
    let errorThrown = false;
    try {
      await registry.executeTool("nonExistent", {});
    } catch (e) {
      errorThrown = true;
    }
    if (errorThrown) {
      console.log("✅ Test 8: Execute non-existent tool throws error");
      passedTests++;
    } else {
      console.log("❌ Test 8: Should throw error for non-existent tool");
    }
  } catch (error) {
    console.log(`❌ Test 8: Execute non-existent tool - ${error}`);
  }

  // Test 9: Get all tools
  totalTests++;
  try {
    const registry = new ToolRegistry(testTools);
    const allTools = registry.getAllTools();
    if (Object.keys(allTools).length === 2 && allTools.testTool1 && allTools.testTool2) {
      console.log("✅ Test 9: Get all tools");
      passedTests++;
    } else {
      console.log("❌ Test 9: Get all tools - Incorrect tools returned");
    }
  } catch (error) {
    console.log(`❌ Test 9: Get all tools - ${error}`);
  }

  // Test 10: Get tool names
  totalTests++;
  try {
    const registry = new ToolRegistry(testTools);
    const names = registry.getToolNames();
    if (names.length === 2 && names.includes("testTool1") && names.includes("testTool2")) {
      console.log("✅ Test 10: Get tool names");
      passedTests++;
    } else {
      console.log(`❌ Test 10: Expected [testTool1, testTool2], got ${JSON.stringify(names)}`);
    }
  } catch (error) {
    console.log(`❌ Test 10: Get tool names - ${error}`);
  }

  // Test 11: Unregister a tool
  totalTests++;
  try {
    const registry = new ToolRegistry(testTools);
    const removed = registry.unregisterTool("testTool1");
    if (removed && registry.size === 1 && !registry.hasTool("testTool1")) {
      console.log("✅ Test 11: Unregister a tool");
      passedTests++;
    } else {
      console.log("❌ Test 11: Unregister a tool - Tool still exists");
    }
  } catch (error) {
    console.log(`❌ Test 11: Unregister a tool - ${error}`);
  }

  // Test 12: Clear all tools
  totalTests++;
  try {
    const registry = new ToolRegistry(testTools);
    registry.clear();
    if (registry.size === 0) {
      console.log("✅ Test 12: Clear all tools");
      passedTests++;
    } else {
      console.log(`❌ Test 12: Expected size 0 after clear, got ${registry.size}`);
    }
  } catch (error) {
    console.log(`❌ Test 12: Clear all tools - ${error}`);
  }

  console.log(`\n📊 Results: ${passedTests}/${totalTests} tests passed`);
  return passedTests === totalTests;
}

runTests().then((success) => {
  process.exit(success ? 0 : 1);
}).catch((error) => {
  console.error("Test suite failed:", error);
  process.exit(1);
});

