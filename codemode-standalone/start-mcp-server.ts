/**
 * Start MCP Server for Cursor Integration
 * 
 * This script starts the MockMCPServer which exposes MCP-compatible endpoints
 * for integration with Cursor or other MCP clients.
 * 
 * The server provides several useful tools out of the box:
 * - filesystem_read: Read files
 * - database_query: Query databases (mocked)
 * - get_weather: Get weather information (mocked)
 * 
 * You can dynamically add/update tools via the management API.
 */

import { MockMCPServer } from "./tests/mocks/MockMCPServer.js";

async function main() {
  console.log("🚀 Starting MCP Server for Cursor Integration\n");

  // Create server with verbose logging
  const server = new MockMCPServer({
    port: 3456,
    verbose: true,
  });

  // Start the server
  await server.startServer();

  const info = server.getInfo();
  console.log("\n✅ MCP Server is running!");
  console.log("\n📡 Connection Details:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  MCP Endpoint:  ${server.getServerUrl()}`);
  console.log(`  Transport:     SSE (Server-Sent Events)`);
  console.log(`  Port:          ${info.port}`);
  console.log(`  Available Tools: ${info.toolCount}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🔧 Available Tools:");
  const tools = server.getTools();
  for (const tool of tools) {
    console.log(`  • ${tool.name} - ${tool.description}`);
  }

  console.log("\n📋 Additional Endpoints:");
  console.log(`  Health Check:  http://localhost:${info.port}/health`);
  console.log(`  List Tools:    http://localhost:${info.port}/api/tools`);
  console.log(`  Add Tool:      POST http://localhost:${info.port}/api/tools`);
  console.log(`  Delete Tool:   DELETE http://localhost:${info.port}/api/tools/{name}`);

  console.log("\n🎯 For Cursor Integration:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  1. Open Cursor Settings");
  console.log("  2. Navigate to MCP Settings");
  console.log("  3. Add a new MCP server with:");
  console.log(`     URL: ${server.getServerUrl()}`);
  console.log("     Transport: SSE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("💡 Hot-Reload Support:");
  console.log("  You can dynamically add/update tools without restarting!");
  console.log("  Example: POST to /api/tools with tool definition\n");

  console.log("Press Ctrl+C to stop the server\n");

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n\n🛑 Shutting down MCP Server...");
    await server.stopServer();
    console.log("✅ Server stopped gracefully");
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n\n🛑 Shutting down MCP Server...");
    await server.stopServer();
    console.log("✅ Server stopped gracefully");
    process.exit(0);
  });
}

// Run the server
main().catch((error) => {
  console.error("❌ Failed to start MCP Server:", error);
  process.exit(1);
});





