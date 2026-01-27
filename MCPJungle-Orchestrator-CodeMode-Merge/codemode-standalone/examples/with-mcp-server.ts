/**
 * Example of using codemode with an MCP server
 * Demonstrates how to connect to an MCP server and use its tools
 */

import { CodemodeEngine, MCPClient, MCPToolConverter } from "../src/index.js";
import { z } from "zod";

// Simulate LLM code generation
async function simulateLLMCodeGeneration(prompt: string): Promise<string> {
  console.log("\n=== LLM Prompt (truncated) ===");
  console.log(prompt.substring(0, 500) + "...");
  console.log("=== End Prompt ===\n");

  // Example: Let's say the MCP server has a 'list_files' tool
  return `
    const files = await tools.mcp_filesystem_list_files({ path: "/home/user" });
    return { fileCount: files.length, files };
  `;
}

async function main() {
  console.log("🚀 Codemode Standalone - MCP Integration Example\n");

  // Note: This is a hypothetical MCP server
  // Replace with your actual MCP server URL and transport type
  const mcpConfig = {
    url: "http://localhost:3000/mcp", // Your MCP server URL
    transport: "sse" as const, // or "stdio" for local processes
  };

  let mcpClient: MCPClient | null = null;

  try {
    // Step 1: Connect to the MCP server
    console.log("📡 Connecting to MCP server...");
    mcpClient = new MCPClient(mcpConfig);
    await mcpClient.connect();

    const status = mcpClient.getStatus();
    console.log(`✅ Connected! Found ${status.toolCount} tools\n`);

    // Step 2: Convert MCP tools to codemode tools
    const converter = new MCPToolConverter();
    const mcpTools = converter.convertAllTools(mcpClient);

    console.log("🔧 Available MCP Tools:");
    for (const toolName of Object.keys(mcpTools)) {
      console.log(`  - ${toolName}`);
    }
    console.log("");

    // Step 3: Add some local tools as well
    const localTools = {
      formatOutput: {
        name: "formatOutput",
        description: "Format data as a nice string",
        inputSchema: z.object({
          data: z.any().describe("Data to format"),
        }),
        execute: async (args: { data: any }) => {
          return {
            formatted: JSON.stringify(args.data, null, 2),
          };
        },
      },
    };

    // Combine MCP tools with local tools
    const allTools = {
      ...mcpTools,
      ...localTools,
    };

    // Step 4: Create the codemode engine
    const engine = new CodemodeEngine({
      generateCode: simulateLLMCodeGeneration,
      tools: allTools,
      securityPolicy: {
        maxExecutionTime: 10000,
        maxMemoryMB: 128,
        allowNetworkAccess: false,
      },
      verbose: true,
    });

    // Step 5: Execute a request that uses MCP tools
    const request = {
      userRequest: "List all files in the user's home directory and count them",
    };

    console.log("📝 User Request:", request.userRequest);

    const response = await engine.execute(request);

    console.log("\n✅ Execution Result:");
    console.log("Success:", response.result.success);
    console.log("Execution Time:", response.result.executionTime + "ms");

    if (response.result.success) {
      console.log("Result:", JSON.stringify(response.result.result, null, 2));
    } else {
      console.log("Error:", response.result.error?.message);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    // Clean up: disconnect from MCP server
    if (mcpClient) {
      console.log("\n🔌 Disconnecting from MCP server...");
      await mcpClient.disconnect();
    }
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}






