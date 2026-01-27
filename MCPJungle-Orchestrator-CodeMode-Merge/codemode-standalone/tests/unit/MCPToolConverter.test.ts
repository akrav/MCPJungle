/**
 * Unit tests for MCPToolConverter
 * Tests conversion logic without requiring a live MCP server
 */

import { MCPToolConverter } from "../../src/mcp/MCPToolConverter.js";
import type { MCPTool } from "../../src/mcp/types.js";

// Mock MCP Client for testing
class MockMCPClientForTest {
  constructor(private tools: MCPTool[]) {}

  getTools(): MCPTool[] {
    return this.tools;
  }

  async callTool(name: string, args: Record<string, any>): Promise<any> {
    const tool = this.tools.find((t) => t.name === name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }
    // Simulate tool execution
    return {
      tool: name,
      args,
      result: `Mock result for ${name}`,
    };
  }

  isConnected(): boolean {
    return true;
  }

  getStatus() {
    return {
      connected: true,
      toolCount: this.tools.length,
    };
  }
}

async function runTests() {
  console.log("🧪 Testing MCPToolConverter (Unit)...\n");

  let passedTests = 0;
  let totalTests = 0;

  const mockTools: MCPTool[] = [
    {
      name: "filesystem_read",
      description: "Read a file",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
        },
        required: ["path"],
      },
    },
    {
      name: "get_weather",
      description: "Get weather",
      inputSchema: {
        type: "object",
        properties: {
          location: { type: "string" },
        },
        required: ["location"],
      },
    },
    {
      name: "database_query",
      description: "Query database",
      inputSchema: {
        type: "object",
        properties: {
          sql: { type: "string" },
          params: { type: "array" },
        },
        required: ["sql"],
      },
    },
  ];

  const mockClient = new MockMCPClientForTest(mockTools) as any;
  const converter = new MCPToolConverter();

  // Test 1: Convert single MCP tool
  totalTests++;
  try {
    const mcpTool = mockTools[0];
    const converted = converter.convertTool(mcpTool, mockClient);

    if (
      converted.name === "filesystem_read" &&
      converted.description &&
      typeof converted.execute === "function"
    ) {
      console.log("✅ Test 1: Convert single MCP tool");
      passedTests++;
    } else {
      console.log("❌ Test 1: Conversion failed");
    }
  } catch (error) {
    console.log(`❌ Test 1: ${error}`);
  }

  // Test 2: Schema is preserved
  totalTests++;
  try {
    const mcpTool = mockTools[0];
    const converted = converter.convertTool(mcpTool, mockClient);

    if (JSON.stringify(converted.inputSchema) === JSON.stringify(mcpTool.inputSchema)) {
      console.log("✅ Test 2: Schema is preserved");
      passedTests++;
    } else {
      console.log("❌ Test 2: Schema not preserved");
    }
  } catch (error) {
    console.log(`❌ Test 2: ${error}`);
  }

  // Test 3: Execute function works
  totalTests++;
  try {
    const mcpTool = mockTools[1];
    const converted = converter.convertTool(mcpTool, mockClient);
    const result = await converted.execute({ location: "Test" });

    if (result && result.tool === "get_weather") {
      console.log("✅ Test 3: Execute function works");
      passedTests++;
    } else {
      console.log("❌ Test 3: Execute function failed");
    }
  } catch (error) {
    console.log(`❌ Test 3: ${error}`);
  }

  // Test 4: Convert all tools
  totalTests++;
  try {
    const toolSet = converter.convertAllTools(mockClient);
    const toolCount = Object.keys(toolSet).length;

    if (toolCount === mockTools.length) {
      console.log(`✅ Test 4: Convert all tools (${toolCount} tools)`);
      passedTests++;
    } else {
      console.log(`❌ Test 4: Expected ${mockTools.length} tools, got ${toolCount}`);
    }
  } catch (error) {
    console.log(`❌ Test 4: ${error}`);
  }

  // Test 5: Tools are prefixed with mcp_
  totalTests++;
  try {
    const toolSet = converter.convertAllTools(mockClient);
    const allPrefixed = Object.keys(toolSet).every((name) => name.startsWith("mcp_"));

    if (allPrefixed) {
      console.log("✅ Test 5: Tools are prefixed with mcp_");
      passedTests++;
    } else {
      console.log("❌ Test 5: Not all tools prefixed");
    }
  } catch (error) {
    console.log(`❌ Test 5: ${error}`);
  }

  // Test 6: Converted tools are executable
  totalTests++;
  try {
    const toolSet = converter.convertAllTools(mockClient);
    const weatherTool = toolSet["mcp_get_weather"];

    if (!weatherTool) throw new Error("Tool not found");

    const result = await weatherTool.execute({ location: "Boston" });

    if (result && result.tool === "get_weather") {
      console.log("✅ Test 6: Converted tools are executable");
      passedTests++;
    } else {
      console.log("❌ Test 6: Tool execution failed");
    }
  } catch (error) {
    console.log(`❌ Test 6: ${error}`);
  }

  // Test 7: Multi-client conversion
  totalTests++;
  try {
    const client1 = new MockMCPClientForTest([mockTools[0], mockTools[1]]) as any;
    const client2 = new MockMCPClientForTest([mockTools[2]]) as any;

    const clients = new Map([
      ["server1", client1],
      ["server2", client2],
    ]);

    const multiTools = converter.convertMultipleClients(clients);
    const toolCount = Object.keys(multiTools).length;

    if (toolCount === 3) {
      console.log("✅ Test 7: Multi-client conversion");
      passedTests++;
    } else {
      console.log(`❌ Test 7: Expected 3 tools, got ${toolCount}`);
    }
  } catch (error) {
    console.log(`❌ Test 7: ${error}`);
  }

  // Test 8: Namespacing by client ID
  totalTests++;
  try {
    const client1 = new MockMCPClientForTest([mockTools[0]]) as any;
    const client2 = new MockMCPClientForTest([mockTools[1]]) as any;

    const clients = new Map([
      ["fs", client1],
      ["weather", client2],
    ]);

    const multiTools = converter.convertMultipleClients(clients);

    const hasFsPrefix = "mcp_fs_filesystem_read" in multiTools;
    const hasWeatherPrefix = "mcp_weather_get_weather" in multiTools;

    if (hasFsPrefix && hasWeatherPrefix) {
      console.log("✅ Test 8: Namespacing by client ID");
      passedTests++;
    } else {
      console.log(`❌ Test 8: Namespacing failed (fs: ${hasFsPrefix}, weather: ${hasWeatherPrefix})`);
    }
  } catch (error) {
    console.log(`❌ Test 8: ${error}`);
  }

  // Test 9: No name conflicts in multi-client
  totalTests++;
  try {
    const client1 = new MockMCPClientForTest(mockTools) as any;
    const client2 = new MockMCPClientForTest(mockTools) as any;

    const clients = new Map([
      ["a", client1],
      ["b", client2],
    ]);

    const multiTools = converter.convertMultipleClients(clients);
    const names = Object.keys(multiTools);
    const uniqueNames = new Set(names);

    if (names.length === uniqueNames.size) {
      console.log("✅ Test 9: No name conflicts in multi-client");
      passedTests++;
    } else {
      console.log("❌ Test 9: Name conflicts detected");
    }
  } catch (error) {
    console.log(`❌ Test 9: ${error}`);
  }

  // Test 10: Multi-client tools are executable
  totalTests++;
  try {
    const client1 = new MockMCPClientForTest([mockTools[0]]) as any;
    const client2 = new MockMCPClientForTest([mockTools[1]]) as any;

    const clients = new Map([
      ["fs", client1],
      ["weather", client2],
    ]);

    const multiTools = converter.convertMultipleClients(clients);

    const fsTool = multiTools["mcp_fs_filesystem_read"];
    const weatherTool = multiTools["mcp_weather_get_weather"];

    const result1 = await fsTool.execute({ path: "/test" });
    const result2 = await weatherTool.execute({ location: "NYC" });

    if (result1.tool === "filesystem_read" && result2.tool === "get_weather") {
      console.log("✅ Test 10: Multi-client tools are executable");
      passedTests++;
    } else {
      console.log("❌ Test 10: Multi-client tool execution failed");
    }
  } catch (error) {
    console.log(`❌ Test 10: ${error}`);
  }

  console.log(`\n📊 Results: ${passedTests}/${totalTests} tests passed`);
  return passedTests === totalTests;
}

runTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Test suite failed:", error);
    process.exit(1);
  });

