/**
 * Integration tests for MCPClient
 * Tests connection, tool discovery, and tool execution with mock MCP server
 */

import { MCPClient } from "../../src/mcp/MCPClient.js";
import { MockMCPServer } from "../mocks/MockMCPServer.js";

async function runTests() {
  console.log("🧪 Testing MCPClient...\n");

  let passedTests = 0;
  let totalTests = 0;

  // Start a mock MCP server for testing
  const mockServer = new MockMCPServer({ port: 3457, verbose: false });
  await mockServer.startServer();

  console.log(`🚀 Mock server started at ${mockServer.getServerUrl()}\n`);

  try {
    // Test 1: Create client with SSE config
    totalTests++;
    try {
      const client = new MCPClient({
        url: mockServer.getServerUrl(),
        transport: "sse",
      });
      console.log("✅ Test 1: Create client with SSE config");
      passedTests++;
    } catch (error) {
      console.log(`❌ Test 1: Create client with SSE config - ${error}`);
    }

    // Test 2: Connect successfully
    totalTests++;
    try {
      const client = new MCPClient({
        url: mockServer.getServerUrl(),
        transport: "sse",
      });
      await client.connect();
      if (client.isConnected()) {
        console.log("✅ Test 2: Connect successfully");
        passedTests++;
      } else {
        console.log("❌ Test 2: Client should be connected");
      }
      await client.disconnect();
    } catch (error) {
      console.log(`❌ Test 2: Connect successfully - ${error}`);
    }

    // Test 3: Check connection status
    totalTests++;
    try {
      const client = new MCPClient({
        url: mockServer.getServerUrl(),
        transport: "sse",
      });
      await client.connect();
      const status = client.getStatus();
      if (status.connected && status.toolCount >= 0) {
        console.log("✅ Test 3: Check connection status");
        passedTests++;
      } else {
        console.log(`❌ Test 3: Invalid status: ${JSON.stringify(status)}`);
      }
      await client.disconnect();
    } catch (error) {
      console.log(`❌ Test 3: Check connection status - ${error}`);
    }

    // Test 4: List tools from server
    totalTests++;
    try {
      const client = new MCPClient({
        url: mockServer.getServerUrl(),
        transport: "sse",
      });
      await client.connect();
      const tools = client.getTools();
      if (tools.length > 0) {
        console.log(`✅ Test 4: List tools from server (found ${tools.length} tools)`);
        passedTests++;
      } else {
        console.log("❌ Test 4: Should have discovered tools");
      }
      await client.disconnect();
    } catch (error) {
      console.log(`❌ Test 4: List tools from server - ${error}`);
    }

    // Test 5: Tools are correctly formatted
    totalTests++;
    try {
      const client = new MCPClient({
        url: mockServer.getServerUrl(),
        transport: "sse",
      });
      await client.connect();
      const tools = client.getTools();
      const firstTool = tools[0];
      if (
        firstTool &&
        firstTool.name &&
        firstTool.inputSchema &&
        firstTool.inputSchema.type === "object"
      ) {
        console.log("✅ Test 5: Tools are correctly formatted");
        passedTests++;
      } else {
        console.log(`❌ Test 5: Tool format invalid: ${JSON.stringify(firstTool)}`);
      }
      await client.disconnect();
    } catch (error) {
      console.log(`❌ Test 5: Tools are correctly formatted - ${error}`);
    }

    // Test 6: Execute tool successfully
    totalTests++;
    try {
      const client = new MCPClient({
        url: mockServer.getServerUrl(),
        transport: "sse",
      });
      await client.connect();
      const result = await client.callTool("get_weather", {
        location: "San Francisco",
      });
      if (result && result.location === "San Francisco") {
        console.log("✅ Test 6: Execute tool successfully");
        passedTests++;
      } else {
        console.log(`❌ Test 6: Unexpected result: ${JSON.stringify(result)}`);
      }
      await client.disconnect();
    } catch (error) {
      console.log(`❌ Test 6: Execute tool successfully - ${error}`);
    }

    // Test 7: Pass arguments correctly
    totalTests++;
    try {
      const client = new MCPClient({
        url: mockServer.getServerUrl(),
        transport: "sse",
      });
      await client.connect();
      const result = await client.callTool("filesystem_read", {
        path: "/test/file.txt",
      });
      if (result && result.path === "/test/file.txt") {
        console.log("✅ Test 7: Pass arguments correctly");
        passedTests++;
      } else {
        console.log(`❌ Test 7: Arguments not passed correctly: ${JSON.stringify(result)}`);
      }
      await client.disconnect();
    } catch (error) {
      console.log(`❌ Test 7: Pass arguments correctly - ${error}`);
    }

    // Test 8: Parse JSON results
    totalTests++;
    try {
      const client = new MCPClient({
        url: mockServer.getServerUrl(),
        transport: "sse",
      });
      await client.connect();
      const result = await client.callTool("database_query", {
        sql: "SELECT * FROM users",
      });
      if (result && result.rows && Array.isArray(result.rows)) {
        console.log("✅ Test 8: Parse JSON results");
        passedTests++;
      } else {
        console.log(`❌ Test 8: JSON not parsed correctly: ${JSON.stringify(result)}`);
      }
      await client.disconnect();
    } catch (error) {
      console.log(`❌ Test 8: Parse JSON results - ${error}`);
    }

    // Test 9: Handle non-existent tool calls
    totalTests++;
    try {
      const client = new MCPClient({
        url: mockServer.getServerUrl(),
        transport: "sse",
      });
      await client.connect();
      let errorThrown = false;
      try {
        await client.callTool("non_existent_tool", {});
      } catch (e) {
        errorThrown = true;
      }
      if (errorThrown) {
        console.log("✅ Test 9: Handle non-existent tool calls");
        passedTests++;
      } else {
        console.log("❌ Test 9: Should throw error for non-existent tool");
      }
      await client.disconnect();
    } catch (error) {
      console.log(`❌ Test 9: Handle non-existent tool calls - ${error}`);
    }

    // Test 10: Disconnect cleanly
    totalTests++;
    try {
      const client = new MCPClient({
        url: mockServer.getServerUrl(),
        transport: "sse",
      });
      await client.connect();
      await client.disconnect();
      if (!client.isConnected()) {
        console.log("✅ Test 10: Disconnect cleanly");
        passedTests++;
      } else {
        console.log("❌ Test 10: Client should be disconnected");
      }
    } catch (error) {
      console.log(`❌ Test 10: Disconnect cleanly - ${error}`);
    }

    // Test 11: Check disconnected status
    totalTests++;
    try {
      const client = new MCPClient({
        url: mockServer.getServerUrl(),
        transport: "sse",
      });
      await client.connect();
      await client.disconnect();
      const status = client.getStatus();
      if (!status.connected) {
        console.log("✅ Test 11: Check disconnected status");
        passedTests++;
      } else {
        console.log("❌ Test 11: Status should show disconnected");
      }
    } catch (error) {
      console.log(`❌ Test 11: Check disconnected status - ${error}`);
    }

    // Test 12: Multiple sequential calls
    totalTests++;
    try {
      const client = new MCPClient({
        url: mockServer.getServerUrl(),
        transport: "sse",
      });
      await client.connect();
      
      const result1 = await client.callTool("get_weather", { location: "NYC" });
      const result2 = await client.callTool("get_weather", { location: "LA" });
      const result3 = await client.callTool("filesystem_read", { path: "/test.txt" });
      
      if (
        result1.location === "NYC" &&
        result2.location === "LA" &&
        result3.path === "/test.txt"
      ) {
        console.log("✅ Test 12: Multiple sequential calls");
        passedTests++;
      } else {
        console.log("❌ Test 12: Sequential calls failed");
      }
      await client.disconnect();
    } catch (error) {
      console.log(`❌ Test 12: Multiple sequential calls - ${error}`);
    }

    // Test 13: Tool call with complex arguments
    totalTests++;
    try {
      const client = new MCPClient({
        url: mockServer.getServerUrl(),
        transport: "sse",
      });
      await client.connect();
      
      const result = await client.callTool("database_query", {
        sql: "SELECT * FROM users WHERE id = ?",
        params: [123, "test", { nested: true }],
      });
      
      if (result && result.rows) {
        console.log("✅ Test 13: Tool call with complex arguments");
        passedTests++;
      } else {
        console.log("❌ Test 13: Complex arguments not handled");
      }
      await client.disconnect();
    } catch (error) {
      console.log(`❌ Test 13: Tool call with complex arguments - ${error}`);
    }

    // Test 14: Reconnect after disconnect
    totalTests++;
    try {
      const client = new MCPClient({
        url: mockServer.getServerUrl(),
        transport: "sse",
      });
      
      await client.connect();
      await client.disconnect();
      await client.connect();
      
      const tools = client.getTools();
      if (client.isConnected() && tools.length > 0) {
        console.log("✅ Test 14: Reconnect after disconnect");
        passedTests++;
      } else {
        console.log("❌ Test 14: Reconnection failed");
      }
      await client.disconnect();
    } catch (error) {
      console.log(`❌ Test 14: Reconnect after disconnect - ${error}`);
    }

    // Test 15: Get tools before connection returns empty
    totalTests++;
    try {
      const client = new MCPClient({
        url: mockServer.getServerUrl(),
        transport: "sse",
      });
      
      const tools = client.getTools();
      if (tools.length === 0) {
        console.log("✅ Test 15: Get tools before connection returns empty");
        passedTests++;
      } else {
        console.log("❌ Test 15: Should return empty array before connection");
      }
    } catch (error) {
      console.log(`❌ Test 15: Get tools before connection - ${error}`);
    }

    // Test 16: Call tool before connection throws error
    totalTests++;
    try {
      const client = new MCPClient({
        url: mockServer.getServerUrl(),
        transport: "sse",
      });
      
      let errorThrown = false;
      try {
        await client.callTool("get_weather", { location: "Test" });
      } catch (e) {
        errorThrown = true;
      }
      
      if (errorThrown) {
        console.log("✅ Test 16: Call tool before connection throws error");
        passedTests++;
      } else {
        console.log("❌ Test 16: Should throw error when calling tool before connection");
      }
    } catch (error) {
      console.log(`❌ Test 16: Call tool before connection - ${error}`);
    }

    // Test 17: Connection error handling
    totalTests++;
    try {
      const client = new MCPClient({
        url: "http://localhost:9999/nonexistent",
        transport: "sse",
      });
      
      let errorThrown = false;
      try {
        await client.connect();
      } catch (e) {
        errorThrown = true;
      }
      
      if (errorThrown) {
        console.log("✅ Test 17: Connection error handling");
        passedTests++;
      } else {
        console.log("❌ Test 17: Should throw error on connection failure");
      }
    } catch (error) {
      console.log(`❌ Test 17: Connection error handling - ${error}`);
    }

  } finally {
    // Clean up: stop the mock server
    await mockServer.stopServer();
    console.log("\n🛑 Mock server stopped");
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

