/**
 * End-to-End Integration tests for MCP workflow
 * Tests the complete flow from MCP server to code execution
 */

import { CodemodeEngine } from "../../src/core/CodemodeEngine.js";
import { MCPClient } from "../../src/mcp/MCPClient.js";
import { MCPToolConverter } from "../../src/mcp/MCPToolConverter.js";
import { MockMCPServer } from "../mocks/MockMCPServer.js";
import { DynamicToolLoader, HotReloadDemo } from "../mocks/DynamicToolLoader.js";
import type { ToolSet } from "../../src/types/index.js";
import { z } from "zod";

async function runTests() {
  console.log("🧪 Testing End-to-End MCP Workflow...\n");

  let passedTests = 0;
  let totalTests = 0;

  // Test 1: Basic MCP Workflow - Connect to MCP server
  totalTests++;
  try {
    const mockServer = new MockMCPServer({ port: 3460, verbose: false });
    await mockServer.startServer();

    const client = new MCPClient({
      url: mockServer.getServerUrl(),
      transport: "sse",
    });
    await client.connect();

    await client.disconnect();
    await mockServer.stopServer();

    console.log("✅ Test 1: Connect to MCP server");
    passedTests++;
  } catch (error) {
    console.log(`❌ Test 1: Connect to MCP server - ${error}`);
  }

  // Test 2: Discover and convert tools
  totalTests++;
  try {
    const mockServer = new MockMCPServer({ port: 3461, verbose: false });
    await mockServer.startServer();

    const client = new MCPClient({
      url: mockServer.getServerUrl(),
      transport: "sse",
    });
    await client.connect();

    const converter = new MCPToolConverter();
    const mcpTools = converter.convertAllTools(client);
    const toolCount = Object.keys(mcpTools).length;

    await client.disconnect();
    await mockServer.stopServer();

    if (toolCount > 0) {
      console.log(`✅ Test 2: Discover and convert tools (${toolCount} tools)`);
      passedTests++;
    } else {
      console.log("❌ Test 2: No tools discovered");
    }
  } catch (error) {
    console.log(`❌ Test 2: Discover and convert tools - ${error}`);
  }

  // Test 3: Create CodemodeEngine with MCP tools
  totalTests++;
  try {
    const mockServer = new MockMCPServer({ port: 3462, verbose: false });
    await mockServer.startServer();

    const client = new MCPClient({
      url: mockServer.getServerUrl(),
      transport: "sse",
    });
    await client.connect();

    const converter = new MCPToolConverter();
    const mcpTools = converter.convertAllTools(client);

    const engine = new CodemodeEngine({
      generateCode: async () => "return { test: true };",
      tools: mcpTools,
    });

    await client.disconnect();
    await mockServer.stopServer();

    console.log("✅ Test 3: Create CodemodeEngine with MCP tools");
    passedTests++;
  } catch (error) {
    console.log(`❌ Test 3: Create CodemodeEngine with MCP tools - ${error}`);
  }

  // Test 4: Generate code that calls MCP tool
  totalTests++;
  try {
    const mockServer = new MockMCPServer({ port: 3463, verbose: false });
    await mockServer.startServer();

    const client = new MCPClient({
      url: mockServer.getServerUrl(),
      transport: "sse",
    });
    await client.connect();

    const converter = new MCPToolConverter();
    const mcpTools = converter.convertAllTools(client);

    const engine = new CodemodeEngine({
      generateCode: async (prompt: string) => {
        // Mock LLM that generates code to call the weather tool
        return `
          const weather = await tools.mcp_get_weather({ location: "San Francisco" });
          return { weather };
        `;
      },
      tools: mcpTools,
    });

    const response = await engine.execute({
      userRequest: "Get weather for San Francisco",
    });

    await client.disconnect();
    await mockServer.stopServer();

    if (
      response.result.success &&
      response.result.result?.weather?.location === "San Francisco"
    ) {
      console.log("✅ Test 4: Generate code that calls MCP tool");
      passedTests++;
    } else {
      console.log(`❌ Test 4: Unexpected result: ${JSON.stringify(response.result)}`);
    }
  } catch (error) {
    console.log(`❌ Test 4: Generate code that calls MCP tool - ${error}`);
  }

  // Test 5: Execute code successfully
  totalTests++;
  try {
    const mockServer = new MockMCPServer({ port: 3464, verbose: false });
    await mockServer.startServer();

    const client = new MCPClient({
      url: mockServer.getServerUrl(),
      transport: "sse",
    });
    await client.connect();

    const converter = new MCPToolConverter();
    const mcpTools = converter.convertAllTools(client);

    const engine = new CodemodeEngine({
      generateCode: async () => {
        return `
          const data = await tools.mcp_filesystem_read({ path: "/test/file.txt" });
          return { fileContent: data.content };
        `;
      },
      tools: mcpTools,
    });

    const response = await engine.execute({
      userRequest: "Read a file",
    });

    await client.disconnect();
    await mockServer.stopServer();

    if (response.result.success && response.result.result?.fileContent) {
      console.log("✅ Test 5: Execute code successfully");
      passedTests++;
    } else {
      console.log(`❌ Test 5: Execution failed: ${JSON.stringify(response.result)}`);
    }
  } catch (error) {
    console.log(`❌ Test 5: Execute code successfully - ${error}`);
  }

  // Test 6: Verify MCP tool was called
  totalTests++;
  try {
    const mockServer = new MockMCPServer({ port: 3465, verbose: false });
    await mockServer.startServer();

    const client = new MCPClient({
      url: mockServer.getServerUrl(),
      transport: "sse",
    });
    await client.connect();

    const converter = new MCPToolConverter();
    const mcpTools = converter.convertAllTools(client);

    const engine = new CodemodeEngine({
      generateCode: async () => {
        return `
          const query = await tools.mcp_database_query({ 
            sql: "SELECT * FROM users",
            params: []
          });
          return { rowCount: query.count };
        `;
      },
      tools: mcpTools,
    });

    const response = await engine.execute({
      userRequest: "Query database",
    });

    await client.disconnect();
    await mockServer.stopServer();

    if (response.result.success && response.result.result?.rowCount === 2) {
      console.log("✅ Test 6: Verify MCP tool was called");
      passedTests++;
    } else {
      console.log(`❌ Test 6: Tool not called correctly: ${JSON.stringify(response.result)}`);
    }
  } catch (error) {
    console.log(`❌ Test 6: Verify MCP tool was called - ${error}`);
  }

  // Test 7: Call multiple MCP tools in sequence
  totalTests++;
  try {
    const mockServer = new MockMCPServer({ port: 3466, verbose: false });
    await mockServer.startServer();

    const client = new MCPClient({
      url: mockServer.getServerUrl(),
      transport: "sse",
    });
    await client.connect();

    const converter = new MCPToolConverter();
    const mcpTools = converter.convertAllTools(client);

    const engine = new CodemodeEngine({
      generateCode: async () => {
        return `
          const weather = await tools.mcp_get_weather({ location: "NYC" });
          const file = await tools.mcp_filesystem_read({ path: "/data.txt" });
          const query = await tools.mcp_database_query({ sql: "SELECT 1", params: [] });
          
          return { 
            weather: weather.location,
            file: file.path,
            queryCount: query.count
          };
        `;
      },
      tools: mcpTools,
    });

    const response = await engine.execute({
      userRequest: "Call multiple tools",
    });

    await client.disconnect();
    await mockServer.stopServer();

    if (
      response.result.success &&
      response.result.result?.weather === "NYC" &&
      response.result.result?.file === "/data.txt" &&
      response.result.result?.queryCount === 2
    ) {
      console.log("✅ Test 7: Call multiple MCP tools in sequence");
      passedTests++;
    } else {
      console.log(`❌ Test 7: Multiple calls failed: ${JSON.stringify(response.result)}`);
    }
  } catch (error) {
    console.log(`❌ Test 7: Call multiple MCP tools in sequence - ${error}`);
  }

  // Test 8: Pass data between MCP tool calls
  totalTests++;
  try {
    const mockServer = new MockMCPServer({ port: 3467, verbose: false });
    await mockServer.startServer();

    const client = new MCPClient({
      url: mockServer.getServerUrl(),
      transport: "sse",
    });
    await client.connect();

    const converter = new MCPToolConverter();
    const mcpTools = converter.convertAllTools(client);

    const engine = new CodemodeEngine({
      generateCode: async () => {
        return `
          const weather = await tools.mcp_get_weather({ location: "Boston" });
          const file = await tools.mcp_filesystem_read({ 
            path: "/weather/" + weather.location + ".txt"
          });
          
          return { 
            location: weather.location,
            temperature: weather.temperature,
            filePath: file.path
          };
        `;
      },
      tools: mcpTools,
    });

    const response = await engine.execute({
      userRequest: "Get weather and read related file",
    });

    await client.disconnect();
    await mockServer.stopServer();

    if (
      response.result.success &&
      response.result.result?.location === "Boston" &&
      response.result.result?.filePath === "/weather/Boston.txt"
    ) {
      console.log("✅ Test 8: Pass data between MCP tool calls");
      passedTests++;
    } else {
      console.log(`❌ Test 8: Data passing failed: ${JSON.stringify(response.result)}`);
    }
  } catch (error) {
    console.log(`❌ Test 8: Pass data between MCP tool calls - ${error}`);
  }

  // Test 9: Conditional logic with MCP tools
  totalTests++;
  try {
    const mockServer = new MockMCPServer({ port: 3468, verbose: false });
    await mockServer.startServer();

    const client = new MCPClient({
      url: mockServer.getServerUrl(),
      transport: "sse",
    });
    await client.connect();

    const converter = new MCPToolConverter();
    const mcpTools = converter.convertAllTools(client);

    const engine = new CodemodeEngine({
      generateCode: async () => {
        return `
          const weather = await tools.mcp_get_weather({ location: "Miami" });
          
          let action;
          if (weather.temperature > 70) {
            action = "It's warm!";
          } else {
            action = "It's cold!";
          }
          
          return { temperature: weather.temperature, action };
        `;
      },
      tools: mcpTools,
    });

    const response = await engine.execute({
      userRequest: "Check weather and decide",
    });

    await client.disconnect();
    await mockServer.stopServer();

    if (
      response.result.success &&
      response.result.result?.temperature === 72 &&
      response.result.result?.action === "It's warm!"
    ) {
      console.log("✅ Test 9: Conditional logic with MCP tools");
      passedTests++;
    } else {
      console.log(`❌ Test 9: Conditional logic failed: ${JSON.stringify(response.result)}`);
    }
  } catch (error) {
    console.log(`❌ Test 9: Conditional logic with MCP tools - ${error}`);
  }

  // Test 10: Mix MCP tools with local tools
  totalTests++;
  try {
    const mockServer = new MockMCPServer({ port: 3469, verbose: false });
    await mockServer.startServer();

    const client = new MCPClient({
      url: mockServer.getServerUrl(),
      transport: "sse",
    });
    await client.connect();

    const converter = new MCPToolConverter();
    const mcpTools = converter.convertAllTools(client);

    // Add a local tool
    const allTools: ToolSet = {
      ...mcpTools,
      local_multiply: {
        name: "local_multiply",
        description: "Multiply two numbers",
        inputSchema: z.object({
          a: z.number(),
          b: z.number(),
        }),
        execute: async (args: { a: number; b: number }) => {
          return { result: args.a * args.b };
        },
      },
    };

    const engine = new CodemodeEngine({
      generateCode: async () => {
        return `
          const weather = await tools.mcp_get_weather({ location: "Denver" });
          const multiplied = await tools.local_multiply({ 
            a: weather.temperature, 
            b: 2 
          });
          
          return { 
            original: weather.temperature,
            doubled: multiplied.result
          };
        `;
      },
      tools: allTools,
    });

    const response = await engine.execute({
      userRequest: "Get weather and double the temperature",
    });

    await client.disconnect();
    await mockServer.stopServer();

    if (
      response.result.success &&
      response.result.result?.original === 72 &&
      response.result.result?.doubled === 144
    ) {
      console.log("✅ Test 10: Mix MCP tools with local tools");
      passedTests++;
    } else {
      console.log(`❌ Test 10: Mixed tools failed: ${JSON.stringify(response.result)}`);
    }
  } catch (error) {
    console.log(`❌ Test 10: Mix MCP tools with local tools - ${error}`);
  }

  // Test 11: Call both MCP and local tools in same code
  totalTests++;
  try {
    const mockServer = new MockMCPServer({ port: 3470, verbose: false });
    await mockServer.startServer();

    const client = new MCPClient({
      url: mockServer.getServerUrl(),
      transport: "sse",
    });
    await client.connect();

    const converter = new MCPToolConverter();
    const mcpTools = converter.convertAllTools(client);

    const allTools: ToolSet = {
      ...mcpTools,
      local_sum: {
        name: "local_sum",
        description: "Sum an array of numbers",
        inputSchema: z.object({
          numbers: z.array(z.number()),
        }),
        execute: async (args: { numbers: number[] }) => {
          return { sum: args.numbers.reduce((a, b) => a + b, 0) };
        },
      },
    };

    const engine = new CodemodeEngine({
      generateCode: async () => {
        return `
          const query = await tools.mcp_database_query({ 
            sql: "SELECT id FROM users",
            params: []
          });
          const ids = query.rows.map(row => row.id);
          const sumResult = await tools.local_sum({ numbers: ids });
          
          return { 
            userCount: query.count,
            idSum: sumResult.sum
          };
        `;
      },
      tools: allTools,
    });

    const response = await engine.execute({
      userRequest: "Query users and sum their IDs",
    });

    await client.disconnect();
    await mockServer.stopServer();

    if (
      response.result.success &&
      response.result.result?.userCount === 2 &&
      response.result.result?.idSum === 3 // 1 + 2
    ) {
      console.log("✅ Test 11: Call both MCP and local tools in same code");
      passedTests++;
    } else {
      console.log(`❌ Test 11: Mixed tool calls failed: ${JSON.stringify(response.result)}`);
    }
  } catch (error) {
    console.log(`❌ Test 11: Call both MCP and local tools in same code - ${error}`);
  }

  // Test 12: Verify namespacing works (no conflicts)
  totalTests++;
  try {
    const mockServer = new MockMCPServer({ port: 3471, verbose: false });
    await mockServer.startServer();

    const client = new MCPClient({
      url: mockServer.getServerUrl(),
      transport: "sse",
    });
    await client.connect();

    const converter = new MCPToolConverter();
    const mcpTools = converter.convertAllTools(client);

    // Create a local tool with a name that would conflict without namespacing
    const allTools: ToolSet = {
      ...mcpTools,
      get_weather: {
        // Same name as MCP tool (but MCP one is prefixed)
        name: "get_weather",
        description: "Local weather tool",
        inputSchema: z.object({
          location: z.string(),
        }),
        execute: async (args: { location: string }) => {
          return { 
            location: args.location,
            temperature: 999, // Different result to distinguish
            source: "local"
          };
        },
      },
    };

    const engine = new CodemodeEngine({
      generateCode: async () => {
        return `
          const mcpWeather = await tools.mcp_get_weather({ location: "Test" });
          const localWeather = await tools.get_weather({ location: "Test" });
          
          return { 
            mcp: mcpWeather.temperature,
            local: localWeather.temperature
          };
        `;
      },
      tools: allTools,
    });

    const response = await engine.execute({
      userRequest: "Test namespacing",
    });

    await client.disconnect();
    await mockServer.stopServer();

    if (
      response.result.success &&
      response.result.result?.mcp === 72 &&
      response.result.result?.local === 999
    ) {
      console.log("✅ Test 12: Verify namespacing works (no conflicts)");
      passedTests++;
    } else {
      console.log(`❌ Test 12: Namespacing issue: ${JSON.stringify(response.result)}`);
    }
  } catch (error) {
    console.log(`❌ Test 12: Verify namespacing works - ${error}`);
  }

  // Test 13: Hot reload workflow - Dynamic tool updates
  totalTests++;
  try {
    console.log("\n--- Hot Reload Test ---");
    const mockServer = new MockMCPServer({ port: 3472, verbose: false });
    await mockServer.startServer();

    await HotReloadDemo.simulateAgentWorkflow(
      mockServer,
      new DynamicToolLoader(mockServer, {
        toolsDir: "/tmp/tools",
        verbose: false,
      })
    );

    await mockServer.stopServer();

    console.log("✅ Test 13: Hot reload workflow - Dynamic tool updates");
    passedTests++;
  } catch (error) {
    console.log(`❌ Test 13: Hot reload workflow - ${error}`);
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

