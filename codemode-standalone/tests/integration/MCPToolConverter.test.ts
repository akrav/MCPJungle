/**
 * Integration tests for MCPToolConverter
 * Tests conversion from MCP tools to internal tool format
 */

import { MCPClient } from "../../src/mcp/MCPClient.js";
import { MCPToolConverter } from "../../src/mcp/MCPToolConverter.js";
import { MockMCPServer } from "../mocks/MockMCPServer.js";

async function runTests() {
  console.log("🧪 Testing MCPToolConverter...\n");

  let passedTests = 0;
  let totalTests = 0;

  // Start a mock MCP server for testing
  const mockServer = new MockMCPServer({ port: 3458, verbose: false });
  await mockServer.startServer();

  try {
    // Create and connect a client
    const client = new MCPClient({
      url: mockServer.getServerUrl(),
      transport: "sse",
    });
    await client.connect();

    const converter = new MCPToolConverter();

    // Test 1: Convert MCP tool to internal format
    totalTests++;
    try {
      const mcpTools = client.getTools();
      const firstTool = mcpTools[0];
      const converted = converter.convertTool(firstTool, client);
      
      if (
        converted.name === firstTool.name &&
        converted.description &&
        converted.inputSchema &&
        typeof converted.execute === "function"
      ) {
        console.log("✅ Test 1: Convert MCP tool to internal format");
        passedTests++;
      } else {
        console.log("❌ Test 1: Conversion missing required fields");
      }
    } catch (error) {
      console.log(`❌ Test 1: Convert MCP tool to internal format - ${error}`);
    }

    // Test 2: Schema is preserved
    totalTests++;
    try {
      const mcpTools = client.getTools();
      const tool = mcpTools.find((t) => t.name === "filesystem_read");
      if (!tool) throw new Error("Test tool not found");
      
      const converted = converter.convertTool(tool, client);
      
      if (
        converted.inputSchema === tool.inputSchema &&
        JSON.stringify(converted.inputSchema) === JSON.stringify(tool.inputSchema)
      ) {
        console.log("✅ Test 2: Schema is preserved");
        passedTests++;
      } else {
        console.log("❌ Test 2: Schema not preserved correctly");
      }
    } catch (error) {
      console.log(`❌ Test 2: Schema is preserved - ${error}`);
    }

    // Test 3: Name is preserved
    totalTests++;
    try {
      const mcpTools = client.getTools();
      const tool = mcpTools[0];
      const converted = converter.convertTool(tool, client);
      
      if (converted.name === tool.name) {
        console.log("✅ Test 3: Name is preserved");
        passedTests++;
      } else {
        console.log(`❌ Test 3: Name mismatch: ${converted.name} vs ${tool.name}`);
      }
    } catch (error) {
      console.log(`❌ Test 3: Name is preserved - ${error}`);
    }

    // Test 4: Description is preserved
    totalTests++;
    try {
      const mcpTools = client.getTools();
      const tool = mcpTools.find((t) => t.description);
      if (!tool) throw new Error("No tool with description found");
      
      const converted = converter.convertTool(tool, client);
      
      if (converted.description === tool.description) {
        console.log("✅ Test 4: Description is preserved");
        passedTests++;
      } else {
        console.log("❌ Test 4: Description not preserved");
      }
    } catch (error) {
      console.log(`❌ Test 4: Description is preserved - ${error}`);
    }

    // Test 5: Execute function is created and callable
    totalTests++;
    try {
      const mcpTools = client.getTools();
      const tool = mcpTools.find((t) => t.name === "get_weather");
      if (!tool) throw new Error("get_weather tool not found");
      
      const converted = converter.convertTool(tool, client);
      const result = await converted.execute({ location: "Test City" });
      
      if (result && result.location === "Test City") {
        console.log("✅ Test 5: Execute function is created and callable");
        passedTests++;
      } else {
        console.log(`❌ Test 5: Execute function failed: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      console.log(`❌ Test 5: Execute function is created and callable - ${error}`);
    }

    // Test 6: Convert all tools from client
    totalTests++;
    try {
      const toolSet = converter.convertAllTools(client);
      const toolCount = Object.keys(toolSet).length;
      
      if (toolCount > 0) {
        console.log(`✅ Test 6: Convert all tools from client (${toolCount} tools)`);
        passedTests++;
      } else {
        console.log("❌ Test 6: No tools converted");
      }
    } catch (error) {
      console.log(`❌ Test 6: Convert all tools from client - ${error}`);
    }

    // Test 7: Tool count matches
    totalTests++;
    try {
      const mcpTools = client.getTools();
      const toolSet = converter.convertAllTools(client);
      const convertedCount = Object.keys(toolSet).length;
      
      if (convertedCount === mcpTools.length) {
        console.log("✅ Test 7: Tool count matches");
        passedTests++;
      } else {
        console.log(`❌ Test 7: Count mismatch: ${convertedCount} vs ${mcpTools.length}`);
      }
    } catch (error) {
      console.log(`❌ Test 7: Tool count matches - ${error}`);
    }

    // Test 8: Tools are prefixed with mcp_
    totalTests++;
    try {
      const toolSet = converter.convertAllTools(client);
      const allHavePrefix = Object.keys(toolSet).every((name) => name.startsWith("mcp_"));
      
      if (allHavePrefix) {
        console.log("✅ Test 8: Tools are prefixed with mcp_");
        passedTests++;
      } else {
        console.log("❌ Test 8: Not all tools have mcp_ prefix");
      }
    } catch (error) {
      console.log(`❌ Test 8: Tools are prefixed with mcp_ - ${error}`);
    }

    // Test 9: All tools executable
    totalTests++;
    try {
      const toolSet = converter.convertAllTools(client);
      let allExecutable = true;
      
      for (const [name, tool] of Object.entries(toolSet)) {
        if (typeof tool.execute !== "function") {
          allExecutable = false;
          console.log(`   Tool ${name} has no execute function`);
        }
      }
      
      if (allExecutable) {
        console.log("✅ Test 9: All tools executable");
        passedTests++;
      } else {
        console.log("❌ Test 9: Some tools not executable");
      }
    } catch (error) {
      console.log(`❌ Test 9: All tools executable - ${error}`);
    }

    // Test 10: Converted tools can be executed
    totalTests++;
    try {
      const toolSet = converter.convertAllTools(client);
      const weatherTool = toolSet["mcp_get_weather"];
      
      if (!weatherTool) throw new Error("mcp_get_weather not found");
      
      const result = await weatherTool.execute({ location: "Boston" });
      
      if (result && result.location === "Boston" && result.temperature) {
        console.log("✅ Test 10: Converted tools can be executed");
        passedTests++;
      } else {
        console.log(`❌ Test 10: Execution failed: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      console.log(`❌ Test 10: Converted tools can be executed - ${error}`);
    }

    // Now test multi-client conversion
    // Create a second mock server with different tools
    const mockServer2 = new MockMCPServer({ port: 3459, verbose: false });
    
    // Register custom tools on server 2
    mockServer2.registerTool({
      name: "custom_tool",
      description: "A custom tool from server 2",
      inputSchema: {
        type: "object",
        properties: {
          data: { type: "string" },
        },
        required: ["data"],
      },
      handler: async (args: { data: string }) => {
        return { processed: args.data };
      },
    });
    
    await mockServer2.startServer();

    const client2 = new MCPClient({
      url: mockServer2.getServerUrl(),
      transport: "sse",
    });
    await client2.connect();

    // Test 11: Convert from multiple clients
    totalTests++;
    try {
      const clients = new Map([
        ["server1", client],
        ["server2", client2],
      ]);
      
      const multiTools = converter.convertMultipleClients(clients);
      const toolCount = Object.keys(multiTools).length;
      
      if (toolCount > 0) {
        console.log(`✅ Test 11: Convert from multiple clients (${toolCount} tools)`);
        passedTests++;
      } else {
        console.log("❌ Test 11: No tools converted from multiple clients");
      }
    } catch (error) {
      console.log(`❌ Test 11: Convert from multiple clients - ${error}`);
    }

    // Test 12: Namespacing by client ID
    totalTests++;
    try {
      const clients = new Map([
        ["server1", client],
        ["server2", client2],
      ]);
      
      const multiTools = converter.convertMultipleClients(clients);
      
      const hasServer1Prefix = Object.keys(multiTools).some((name) =>
        name.startsWith("mcp_server1_")
      );
      const hasServer2Prefix = Object.keys(multiTools).some((name) =>
        name.startsWith("mcp_server2_")
      );
      
      if (hasServer1Prefix && hasServer2Prefix) {
        console.log("✅ Test 12: Namespacing by client ID");
        passedTests++;
      } else {
        console.log(
          `❌ Test 12: Missing namespace prefixes (server1: ${hasServer1Prefix}, server2: ${hasServer2Prefix})`
        );
      }
    } catch (error) {
      console.log(`❌ Test 12: Namespacing by client ID - ${error}`);
    }

    // Test 13: No name conflicts
    totalTests++;
    try {
      const clients = new Map([
        ["server1", client],
        ["server2", client2],
      ]);
      
      const multiTools = converter.convertMultipleClients(clients);
      const toolNames = Object.keys(multiTools);
      const uniqueNames = new Set(toolNames);
      
      if (toolNames.length === uniqueNames.size) {
        console.log("✅ Test 13: No name conflicts");
        passedTests++;
      } else {
        console.log(`❌ Test 13: Name conflicts detected (${toolNames.length} vs ${uniqueNames.size})`);
      }
    } catch (error) {
      console.log(`❌ Test 13: No name conflicts - ${error}`);
    }

    // Test 14: All tools from all servers present
    totalTests++;
    try {
      const clients = new Map([
        ["server1", client],
        ["server2", client2],
      ]);
      
      const multiTools = converter.convertMultipleClients(clients);
      
      const server1ToolCount = client.getTools().length;
      const server2ToolCount = client2.getTools().length;
      const totalExpected = server1ToolCount + server2ToolCount;
      const totalActual = Object.keys(multiTools).length;
      
      if (totalActual === totalExpected) {
        console.log("✅ Test 14: All tools from all servers present");
        passedTests++;
      } else {
        console.log(`❌ Test 14: Tool count mismatch (expected ${totalExpected}, got ${totalActual})`);
      }
    } catch (error) {
      console.log(`❌ Test 14: All tools from all servers present - ${error}`);
    }

    // Test 15: Multi-server tools are executable
    totalTests++;
    try {
      const clients = new Map([
        ["server1", client],
        ["server2", client2],
      ]);
      
      const multiTools = converter.convertMultipleClients(clients);
      
      // Try to execute a tool from server 1
      const server1Tool = multiTools["mcp_server1_get_weather"];
      const result1 = await server1Tool.execute({ location: "Chicago" });
      
      // Try to execute a tool from server 2
      const server2Tool = multiTools["mcp_server2_custom_tool"];
      const result2 = await server2Tool.execute({ data: "test" });
      
      if (
        result1 && result1.location === "Chicago" &&
        result2 && result2.processed === "test"
      ) {
        console.log("✅ Test 15: Multi-server tools are executable");
        passedTests++;
      } else {
        console.log("❌ Test 15: Multi-server tool execution failed");
      }
    } catch (error) {
      console.log(`❌ Test 15: Multi-server tools are executable - ${error}`);
    }

    // Clean up
    await client.disconnect();
    await client2.disconnect();
    await mockServer2.stopServer();

  } finally {
    // Clean up: stop the mock server
    await mockServer.stopServer();
    console.log("\n🛑 Mock servers stopped");
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

