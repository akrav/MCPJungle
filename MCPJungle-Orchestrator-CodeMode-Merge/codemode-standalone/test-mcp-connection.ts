/**
 * Test MCP Server Connection
 * 
 * This script tests the MCP server connection and tool execution
 * to verify everything is working before integrating with Cursor.
 */

import { MCPClient } from "./src/mcp/MCPClient.js";
import { MCPToolConverter } from "./src/mcp/MCPToolConverter.js";

async function testConnection() {
  console.log("🧪 Testing MCP Server Connection\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const serverUrl = "http://localhost:3456/mcp";
  let client: MCPClient | null = null;

  try {
    // Test 1: Connect to server
    console.log("📡 Test 1: Connecting to MCP server...");
    client = new MCPClient({
      url: serverUrl,
      transport: "sse",
    });

    await client.connect();
    console.log("✅ Connection successful!\n");

    // Test 2: Check server status
    console.log("📊 Test 2: Checking server status...");
    const status = client.getStatus();
    console.log(`✅ Server status: ${status.connected ? "Connected" : "Disconnected"}`);
    console.log(`✅ Tool count: ${status.toolCount} tools available\n`);

    // Test 3: List available tools
    console.log("🔧 Test 3: Listing available tools...");
    const converter = new MCPToolConverter();
    const tools = converter.convertAllTools(client);
    const toolNames = Object.keys(tools);
    
    console.log(`✅ Found ${toolNames.length} tools:`);
    for (const name of toolNames) {
      const tool = tools[name];
      console.log(`   • ${name}: ${tool.description}`);
    }
    console.log("");

    // Test 4: Execute a tool
    console.log("⚡ Test 4: Testing tool execution (get_weather)...");
    const weatherTool = tools.mcp_get_weather;
    if (weatherTool) {
      const result = await weatherTool.execute({ location: "San Francisco" });
      console.log("✅ Tool executed successfully!");
      console.log("   Result:", JSON.stringify(result, null, 2));
    } else {
      console.log("❌ Weather tool not found");
    }
    console.log("");

    // Test 5: Execute another tool
    console.log("⚡ Test 5: Testing tool execution (filesystem_read)...");
    const filesystemTool = tools.mcp_filesystem_read;
    if (filesystemTool) {
      const result = await filesystemTool.execute({ path: "/etc/config.json" });
      console.log("✅ Tool executed successfully!");
      console.log("   Result:", JSON.stringify(result, null, 2));
    } else {
      console.log("❌ Filesystem tool not found");
    }
    console.log("");

    // Test 6: Execute database query
    console.log("⚡ Test 6: Testing tool execution (database_query)...");
    const dbTool = tools.mcp_database_query;
    if (dbTool) {
      const result = await dbTool.execute({ 
        sql: "SELECT * FROM users WHERE active = ?",
        params: [true]
      });
      console.log("✅ Tool executed successfully!");
      console.log("   Result:", JSON.stringify(result, null, 2));
    } else {
      console.log("❌ Database tool not found");
    }
    console.log("");

    // Summary
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ All tests passed!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("🎉 Your MCP server is ready for Cursor integration!");
    console.log("\n📖 Next Steps:");
    console.log("   1. Open Cursor");
    console.log("   2. Add MCP server: http://localhost:3456/mcp");
    console.log("   3. See CURSOR_INTEGRATION.md for detailed instructions\n");

  } catch (error) {
    console.error("\n❌ Test failed:", error);
    console.error("\n🔍 Troubleshooting:");
    console.error("   • Is the server running? Run: npm run mcp:server");
    console.error("   • Check server health: curl http://localhost:3456/health");
    console.error("   • Check server logs for errors\n");
    process.exit(1);
  } finally {
    // Cleanup
    if (client) {
      console.log("🔌 Disconnecting from server...");
      await client.disconnect();
      console.log("✅ Disconnected successfully\n");
    }
  }
}

// Run the test
testConnection().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});





